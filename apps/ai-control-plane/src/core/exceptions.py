"""Domain exception hierarchy ensuring clean HTTP Problem Details error mapping."""

from __future__ import annotations


class InferenceBackendError(Exception):
    """Base exception for all inference backend errors."""

    def __init__(self, message: str, error_code: str = "INTERNAL_INFERENCE_ERROR") -> None:
        super().__init__(message)
        self.error_code = error_code


class EnvironmentProvisionError(InferenceBackendError):
    """Raised when `uv` fails to create a venv or install packages."""

    def __init__(self, message: str) -> None:
        super().__init__(message, error_code="UV_PROVISION_FAILED")


class ModelNotLoadedError(InferenceBackendError):
    """Raised when an inference request targets an unloaded engine."""

    def __init__(self, message: str) -> None:
        super().__init__(message, error_code="MODEL_NOT_LOADED")


class InvalidInferenceRequestError(InferenceBackendError):
    """Raised when input parameters violate model or security constraints."""

    def __init__(self, message: str) -> None:
        super().__init__(message, error_code="INVALID_INFERENCE_REQUEST")


class BackpressureQueueFullError(InferenceBackendError):
    """Raised when the dynamic batch scheduler queue is saturated."""

    def __init__(self, message: str) -> None:
        super().__init__(message, error_code="QUEUE_SATURATED_BACKPRESSURE")


class CircuitBreakerOpenError(InferenceBackendError):
    """Raised when an engine's circuit breaker is open due to consecutive failures."""

    def __init__(self, message: str) -> None:
        super().__init__(message, error_code="CIRCUIT_BREAKER_OPEN")


class EvictionConfirmationRequiredError(InferenceBackendError):
    """Raised when loading a model into VRAM requires evicting idle models."""

    def __init__(
        self,
        message: str,
        required_vram_mb: int,
        current_vram_mb: int,
        budget_ceiling_mb: int,
        candidates: list[dict],
    ) -> None:
        super().__init__(message, error_code="EVICTION_CONFIRMATION_REQUIRED")
        self.required_vram_mb = required_vram_mb
        self.current_vram_mb = current_vram_mb
        self.budget_ceiling_mb = budget_ceiling_mb
        self.candidates = candidates


class ModelWeightsNotFoundError(InferenceBackendError):
    """Raised when a model's physical weight files are missing from the local weights cache."""

    def __init__(self, message: str, engine_id: str = "", missing_files: list[str] | None = None) -> None:
        super().__init__(message, error_code="MODEL_WEIGHTS_NOT_FOUND")
        self.engine_id = engine_id
        self.missing_files = missing_files or []

