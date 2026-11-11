"""
KokoroTtsStrategy — Dedicated Text-To-Speech strategy for Kokoro-82M ONNX Runtime.

High-throughput, ultra-low latency 24kHz neural speech synthesis using ONNX Runtime
and pre-extracted voice style embedding vectors.
"""
from __future__ import annotations

import logging
import os
from typing import Any, AsyncIterator, Iterator

import numpy as np

from core.exceptions import ModelWeightsNotFoundError
from engines.strategies.base import BasePipelineStrategy
from engines.strategies.registry import StrategyRegistry
from engines.strategies.tts_base import (
    build_audio_inference_response,
    host_cuda_available,
    normalize_audio_array,
)
from engines.audio_utils import encode_wav_bytes

logger = logging.getLogger(__name__)


@StrategyRegistry.register("kokoro-tts", "kokoro", "kokoro-82m-tts")
class KokoroTtsStrategy(BasePipelineStrategy):
    """Production ONNX Runtime execution strategy for Kokoro-82M."""

    strategy_id: str = "kokoro_onnx_tts"
    pipeline_type: str = "text-to-speech"
    output_modality: str = "pcm_audio"

    def __init__(self) -> None:
        self.engine_id: str = "kokoro-82m-tts"
        self.model_id: str = "hexgrad/Kokoro-82M"
        self.device: str = "cuda:0" if host_cuda_available() else "cpu"
        self._primary_tts: Any = None
        self._stream_tts: Any = None
        self.sample_rate: int = 24_000
        self.is_loaded: bool = False

    def load(
        self,
        model_id: str = "hexgrad/Kokoro-82M",
        device: str = "cuda:0",
        *,
        engine_id: str = "kokoro-82m-tts",
        precision: str = "fp32",
        offload_strategy: str = "none",
        vram_mb: int | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        self.engine_id = engine_id
        self.model_id = model_id
        self.device = device
        self.sample_rate = 24_000

        cache_dir = os.environ.get(
            "INFERENCE_CACHE_DIR",
            os.path.join(os.path.expanduser("~"), ".cache", "ai-inference", "models", engine_id),
        )

        onnx_candidates = [
            os.path.join(cache_dir, "kokoro-v1_0.onnx"),
            os.path.join(cache_dir, "kokoro-v1_0_fp16.onnx"),
        ]
        if os.path.exists(cache_dir):
            for f in os.listdir(cache_dir):
                if f.endswith(".onnx") and os.path.join(cache_dir, f) not in onnx_candidates:
                    onnx_candidates.append(os.path.join(cache_dir, f))

        valid_onnx = [p for p in onnx_candidates if os.path.exists(p)]
        if not valid_onnx:
            raise ModelWeightsNotFoundError(
                f"Kokoro ONNX weights for '{engine_id}' are missing from '{cache_dir}'. Expected 'kokoro-v1_0.onnx'.",
                engine_id=engine_id,
                missing_files=["kokoro-v1_0.onnx"],
            )

        from engines.kokoro_engine import KokoroOnnxEngine

        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if (host_cuda_available() and offload_strategy != "cpu_ram_offload" and "cpu" not in device)
            else ["CPUExecutionProvider"]
        )
        voices_dir = os.path.join(cache_dir, "voices")
        self._primary_tts = KokoroOnnxEngine(
            model_path=valid_onnx[0],
            voices_dir=voices_dir,
            providers=providers,
        )
        self._stream_tts = self._primary_tts
        self.is_loaded = True
        load_source = (
            "onnxruntime_gpu"
            if "CUDAExecutionProvider" in self._primary_tts.session.get_providers()
            else "onnxruntime_cpu"
        )

        logger.info(
            "KokoroTtsStrategy loaded engine_id=%s with load_source=%s on device=%s",
            self.engine_id,
            load_source,
            self.device,
        )

        return {
            "status": "ready",
            "engine_id": self.engine_id,
            "model_id": self.model_id,
            "device": self.device,
            "load_source": load_source,
            "sample_rate": self.sample_rate,
            "modality": self.output_modality,
        }

    def infer(self, inputs: Any, parameters: dict[str, Any]) -> dict[str, Any]:
        if not self._primary_tts:
            raise RuntimeError(f"KokoroTtsStrategy for '{self.engine_id}' is not loaded. Call load() first.")

        text = str(inputs or parameters.get("text") or parameters.get("prompt") or "")
        voice = str(parameters.get("voice", "af_bella"))
        speed = float(parameters.get("speed", 1.0))

        audio_arr = self._primary_tts.infer(
            text=text,
            voice=voice,
            speed=speed,
            ref_audio=parameters.get("ref_audio"),
        )
        return build_audio_inference_response(
            audio_arr=audio_arr,
            sample_rate=self.sample_rate,
            device=self.device,
            pipeline_type=self.pipeline_type,
            output_modality=self.output_modality,
            extra_metadata={"voice_used": voice},
        )

    def infer_stream(self, inputs: Any, parameters: dict[str, Any]) -> Iterator[bytes]:
        text = str(inputs or parameters.get("text") or parameters.get("prompt") or "")
        voice = str(parameters.get("voice", "af_bella"))
        speed = float(parameters.get("speed", 1.0))
        pitch = float(parameters.get("pitch", 0.0))
        gain_db = float(parameters.get("gain_db", 0.0))

        if hasattr(self._stream_tts, "infer_stream"):
            try:
                for chunk in self._stream_tts.infer_stream(
                    text=text,
                    voice=voice,
                    speed=speed,
                    pitch=pitch,
                    gain_db=gain_db,
                ):
                    if isinstance(chunk, np.ndarray):
                        wav_bytes, _ = encode_wav_bytes(chunk, sample_rate=self.sample_rate)
                        yield wav_bytes
                    elif isinstance(chunk, (bytes, bytearray)):
                        yield bytes(chunk)
                return
            except Exception as e:
                logger.warning("Kokoro stream generation failed, falling back to batch (%s)", e)

        res = self.infer(inputs, parameters)
        yield res["wav_bytes"]

    def list_voices(self) -> list[dict[str, str]]:
        if not self._primary_tts:
            return []
        voices = []
        if hasattr(self._primary_tts, "_voice_cache"):
            for v_name in sorted(self._primary_tts._voice_cache.keys()):
                voices.append({"id": v_name, "name": v_name.replace("_", " ").title()})
        return voices

    def add_voice(self, name: str, ref_path: str) -> None:
        if self._primary_tts and hasattr(self._primary_tts, "add_voice"):
            self._primary_tts.add_voice(name, ref_path)

    def unload(self) -> None:
        if self._primary_tts is not None and hasattr(self._primary_tts, "unload"):
            self._primary_tts.unload()
        self._primary_tts = None
        self._stream_tts = None
        self.is_loaded = False
        logger.info("KokoroTtsStrategy for '%s' unloaded", self.engine_id)
