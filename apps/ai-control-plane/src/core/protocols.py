"""Formal protocols and lifecycle interfaces for the AI Control Plane.

All engines, schedulers, and adapters adhere strictly to these interfaces,
enabling total decoupling and high testability without concrete framework lock-in.
"""

from __future__ import annotations

import base64
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Protocol, TypeVar, runtime_checkable

InT = TypeVar("InT")
OutT = TypeVar("OutT")
StreamChunkT = TypeVar("StreamChunkT")


@dataclass(frozen=True, slots=True)
class EnvironmentSpec:
    """Specification of an isolated execution environment."""

    env_id: str
    python_version: str = "3.12"
    packages: tuple[str, ...] = ()
    extra_index_url: str | None = None
    enable_gpu: bool = False


@runtime_checkable
class BatchableEngine(Protocol[InT, OutT]):
    """Protocol for engines that can process micro-batches of requests."""

    def infer_batch(self, payloads: list[InT]) -> list[OutT]:
        """Process a batch synchronously (run inside thread pool by scheduler)."""
        ...


@runtime_checkable
class StreamableEngine(Protocol[InT, StreamChunkT]):
    """Protocol for engines that can yield asynchronous streaming frames."""

    def infer_stream(self, payload: InT) -> AsyncIterator[StreamChunkT]:
        """Yield real-time inference chunks asynchronously."""
        ...


@runtime_checkable
class LifecycleManaged(Protocol):
    """Protocol for engines or services with explicit asynchronous lifecycle bounds."""

    async def load(self) -> None:
        """Allocate resources, compile kernels, and mark ready."""
        ...

    async def unload(self) -> None:
        """Release VRAM/RAM allocations and terminate child tasks."""
        ...

    def health(self) -> dict[str, Any]:
        """Return diagnostic health and resource status."""
        ...


@runtime_checkable
class EnvironmentOrchestrator(Protocol):
    """Protocol for managing dynamic, isolated execution environments."""

    async def ensure_environment(self, spec: EnvironmentSpec) -> str:
        """Ensure the specified environment is provisioned and return its python path."""
        ...

    async def inspect_environment(self, env_id: str) -> list[dict[str, str]]:
        """List packages installed in the environment."""
        ...

    async def remove_environment(self, env_id: str) -> bool:
        """Teardown and clean up the environment resources."""
        ...


PackageEnvironmentPort = EnvironmentOrchestrator


@dataclass(slots=True)
class UniversalInferenceRequest:
    """Polymorphic Data Transfer Object for any inference input modality with declarative slot mapping."""

    inputs: Any = ""
    slots: dict[str, Any] = field(default_factory=dict)
    parameters: dict[str, Any] = field(default_factory=dict)
    binary_bytes: bytes | None = None
    binary_filename: str | None = None
    binary_mime_type: str | None = None
    binary_sha256: str | None = None
    binary_size_bytes: int = 0
    binary_files: dict[str, bytes] = field(default_factory=dict)
    binary_mime_types: dict[str, str] = field(default_factory=dict)
    auto_load: bool = True

    def __post_init__(self) -> None:
        if self.slots and not self.inputs:
            self.inputs = self.slots.get("prompt") or self.slots.get("text") or self.slots.get("source_media") or ""
        elif self.inputs and not self.slots:
            self.slots["prompt"] = self.inputs
            self.slots["text"] = self.inputs

    def get_slot(self, slot_id: str, default: Any = None) -> Any:
        """Safely fetch a typed slot value with fallback."""
        if slot_id in self.slots:
            return self.slots[slot_id]
        if slot_id in ("prompt", "text") and self.inputs:
            return self.inputs
        return default

    def get_param(self, key: str, default: Any = None) -> Any:
        """Safely fetch a parameter with default fallback."""
        return self.parameters.get(key, default) if self.parameters else default

    def as_text(self) -> str:
        """Format inputs as normalized string text."""
        val = self.get_slot("prompt") or self.get_slot("text") or self.inputs
        if isinstance(val, str):
            return val
        if isinstance(val, (list, tuple)):
            return " ".join(str(x) for x in val)
        return str(val or "")


@dataclass(slots=True)
class UniversalInferenceResponse:
    """Polymorphic Data Transfer Object for any inference output modality."""

    engine_id: str
    model_id: str
    pipeline_type: str
    modality: str
    output: Any
    device: str = "cpu"
    execution_target: str = "host-venv"
    raw_bytes: bytes | None = None
    media_type: str = "application/json"
    telemetry: dict[str, Any] = field(default_factory=dict)
    sample_rate: int = 48_000
    duration_seconds: float = 0.0
    backend_used: str = ""
    voice_used: str | None = None

    @property
    def wav_bytes(self) -> bytes | None:
        """Binary audio WAV bytes property."""
        return self.raw_bytes

    @property
    def audio_base64(self) -> str:
        """Base64 representation of audio WAV bytes."""
        if self.raw_bytes:
            return base64.b64encode(self.raw_bytes).decode("ascii")
        if isinstance(self.output, dict):
            return self.output.get("audio_base64", "")
        return ""

    @property
    def image_data_uri(self) -> str | None:
        """Data URI string for visual/image modality outputs."""
        if isinstance(self.output, dict):
            return self.output.get("image_data_uri")
        return None

    @property
    def generated_text(self) -> str | None:
        """Generated text string for language/ASR modality outputs."""
        if isinstance(self.output, dict):
            return self.output.get("generated_text") or self.output.get("text")
        return str(self.output) if isinstance(self.output, str) else None
