"""
AdaptiveTtsStrategy — Dynamic composite dispatcher for Text-To-Speech strategies.

Dispatches requests based on engine_id/model_id to dedicated decoupled strategies:
- KokoroTtsStrategy (ONNX Runtime, 24kHz)
- VieneuTtsStrategy (VieNeu Vietnamese Neural Acoustic Engine, 48kHz)
- HuggingFaceTtsStrategy (Declarative HF transformers pipeline)
"""
from __future__ import annotations

import logging
from typing import Any, AsyncIterator, Iterator

from engines.strategies.base import BasePipelineStrategy, PipelineStrategy
from engines.strategies.registry import StrategyRegistry
from engines.strategies.tts_hf import HuggingFaceTtsStrategy
from engines.strategies.tts_kokoro import KokoroTtsStrategy
from engines.strategies.tts_vieneu import VieneuTtsStrategy

logger = logging.getLogger(__name__)


@StrategyRegistry.register("text-to-speech", "tts")
class AdaptiveTtsStrategy(KokoroTtsStrategy):
    """
    Dynamic composite TTS strategy routing to Kokoro, VieNeu, or Hugging Face.

    Subclasses KokoroTtsStrategy to maintain 100% backward compatibility with
    type checks in legacy harnesses while delegating to specialized engines.
    """

    strategy_id: str = "adaptive_tts"
    pipeline_type: str = "text-to-speech"
    output_modality: str = "pcm_audio"

    def __init__(self) -> None:
        super().__init__()
        self._delegate: PipelineStrategy | None = None

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

        norm_engine = engine_id.lower()
        norm_model = model_id.lower()

        if "kokoro" in norm_engine or "kokoro" in norm_model:
            self._delegate = KokoroTtsStrategy()
        elif "vieneu" in norm_engine or "vieneu" in norm_model:
            self._delegate = VieneuTtsStrategy()
        else:
            self._delegate = HuggingFaceTtsStrategy()

        res = self._delegate.load(
            model_id=model_id,
            device=device,
            engine_id=engine_id,
            precision=precision,
            offload_strategy=offload_strategy,
            vram_mb=vram_mb,
            **kwargs,
        )

        self.sample_rate = getattr(self._delegate, "sample_rate", 24_000)
        self.is_loaded = getattr(self._delegate, "is_loaded", True)
        self._primary_tts = getattr(self._delegate, "_primary_tts", None)
        self._stream_tts = getattr(self._delegate, "_stream_tts", None)
        return res

    def infer(self, inputs: Any, parameters: dict[str, Any]) -> dict[str, Any]:
        if self._delegate is None:
            # Fallback to base Kokoro if infer is called before explicit load()
            return super().infer(inputs, parameters)
        return self._delegate.infer(inputs, parameters)

    def infer_stream(self, inputs: Any, parameters: dict[str, Any]) -> AsyncIterator[bytes] | Iterator[bytes]:
        if self._delegate is None:
            return super().infer_stream(inputs, parameters)
        return self._delegate.infer_stream(inputs, parameters)

    def list_voices(self) -> list[dict[str, str]]:
        if self._delegate is not None and hasattr(self._delegate, "list_voices"):
            return self._delegate.list_voices()
        return super().list_voices()

    def add_voice(self, name: str, ref_path: str) -> None:
        if self._delegate is not None and hasattr(self._delegate, "add_voice"):
            self._delegate.add_voice(name, ref_path)
        else:
            super().add_voice(name, ref_path)

    def unload(self) -> None:
        if self._delegate is not None:
            self._delegate.unload()
            self._delegate = None
        super().unload()
        self.is_loaded = False


__all__ = [
    "AdaptiveTtsStrategy",
    "KokoroTtsStrategy",
    "VieneuTtsStrategy",
    "HuggingFaceTtsStrategy",
]
