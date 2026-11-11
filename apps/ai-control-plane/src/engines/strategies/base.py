"""
PipelineStrategy Protocol & Base Class.

Defines the universal contract for all modality execution strategies:
- load: initialize and bind weights/pipeline to target hardware
- infer: synchronous single-shot inference
- infer_stream: asynchronous or generator streaming inference
- unload: release VRAM and system memory cleanly
"""
from __future__ import annotations

from typing import Any, AsyncIterator, Iterator, Protocol, runtime_checkable


@runtime_checkable
class PipelineStrategy(Protocol):
    """Protocol implemented by every modality strategy."""

    strategy_id: str
    pipeline_type: str
    output_modality: str
    is_loaded: bool
    device: str

    def load(
        self,
        model_id: str,
        device: str,
        *,
        precision: str = "fp16",
        offload_strategy: str = "none",
        vram_mb: int | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Load weights and initialize execution pipeline."""
        ...

    def infer(self, inputs: Any, parameters: dict[str, Any]) -> dict[str, Any]:
        """Execute single-shot inference."""
        ...

    def infer_stream(self, inputs: Any, parameters: dict[str, Any]) -> AsyncIterator[Any] | Iterator[Any]:
        """Execute streaming inference (tokens, audio chunks, etc.)."""
        ...

    def unload(self) -> None:
        """Release pipeline resources and free accelerator memory."""
        ...

    def to(self, device: str) -> "PipelineStrategy":
        """Move pipeline/model to the specified device for VRAM offloading."""
        ...


class BasePipelineStrategy:
    """Base helper class providing default attributes and offloading hooks."""

    strategy_id: str = "base"
    pipeline_type: str = "custom"
    output_modality: str = "custom"
    is_loaded: bool = False
    device: str = "cpu"

    def infer_stream(self, inputs: Any, parameters: dict[str, Any]) -> AsyncIterator[Any] | Iterator[Any]:
        """Default stream implementation for non-streaming strategies: yields single infer output."""
        res = self.infer(inputs, parameters)
        yield res

    def to(self, device: str) -> "BasePipelineStrategy":
        """Default device switch hook. Subclasses override to move underlying models/tensors."""
        self.device = device
        return self

    def unload(self) -> None:
        self.is_loaded = False
