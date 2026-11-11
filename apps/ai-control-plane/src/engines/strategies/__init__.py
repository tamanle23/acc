"""
Model Execution Strategies for AI Control Plane.

All modality pipelines implement the unified PipelineStrategy protocol
and are registered in StrategyRegistry.
"""
from __future__ import annotations

from engines.strategies.base import BasePipelineStrategy, PipelineStrategy
from engines.strategies.registry import StrategyRegistry

# Import all strategy implementations to trigger registration
from engines.strategies.asr import WhisperAsrStrategy
from engines.strategies.depth import DepthEstimationStrategy
from engines.strategies.detection import DetectionStrategy
from engines.strategies.diffusion import DiffusionStrategy
from engines.strategies.embeddings import EmbeddingsStrategy
from engines.strategies.llm import LlmGenerationStrategy
from engines.strategies.segmentation import SegmentationStrategy
from engines.strategies.tts import (
    AdaptiveTtsStrategy,
    KokoroTtsStrategy,
    VieneuTtsStrategy,
    HuggingFaceTtsStrategy,
)
from engines.strategies.tts_kokoro import KokoroTtsStrategy as IsolatedKokoroTtsStrategy
from engines.strategies.tts_vieneu import VieneuTtsStrategy as IsolatedVieneuTtsStrategy
from engines.strategies.tts_hf import HuggingFaceTtsStrategy as IsolatedHuggingFaceTtsStrategy

__all__ = [
    "PipelineStrategy",
    "BasePipelineStrategy",
    "StrategyRegistry",
    "WhisperAsrStrategy",
    "KokoroTtsStrategy",
    "VieneuTtsStrategy",
    "HuggingFaceTtsStrategy",
    "AdaptiveTtsStrategy",
    "DepthEstimationStrategy",
    "SegmentationStrategy",
    "LlmGenerationStrategy",
    "DiffusionStrategy",
    "DetectionStrategy",
    "EmbeddingsStrategy",
]
