"""Strongly-typed ExecutionTarget Domain Model and Value Objects.

Encapsulates runtime execution environments (Host venv vs. Isolated UV Sandboxes)
and provides bidirectional equality, string serialization, and automatic promotion.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class TargetType(str, Enum):
    """Supported execution target types."""

    HOST_VENV = "host-venv"
    UV_SANDBOX = "uv-sandbox"


@dataclass(frozen=True, slots=True)
class ExecutionTarget:
    """Immutable Value Object representing an inference execution environment."""

    target_type: TargetType
    env_id: str | None = None  # None for host-venv; e.g. "vision-worker", "audio-dsp-worker"

    @classmethod
    def host(cls) -> ExecutionTarget:
        """Create a host virtual environment execution target."""
        return cls(target_type=TargetType.HOST_VENV, env_id=None)

    @classmethod
    def uv_sandbox(cls, env_id: str = "vision-worker") -> ExecutionTarget:
        """Create an isolated UV sandbox execution target."""
        return cls(target_type=TargetType.UV_SANDBOX, env_id=env_id.strip() or "vision-worker")

    @classmethod
    def from_str(
        cls,
        raw: str | ExecutionTarget | None,
        default_sandbox: str = "vision-worker",
    ) -> ExecutionTarget:
        """Parse raw string or preserve existing ExecutionTarget instance."""
        if isinstance(raw, cls):
            return raw
        val = str(raw or "").strip()
        if val.startswith("uv-sandbox:"):
            env = val.split(":", 1)[1].strip()
            return cls(target_type=TargetType.UV_SANDBOX, env_id=env or default_sandbox)
        if val in ("uv-sandbox", "sandbox"):
            return cls(target_type=TargetType.UV_SANDBOX, env_id=default_sandbox)
        return cls(target_type=TargetType.HOST_VENV, env_id=None)

    @classmethod
    def resolve(
        cls,
        requested: str | ExecutionTarget | None,
        requires_isolation: bool = False,
        default_sandbox: str = "vision-worker",
    ) -> ExecutionTarget:
        """Resolve requested target, automatically promoting to sandbox if isolation is required."""
        target = cls.from_str(requested, default_sandbox=default_sandbox)
        if requires_isolation and target.is_host:
            return cls(target_type=TargetType.UV_SANDBOX, env_id=default_sandbox)
        return target

    @property
    def is_sandbox(self) -> bool:
        """Return True if executing inside an isolated sandbox."""
        return self.target_type == TargetType.UV_SANDBOX

    @property
    def is_host(self) -> bool:
        """Return True if executing inside the host environment."""
        return self.target_type == TargetType.HOST_VENV

    def to_string(self) -> str:
        """Convert target to standard URI format."""
        if self.is_sandbox:
            return f"uv-sandbox:{self.env_id or 'vision-worker'}"
        return self.target_type.value

    def __str__(self) -> str:
        return self.to_string()

    def __repr__(self) -> str:
        return f"ExecutionTarget({self.to_string()})"

    def __eq__(self, other: object) -> bool:
        """Bidirectional equality support for string backward compatibility."""
        if isinstance(other, str):
            return self.to_string() == other
        if isinstance(other, ExecutionTarget):
            return self.target_type == other.target_type and self.env_id == other.env_id
        return False
