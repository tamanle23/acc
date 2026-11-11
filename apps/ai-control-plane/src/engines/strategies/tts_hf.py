"""
HuggingFaceTtsStrategy — Declarative Hugging Face speech synthesis strategy.

Wraps Hugging Face transformers pipeline("text-to-speech"), enabling instant zero-code
onboarding for Parler-TTS, MMS-TTS, SpeechT5, Bark, and any standard HF speech checkpoint.
"""
from __future__ import annotations

import logging
from typing import Any, AsyncIterator, Iterator

import numpy as np
import torch
import transformers

from engines.strategies.base import BasePipelineStrategy
from engines.strategies.registry import StrategyRegistry
from engines.strategies.tts_base import (
    build_audio_inference_response,
    host_cuda_available,
    normalize_audio_array,
)

logger = logging.getLogger(__name__)


@StrategyRegistry.register("hf-tts", "huggingface-tts", "transformers-tts")
class HuggingFaceTtsStrategy(BasePipelineStrategy):
    """Production execution strategy for standard Hugging Face TTS pipelines."""

    strategy_id: str = "hf_transformers_tts"
    pipeline_type: str = "text-to-speech"
    output_modality: str = "pcm_audio"

    def __init__(self) -> None:
        self.engine_id: str = "hf-generic-tts"
        self.model_id: str = "parler-tts/parler-tts-mini-v1"
        self.device: str = "cuda:0" if host_cuda_available() else "cpu"
        self.sample_rate: int = 24_000
        self._pipe: Any = None
        self.is_loaded: bool = False

    def load(
        self,
        model_id: str = "parler-tts/parler-tts-mini-v1",
        device: str = "cuda:0",
        *,
        engine_id: str = "hf-generic-tts",
        precision: str = "fp32",
        offload_strategy: str = "none",
        vram_mb: int | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        self.engine_id = engine_id
        self.model_id = model_id
        self.device = device

        pipe_device = (
            device
            if (host_cuda_available() and "cuda" in device and offload_strategy != "cpu_ram_offload")
            else "cpu"
        )
        dtype = torch.float16 if (host_cuda_available() and precision in ("fp16", "bf16")) else torch.float32

        logger.info(
            "Loading HuggingFaceTtsStrategy for model_id=%s on device=%s dtype=%s",
            self.model_id,
            pipe_device,
            dtype,
        )

        self._pipe = transformers.pipeline(
            "text-to-speech",
            model=self.model_id,
            device=pipe_device,
            dtype=dtype,
            trust_remote_code=True,
        )
        self.is_loaded = True

        return {
            "status": "ready",
            "engine_id": self.engine_id,
            "model_id": self.model_id,
            "device": self.device,
            "load_source": "transformers_pipeline_tts",
            "sample_rate": self.sample_rate,
            "modality": self.output_modality,
        }

    def infer(self, inputs: Any, parameters: dict[str, Any]) -> dict[str, Any]:
        if not self._pipe:
            raise RuntimeError(f"HuggingFaceTtsStrategy for '{self.model_id}' is not loaded. Call load() first.")

        text = str(inputs or parameters.get("text") or parameters.get("prompt") or "").strip()
        if not text:
            raise ValueError("Input text for speech synthesis cannot be empty.")

        # Pass through optional parameters (e.g., speaker_embeddings, forward_params)
        pipe_kwargs: dict[str, Any] = {}
        if "forward_params" in parameters:
            pipe_kwargs["forward_params"] = parameters["forward_params"]

        raw_out = self._pipe(text, **pipe_kwargs)
        if isinstance(raw_out, list) and raw_out:
            raw_out = raw_out[0]

        audio_arr = raw_out.get("audio") if isinstance(raw_out, dict) else raw_out
        sample_rate = raw_out.get("sampling_rate", self.sample_rate) if isinstance(raw_out, dict) else self.sample_rate
        self.sample_rate = int(sample_rate)

        return build_audio_inference_response(
            audio_arr=audio_arr,
            sample_rate=self.sample_rate,
            device=self.device,
            pipeline_type=self.pipeline_type,
            output_modality=self.output_modality,
        )

    def infer_stream(self, inputs: Any, parameters: dict[str, Any]) -> AsyncIterator[bytes] | Iterator[bytes]:
        res = self.infer(inputs, parameters)
        yield res["wav_bytes"]

    def unload(self) -> None:
        self._pipe = None
        self.is_loaded = False
        if host_cuda_available():
            try:
                torch.cuda.empty_cache()
            except Exception:
                pass
        logger.info("HuggingFaceTtsStrategy for '%s' unloaded", self.model_id)
