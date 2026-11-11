"""Enterprise Pydantic Settings & Environment Configuration."""

from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class InferenceSettings(BaseSettings):
        model_config = SettingsConfigDict(
            env_prefix="INFERENCE_", env_file=".env", extra="ignore"
        )

        app_name: str = "Enterprise Unified Multi-Modal AI Inference Cockpit Backend"
        app_version: str = "2.2.0"
        uv_workspace_root: Path = Path(
            os.environ.get(
                "INFERENCE_UV_WORKSPACE_ROOT",
                str(Path.home() / ".acc" / ".uv_isolated_envs"),
            )
        ).expanduser().resolve()
        weights_cache_root: Path = Path(
            os.environ.get(
                "INFERENCE_WEIGHTS_CACHE_ROOT",
                os.environ.get("WEIGHTS_CACHE_DIR", str(Path.home() / ".acc" / ".weights_cache")),
            )
        ).expanduser().resolve()
        uv_command_timeout_sec: float = 600.0
        pytorch_cuda_index_url: str = "https://download.pytorch.org/whl/cu124"
        tts_max_batch_size: int = 8
        tts_max_wait_ms: float = 12.0
        tts_max_queue_size: int = 256
        tts_cpu_precision: str = "fp32"
        tts_enable_streaming_onnx: bool = True
        circuit_failure_threshold: int = 5
        circuit_recovery_timeout_sec: float = 15.0
        cors_allowed_origins: list[str] = ["*"]

except ImportError:

    class InferenceSettings(BaseModel):  # type: ignore[no-redef]
        app_name: str = "Enterprise Unified Multi-Modal AI Inference Cockpit Backend"
        app_version: str = "2.2.0"
        uv_workspace_root: Path = Path(
            os.environ.get(
                "INFERENCE_UV_WORKSPACE_ROOT",
                str(Path.home() / ".acc" / ".uv_isolated_envs"),
            )
        ).expanduser().resolve()
        weights_cache_root: Path = Path(
            os.environ.get(
                "INFERENCE_WEIGHTS_CACHE_ROOT",
                os.environ.get("WEIGHTS_CACHE_DIR", str(Path.home() / ".acc" / ".weights_cache")),
            )
        ).expanduser().resolve()
        uv_command_timeout_sec: float = 600.0
        pytorch_cuda_index_url: str = "https://download.pytorch.org/whl/cu124"
        tts_max_batch_size: int = 8
        tts_max_wait_ms: float = 12.0
        tts_max_queue_size: int = 256
        tts_cpu_precision: str = "fp32"
        tts_enable_streaming_onnx: bool = True
        circuit_failure_threshold: int = 5
        circuit_recovery_timeout_sec: float = 15.0
        cors_allowed_origins: list[str] = ["*"]
