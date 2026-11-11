"""
WhisperAsrStrategy — Automatic Speech Recognition using Hugging Face Transformers Whisper.

Provides zero-stub transcription, dual-engine soundfile/wave decoding,
automatic 16kHz mono resampling, word-level timestamps, and GPU OOM fallback.
"""
from __future__ import annotations

import base64
import io
import logging
import os
import wave
from typing import Any, AsyncIterator, Iterator, Literal

import numpy as np
import torch
from transformers import pipeline

from engines.strategies.base import BasePipelineStrategy
from engines.strategies.registry import StrategyRegistry

logger = logging.getLogger(__name__)

_TARGET_SAMPLE_RATE = 16_000


@StrategyRegistry.register("automatic-speech-recognition", "asr")
class WhisperAsrStrategy(BasePipelineStrategy):
    strategy_id: str = "whisper_hf"
    pipeline_type: str = "automatic-speech-recognition"
    output_modality: str = "timestamped_transcript"

    def __init__(self) -> None:
        self.model_id: str = "openai/whisper-large-v3-turbo"
        self.device: str = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.torch_dtype: torch.dtype = torch.float16 if "cuda" in self.device else torch.float32
        self._pipe: Any = None
        self.is_loaded: bool = False

    def load(
        self,
        model_id: str = "openai/whisper-large-v3-turbo",
        device: str = "cuda:0",
        *,
        precision: str = "fp16",
        offload_strategy: str = "none",
        vram_mb: int | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        self.model_id = model_id
        target_device = device if (torch.cuda.is_available() and "cuda" in device and offload_strategy != "cpu_ram_offload") else "cpu"
        self.device = target_device
        self.torch_dtype = torch.float16 if "cuda" in self.device else torch.float32

        logger.info("Loading WhisperAsrStrategy model_id=%s on device=%s", self.model_id, self.device)
        try:
            self._pipe = pipeline(
                "automatic-speech-recognition",
                model=self.model_id,
                dtype=self.torch_dtype,
                device=self.device,
                model_kwargs={"use_safetensors": True},
            )
            self.is_loaded = True
        except (torch.cuda.OutOfMemoryError, RuntimeError) as exc:
            if "out of memory" in str(exc).lower() and "cuda" in self.device:
                logger.warning("CUDA OOM loading Whisper on %s; falling back to CPU", self.device)
                self.device = "cpu"
                self.torch_dtype = torch.float32
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                self._pipe = pipeline(
                    "automatic-speech-recognition",
                    model=self.model_id,
                    dtype=torch.float32,
                    device="cpu",
                    model_kwargs={"use_safetensors": True},
                )
                self.is_loaded = True
            else:
                raise

        return {
            "status": "ready",
            "engine_id": kwargs.get("engine_id", "whisper-large-v3-turbo"),
            "model_id": self.model_id,
            "device": self.device,
            "pipeline_type": self.pipeline_type,
            "modality": self.output_modality,
        }

    @staticmethod
    def decode_audio_to_float32(audio_bytes: bytes) -> np.ndarray:
        """
        Decodes raw audio bytes to a 16kHz float32 mono numpy array in [-1.0, 1.0].
        Uses soundfile if available; falls back to standard library wave module.
        """
        try:
            import soundfile as sf
            with io.BytesIO(audio_bytes) as buf:
                data, sr = sf.read(buf, dtype="float32")
                if data.ndim > 1:
                    data = data.mean(axis=1)
                if sr != _TARGET_SAMPLE_RATE:
                    try:
                        import scipy.signal
                        num_samples = int(len(data) * (_TARGET_SAMPLE_RATE / sr))
                        data = scipy.signal.resample(data, num_samples).astype(np.float32)
                    except ImportError:
                        new_indices = np.linspace(0, len(data) - 1, int(len(data) * (_TARGET_SAMPLE_RATE / sr)))
                        data = np.interp(new_indices, np.arange(len(data)), data).astype(np.float32)
                return np.nan_to_num(data, nan=0.0, posinf=1.0, neginf=-1.0)
        except Exception:
            with io.BytesIO(audio_bytes) as buf, wave.open(buf, "rb") as wf:
                sr = wf.getframerate()
                num_channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                frames = wf.readframes(wf.getnframes())

                if sample_width == 2:
                    raw_arr = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
                elif sample_width == 4:
                    raw_arr = np.frombuffer(frames, dtype="<i4").astype(np.float32) / 2147483648.0
                else:
                    raise ValueError(f"Unsupported WAV sample width: {sample_width}")

                if num_channels > 1:
                    raw_arr = raw_arr.reshape(-1, num_channels).mean(axis=1)

                if sr != _TARGET_SAMPLE_RATE:
                    new_indices = np.linspace(0, len(raw_arr) - 1, int(len(raw_arr) * (_TARGET_SAMPLE_RATE / sr)))
                    raw_arr = np.interp(new_indices, np.arange(len(raw_arr)), raw_arr).astype(np.float32)

                return np.nan_to_num(raw_arr, nan=0.0, posinf=1.0, neginf=-1.0)

    @classmethod
    def extract_audio_bytes(cls, inputs: Any, parameters: dict[str, Any]) -> bytes:
        """Extracts audio bytes from inputs (bytes, data URI, base64 string, or filepath)."""
        if isinstance(inputs, bytes):
            return inputs

        input_str = str(inputs or "").strip()
        if "data:audio" in input_str and "base64," in input_str:
            b64_part = input_str.split("base64,", 1)[1].split()[0]
            return base64.b64decode(b64_part)

        param_uri = str(parameters.get("audio_data_uri", "")).strip()
        if "data:audio" in param_uri and "base64," in param_uri:
            b64_part = param_uri.split("base64,", 1)[1].split()[0]
            return base64.b64decode(b64_part)

        if os.path.exists(input_str) and os.path.isfile(input_str):
            with open(input_str, "rb") as f:
                return f.read()

        if len(input_str) > 256 and not input_str.startswith("{"):
            try:
                return base64.b64decode(input_str)
            except Exception:
                pass

        raise ValueError("ASR inference requires audio bytes, audio_data_uri, or a valid audio file path.")

    def infer(self, inputs: Any, parameters: dict[str, Any]) -> dict[str, Any]:
        if not self._pipe:
            raise RuntimeError("WhisperAsrStrategy is not loaded. Call load() first.")

        audio_bytes = self.extract_audio_bytes(inputs, parameters)
        samples = self.decode_audio_to_float32(audio_bytes)

        lang = parameters.get("language")
        task_mode = parameters.get("task") or parameters.get("asr_task", "transcribe")
        word_timestamps = bool(parameters.get("word_timestamps", parameters.get("return_timestamps", True)))
        temperature = float(parameters.get("temperature", 0.0))

        gen_kwargs: dict[str, Any] = {"task": task_mode, "temperature": temperature}
        if lang and lang != "auto":
            gen_kwargs["language"] = lang

        result = self._pipe(
            {"array": samples, "sampling_rate": _TARGET_SAMPLE_RATE},
            return_timestamps="word" if word_timestamps else False,
            generate_kwargs=gen_kwargs,
        )

        text = result.get("text", "").strip() if isinstance(result, dict) else str(result).strip()
        chunks = result.get("chunks", []) if isinstance(result, dict) else []
        detected_lang = result.get("language", lang) if isinstance(result, dict) else lang

        return {
            "modality": self.output_modality,
            "pipeline_type": self.pipeline_type,
            "text": text,
            "output": text,
            "language": detected_lang,
            "chunks": chunks,
            "device": self.device,
        }

    def infer_stream(self, inputs: Any, parameters: dict[str, Any]) -> Iterator[Any]:
        res = self.infer(inputs, parameters)
        chunks = res.get("chunks", [])
        if chunks:
            for ch in chunks:
                yield ch
        else:
            yield res

    def to(self, device: str) -> "WhisperAsrStrategy":
        if hasattr(self._pipe, "model") and hasattr(self._pipe.model, "to"):
            self._pipe.model.to(device)
            self.device = device
            if hasattr(self._pipe, "device"):
                self._pipe.device = torch.device(device)
        return self

    def unload(self) -> None:
        if self._pipe is not None:
            del self._pipe
            self._pipe = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        self.is_loaded = False
        logger.info("WhisperAsrStrategy unloaded")
