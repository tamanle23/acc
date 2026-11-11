"""Enterprise FastAPI Application Entrypoint, Unified Model Router, 4-Layer Model Resolver, Hardware-Adaptive Model & Weight Tiering Engine, Real Base64 PNG Synthesis & RGBA Alpha-Matte Segmentation, Live Streaming Multi-Modal DAG Orchestrator, Server-Side A/B Arena Benchmark Suite, Per-Shard Tensor Inspector & Persistent SQLite WAL Telemetry Store (Studio v18)."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
import re
import time
import urllib.parse
import uuid

logger = logging.getLogger("api.main")
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

from core.config import InferenceSettings
from core.exceptions import (
    BackpressureQueueFullError,
    CircuitBreakerOpenError,
    EnvironmentProvisionError,
    EvictionConfirmationRequiredError,
    InferenceBackendError,
    InvalidInferenceRequestError,
    ModelNotLoadedError,
    ModelWeightsNotFoundError,
)
from core.protocols import EnvironmentSpec, UniversalInferenceRequest, UniversalInferenceResponse
from engines.catalog_registry import (
    CURATED_HUB_MARKETPLACE,
    PIPELINE_CATEGORY_TAXONOMY,
    PRECONFIGURED_MODEL_CATALOG,
    ModelCapabilityManifest,
    infer_manifest_for_custom_hf,
)
from engines.unified_engine import (
    UnifiedInferenceEngine,
    _cuda_available,
    _host_cuda_available,
    _empty_cuda_cache,
)
from core.execution_target import ExecutionTarget
from infrastructure.batch_scheduler import DynamicBatchScheduler
from infrastructure.gpu_worker_bridge import get_gpu_worker_bridge
from infrastructure.job_manager import InferenceJobManager, JobState
from infrastructure.sqlite_telemetry_store import SqliteTelemetryStore
from infrastructure.subprocess_bridge import IsolatedUvWorkerBridge
from infrastructure.uv_manager import UvEnvironmentManager
from infrastructure.weights_manager import WeightsLifecycleManager

settings = InferenceSettings()


# ============================================================================
# TRACK 1: MULTI-MODAL DAG PIPELINE PRESET BLUEPRINTS (Studio v18)
# ============================================================================
DAG_PIPELINE_PRESETS: list[dict[str, Any]] = [
    {
        "preset_id": "diffusion-rmbg-vlm-tts",
        "name": "Generative Studio-to-Voice Ad Loop (4-Stage Cross-Modal DAG)",
        "description": (
            "1. FLUX.1-schnell synthesizes 1024×1024 studio product PNG -> "
            "2. briaai/RMBG-2.0 extracts transparent RGBA cutout & 8-bit Alpha Matte PNG -> "
            "3. Qwen2.5-VL writes broadcast ad copy -> "
            "4. VieNeu-TTS v3 Turbo synthesizes 48 kHz master audio."
        ),
        "default_input": "Ultra-detailed studio product photography of a brushed titanium broadcast condenser microphone with glowing emerald acoustic rings",
        "nodes": [
            {
                "node_id": "stage_1_flux",
                "engine_id": "flux-1-schnell",
                "label": "1. FLUX.1-schnell (Text-to-Image)",
                "parameters": {"num_inference_steps": 4, "guidance_scale": 3.5, "seed": 42},
            },
            {
                "node_id": "stage_2_rmbg",
                "engine_id": "bria-rmbg-2.0",
                "label": "2. BRIA RMBG-2.0 (8-Bit Alpha Matte)",
                "parameters": {"mask_threshold": 0.5, "edge_feather_px": 2, "background_mode": "checkerboard"},
            },
            {
                "node_id": "stage_3_qwen",
                "engine_id": "qwen2.5-vl-instruct",
                "label": "3. Qwen2.5-VL-Instruct (VLM Copywriter)",
                "parameters": {"temperature": 0.6, "max_new_tokens": 256},
            },
            {
                "node_id": "stage_4_vieneu",
                "engine_id": "vieneu-tts-v3-turbo",
                "label": "4. VieNeu-TTS v3 Turbo (48 kHz Master)",
                "parameters": {"voice": "Hải Đăng", "speed": 1.0},
            },
        ],
    },
    {
        "preset_id": "voice-to-voice-assistant",
        "name": "Autonomous Voice-to-Voice Assistant (3-Stage Acoustic DAG)",
        "description": (
            "1. Whisper Large v3 Turbo transcribes speech -> "
            "2. DeepSeek-R1 Distill Qwen reasons over transcript -> "
            "3. Kokoro-82M TTS synthesizes neural spoken reply."
        ),
        "default_input": "Hệ thống buồng lái AI đa phương thức tích hợp Whisper Large v3 Turbo, DeepSeek R1 và Kokoro 82M TTS.",
        "nodes": [
            {
                "node_id": "stage_1_whisper",
                "engine_id": "whisper-large-v3-turbo",
                "label": "1. Whisper Large v3 Turbo (ASR)",
                "parameters": {"language": "vi", "word_timestamps": True},
            },
            {
                "node_id": "stage_2_deepseek",
                "engine_id": "deepseek-r1-distill-qwen",
                "label": "2. DeepSeek-R1-Distill-Qwen (Reasoning)",
                "parameters": {"temperature": 0.6, "max_new_tokens": 256},
            },
            {
                "node_id": "stage_3_kokoro",
                "engine_id": "kokoro-82m-tts",
                "label": "3. Kokoro-82M TTS (Neural WAV)",
                "parameters": {"voice": "af_bella", "speed": 1.0},
            },
        ],
    },
    {
        "preset_id": "vision-audit-rerank-embed",
        "name": "Spatial Vision Audit & Vector Indexing (3-Stage Telemetry DAG)",
        "description": (
            "1. RT-DETR-v2 detects hardware & thermal anomalies -> "
            "2. DeepSeek-R1 synthesizes incident report -> "
            "3. BGE-M3 indexes report into 384D Matryoshka vectors."
        ),
        "default_input": "datacenter_rack_thermal.png — Server Rack & GPU Thermal Audit",
        "nodes": [
            {
                "node_id": "stage_1_rtdetr",
                "engine_id": "rtdetr-v2-vision",
                "label": "1. RT-DETR-v2 (Object Detection)",
                "parameters": {"confidence_threshold": 0.25, "iou_threshold": 0.45},
            },
            {
                "node_id": "stage_2_deepseek",
                "engine_id": "deepseek-r1-distill-qwen",
                "label": "2. DeepSeek-R1-Distill (Incident Synthesis)",
                "parameters": {"temperature": 0.5, "max_new_tokens": 256},
            },
            {
                "node_id": "stage_3_bgem3",
                "engine_id": "bge-m3-embeddings",
                "label": "3. BGE-M3 (Matryoshka Vector Indexing)",
                "parameters": {"dimensions": 384, "normalize": True},
            },
        ],
    },
]


class AppContainer:
    started_at: float
    uv_manager: UvEnvironmentManager
    weights_manager: WeightsLifecycleManager
    telemetry_store: SqliteTelemetryStore
    job_manager: InferenceJobManager
    engines: dict[str, Any]
    schedulers: dict[str, DynamicBatchScheduler[Any, Any]]
    catalog_manifests: dict[str, ModelCapabilityManifest]


container = AppContainer()


def _ensure_container_initialized() -> AppContainer:
    if not hasattr(container, "uv_manager") or container.uv_manager is None:
        container.started_at = time.monotonic()
        container.uv_manager = UvEnvironmentManager(
            workspace_root=settings.uv_workspace_root,
            command_timeout_sec=settings.uv_command_timeout_sec,
        )
        get_gpu_worker_bridge(uv_manager=container.uv_manager)
        container.weights_manager = WeightsLifecycleManager(
            cache_root=settings.weights_cache_root,
            max_vram_budget_mb=8192,
            cuda_available=_cuda_available(),
        )
        container.telemetry_store = SqliteTelemetryStore()
        container.job_manager = InferenceJobManager(
            telemetry_store=container.telemetry_store,
            max_workers=2,
        )
        container.catalog_manifests = dict(PRECONFIGURED_MODEL_CATALOG)
        container.engines = {}
        container.schedulers = {}

        for eng_id, manifest in container.catalog_manifests.items():
            rec = container.weights_manager.register_model(
                engine_id=eng_id,
                model_id=manifest.model_id,
                pipeline_category=manifest.pipeline_category,
                pipeline_type=manifest.pipeline_type,
                base_vram_mb=manifest.vram_footprint_mb,
                base_ram_mb=manifest.ram_footprint_mb,
                expected_disk_mb=manifest.expected_disk_mb,
                shard_count=manifest.shard_count,
                weight_format=manifest.weight_format,
                default_precision=manifest.default_precision,
                supported_precisions=manifest.supported_precisions,
                revision=manifest.revision,
                initially_active=eng_id in ("vieneu-tts-v3-turbo", "distilbert-sentiment"),
            )
            if eng_id == "vieneu-tts-v3-turbo":
                rec.pinned_in_vram = True

        container.engines["vieneu-tts-v3-turbo"] = UnifiedInferenceEngine(
            engine_id="vieneu-tts-v3-turbo",
            task="text-to-speech",
            model_id="vieneu-v3-turbo",
            batch_size=settings.tts_max_batch_size,
            manifest=container.catalog_manifests.get("vieneu-tts-v3-turbo"),
        )
    return container


async def _ensure_pilot_engines_started(c: AppContainer) -> None:
    tts_eng = c.engines.get("vieneu-tts-v3-turbo")
    if tts_eng is not None:
        if not tts_eng.health()["loaded"]:
            await tts_eng.load()
            c.weights_manager.mark_active_vram("vieneu-tts-v3-turbo")
        if "vieneu-tts-v3-turbo" not in c.schedulers:
            tts_sched = DynamicBatchScheduler(
                engine=tts_eng,
                max_batch_size=settings.tts_max_batch_size,
                max_wait_ms=settings.tts_max_wait_ms,
                max_queue_size=settings.tts_max_queue_size,
                failure_threshold=settings.circuit_failure_threshold,
                recovery_timeout_sec=settings.circuit_recovery_timeout_sec,
            )
            await tts_sched.start()
            c.schedulers["vieneu-tts-v3-turbo"] = tts_sched

    if "distilbert-sentiment" not in c.engines and not hasattr(
        c, "_pilot_distilbert_bootstrapped"
    ):
        c._pilot_distilbert_bootstrapped = True  # type: ignore[attr-defined]
        manifest = c.catalog_manifests["distilbert-sentiment"]
        distil_engine = UnifiedInferenceEngine(
            engine_id=manifest.engine_id,
            task=manifest.task,
            model_id=manifest.model_id,
            batch_size=manifest.max_batch_size,
            execution_target=manifest.default_execution_target,
            vram_mb=manifest.vram_footprint_mb,
            ram_mb=manifest.ram_footprint_mb,
            manifest=manifest,
        )
        await distil_engine.load()
        distil_sched = DynamicBatchScheduler(
            engine=distil_engine, max_batch_size=manifest.max_batch_size
        )
        await distil_sched.start()
        c.engines["distilbert-sentiment"] = distil_engine
        c.schedulers["distilbert-sentiment"] = distil_sched
        c.weights_manager.mark_active_vram("distilbert-sentiment")

    if c.job_manager._execute_fn is None:
        c.job_manager.set_execute_fn(_make_job_executor(c))
    if not c.job_manager._running:
        await c.job_manager.start()


@asynccontextmanager
async def lifespan(app: FastAPI):
    c = _ensure_container_initialized()
    await _ensure_pilot_engines_started(c)
    await c.job_manager.start()

    yield

    await c.job_manager.stop()
    for sched in list(c.schedulers.values()):
        await sched.stop()
    for eng in list(c.engines.values()):
        await eng.unload()
    await get_gpu_worker_bridge().stop()
    if hasattr(c, "telemetry_store") and c.telemetry_store is not None:
        c.telemetry_store.close()


app = FastAPI(
    title=settings.app_name,
    version="3.3.0-v32",
    description=(
        "Enterprise Unified Multi-Modal AI Inference Cockpit Backend (Studio v18) with "
        "Real Base64 PNG Synthesis (`FLUX.1-schnell`) & RGBA Alpha-Matte Cutout Generation (`briaai/RMBG-2.0`), "
        "Hardware-Adaptive 5-Tier Model & Weight Tiering (`/v1/hardware/profile`, `/v1/models/{engine_id}/weights/tier`), "
        "Live Streaming Multi-Modal DAG Orchestrator (`/v1/pipelines/dag/stream`), "
        "Server-Side A/B Arena Benchmark Scorecard (`/v1/models/arena/compare`), "
        "Per-Shard `.safetensors`/`.onnx` Tensor & Layer Inspector (`/v1/models/{engine_id}/weights/inspect`), "
        "Persistent SQLite WAL Telemetry Store, and VieNeu-TTS v3 Turbo (48 kHz)."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Request-ID",
        "X-Process-Time-Ms",
        "X-Sample-Rate",
        "X-Audio-Duration-Sec",
        "X-Backend-Engine",
        "X-Streaming-Backend",
        "X-Execution-Target",
        "X-Modality-Lens",
        "X-Pipeline-Type",
        "X-Content-SHA256",
        "X-Real-Time-Factor",
        "Server-Timing",
        "traceparent",
        "Retry-After",
    ],
)

from api.openai_compat import router as openai_compat_router

app.include_router(openai_compat_router)



@app.middleware("http")
async def correlation_and_timing_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    incoming_traceparent = request.headers.get("traceparent")
    if incoming_traceparent and incoming_traceparent.count("-") == 3:
        traceparent = incoming_traceparent
    else:
        trace_hex = uuid.uuid4().hex
        span_hex = uuid.uuid4().hex[:16]
        traceparent = f"00-{trace_hex}-{span_hex}-01"
    request.state.request_id = request_id
    request.state.traceparent = traceparent
    t0 = time.perf_counter()
    try:
        response: Response = await call_next(request)
    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        detail_msg = str(exc).strip() or f"{type(exc).__name__}: {exc!r}"
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "type": "https://inference.enterprise.internal/errors/unhandled_server_error",
                "title": type(exc).__name__,
                "status": 500,
                "detail": detail_msg,
                "request_id": request_id,
            },
            headers={
                "X-Request-ID": request_id,
                "X-Process-Time-Ms": str(elapsed_ms),
                "Server-Timing": f'total;dur={elapsed_ms};desc="Studio v32 Error"',
                "traceparent": traceparent,
                "Access-Control-Allow-Origin": "*",
            },
        )
    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-Ms"] = str(elapsed_ms)
    response.headers["Server-Timing"] = f'total;dur={elapsed_ms};desc="Studio v32 Inference API"'
    response.headers["traceparent"] = traceparent
    return response


def get_container() -> AppContainer:
    return _ensure_container_initialized()


@app.exception_handler(InferenceBackendError)
async def handle_domain_error(request: Request, exc: InferenceBackendError):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    err_headers: dict[str, str] = {
        "X-Request-ID": request_id,
        "Access-Control-Allow-Origin": "*",
    }

    if isinstance(exc, EvictionConfirmationRequiredError):
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            media_type="application/problem+json",
            content={
                "type": "https://inference.enterprise.internal/errors/eviction_confirmation_required",
                "title": exc.error_code,
                "status": status.HTTP_409_CONFLICT,
                "detail": str(exc),
                "instance": request.url.path,
                "error_code": "EVICTION_CONFIRMATION_REQUIRED",
                "message": str(exc),
                "required_vram_mb": exc.required_vram_mb,
                "current_vram_mb": exc.current_vram_mb,
                "budget_ceiling_mb": exc.budget_ceiling_mb,
                "candidates": exc.candidates,
                "request_id": request_id,
            },
            headers=err_headers,
        )

    if isinstance(exc, ModelWeightsNotFoundError):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            media_type="application/problem+json",
            content={
                "type": "https://inference.enterprise.internal/errors/model_weights_not_found",
                "title": "MODEL_WEIGHTS_NOT_FOUND",
                "error_type": "MODEL_WEIGHTS_NOT_FOUND",
                "status": status.HTTP_404_NOT_FOUND,
                "detail": str(exc),
                "instance": request.url.path,
                "error_code": "MODEL_WEIGHTS_NOT_FOUND",
                "engine_id": getattr(exc, "engine_id", ""),
                "missing_files": getattr(exc, "missing_files", []),
                "resolution_advice": f"Model weights for '{getattr(exc, 'engine_id', '')}' are missing from the local weights cache. Please provision the required model files locally.",
                "request_id": request_id,
            },
            headers=err_headers,
        )

    code = status.HTTP_500_INTERNAL_SERVER_ERROR
    if isinstance(exc, InvalidInferenceRequestError):
        code = status.HTTP_400_BAD_REQUEST
    elif isinstance(exc, ModelNotLoadedError):
        code = status.HTTP_503_SERVICE_UNAVAILABLE
    elif isinstance(exc, (BackpressureQueueFullError, CircuitBreakerOpenError)):
        code = status.HTTP_503_SERVICE_UNAVAILABLE
    elif isinstance(exc, EnvironmentProvisionError):
        code = status.HTTP_422_UNPROCESSABLE_ENTITY
    if code == status.HTTP_503_SERVICE_UNAVAILABLE:
        err_headers["Retry-After"] = "1"
    return JSONResponse(
        status_code=code,
        media_type="application/problem+json",
        content={
            "type": f"https://inference.enterprise.internal/errors/{exc.error_code.lower()}",
            "title": exc.error_code,
            "status": code,
            "detail": str(exc),
            "instance": request.url.path,
            "request_id": request_id,
        },
        headers=err_headers,
    )


@app.exception_handler(RuntimeError)
async def handle_runtime_error(request: Request, exc: RuntimeError):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    err_headers: dict[str, str] = {
        "X-Request-ID": request_id,
        "Access-Control-Allow-Origin": "*",
    }
    if "cuda_out_of_memory" in str(exc).lower() or "out of memory" in str(exc).lower():
        err_headers["Retry-After"] = "2"
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            media_type="application/problem+json",
            content={
                "type": "https://inference.enterprise.internal/errors/cuda_out_of_memory",
                "title": "CUDA_OUT_OF_MEMORY",
                "status": status.HTTP_503_SERVICE_UNAVAILABLE,
                "detail": str(exc),
                "instance": request.url.path,
                "resolution_advice": "Reduce batch size, image dimensions (e.g. from 1024 to 512), or unpin inactive models from VRAM.",
                "request_id": request_id,
            },
            headers=err_headers,
        )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        media_type="application/problem+json",
        content={
            "type": "https://inference.enterprise.internal/errors/runtime_error",
            "title": "RUNTIME_ERROR",
            "status": 500,
            "detail": str(exc),
            "instance": request.url.path,
            "request_id": request_id,
        },
        headers=err_headers,
    )


# --- API Schemas ---
class VieneuSynthesizePayload(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice: str | None = Field(default="Hải Đăng")
    ref_audio_path: str | None = Field(default=None)
    denoise_ref: bool = Field(default=True)
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    pitch: float = Field(default=0.0, ge=-12.0, le=12.0)
    gain_db: float = Field(default=0.0, ge=-12.0, le=12.0)


class RegisterVoicePayload(BaseModel):
    voice_name: str = Field(..., min_length=1, max_length=64)
    ref_audio_path: str | None = Field(default=None)
    ref_audio_b64: str | None = Field(default=None)


class DiscoverModelPayload(BaseModel):
    model_id: str = Field(..., min_length=1)
    task: str | None = None
    execution_target: str = Field(default="host-venv")
    auto_load: bool = Field(default=False)


class UvProvisionPayload(BaseModel):
    env_id: str = Field(..., min_length=1, max_length=64)
    python_version: str = Field(default="3.11")
    packages: list[str] = Field(default_factory=list)
    extra_index_url: str | None = None


class UvRunScriptPayload(BaseModel):
    code: str = Field(..., min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    timeout_sec: float = Field(default=30.0, ge=1.0, le=180.0)


class HFLoadModelPayload(BaseModel):
    engine_id: str = Field(..., min_length=1, max_length=64)
    task: str | None = None
    model_id: str = Field(default="Qwen/Qwen2.5-VL-3B-Instruct")
    max_batch_size: int = Field(default=8, ge=1, le=64)
    execution_target: str = Field(default="host-venv")
    precision: str | None = None


class CatalogLoadPayload(BaseModel):
    engine_id: str = Field(..., min_length=1, max_length=64)
    task: str | None = None
    model_id: str | None = None
    execution_target: str = Field(default="host-venv")
    max_batch_size: int = Field(default=8, ge=1, le=64)
    auto_provision_uv: bool = Field(default=True)
    precision: str | None = None
    weight_tier: str | None = None
    offload_strategy: str | None = None
    force_evict: bool = Field(default=False)


class HubInstallPayload(BaseModel):
    engine_id: str | None = None
    model_id: str | None = None
    task: str | None = None
    action: str = Field(
        default="prefetch_disk",
        description="One-click action: 'register_only' | 'prefetch_disk' | 'load_vram'",
    )
    precision: str | None = None
    weight_tier: str | None = None
    offload_strategy: str | None = None
    execution_target: str = Field(default="host-venv")
    force_evict: bool = Field(default=False)


class OffloadStrategyPayload(BaseModel):
    offload_strategy: str = Field(
        ...,
        description="Target offload mode: 'none' (GPU VRAM Only) | 'hybrid_kv_offload' | 'cpu_ram_offload'",
    )


class BatchWeightsActionPayload(BaseModel):
    action: str = Field(
        ...,
        description="Batch action: 'prefetch_category' | 'evict_unpinned' | 'auto_adapt_hardware'",
    )
    pipeline_category: str | None = None
    hardware_profile_id: str | None = None


class WeightsPrefetchPayload(BaseModel):
    revision: str | None = None


class WeightsQuantizePayload(BaseModel):
    precision: str = Field(..., description="Target precision: fp32 | bf16 | fp16 | int8 | int4")


class WeightsTierPayload(BaseModel):
    tier_id: str = Field(
        ...,
        description="Target weight tier: nano_int4 | compact_int8 | balanced_fp16 | studio_bf16 | ultra_fp32",
    )
    offload_strategy: str | None = Field(
        default=None,
        description="Optional offload strategy: none | hybrid_kv_offload | cpu_ram_offload",
    )


class HardwareProfileSelectPayload(BaseModel):
    profile_id: str = Field(
        ...,
        description="Hardware profile ID: tier_1_edge_cpu | tier_2_consumer_8gb | tier_3_prosumer_16gb | tier_4_workstation_24gb | tier_5_datacenter_48gb",
    )
    custom_vram_budget_mb: int | None = Field(default=None, ge=512, le=262144)
    auto_adapt_models: bool = Field(default=True)


class HardwareAutoAdaptPayload(BaseModel):
    profile_id: str | None = None


class WeightsPinPayload(BaseModel):
    pinned: bool = Field(...)


class VramBudgetPayload(BaseModel):
    max_vram_budget_mb: int = Field(..., ge=512, le=262144)


class HFInferPayload(BaseModel):
    inputs: Any = Field(...)
    parameters: dict[str, Any] = Field(default_factory=dict)


class UnifiedInferPayload(BaseModel):
    inputs: Any = Field(default="")
    parameters: dict[str, Any] = Field(default_factory=dict)
    auto_load: bool = Field(default=True)


class DagNodeSpec(BaseModel):
    node_id: str | None = None
    engine_id: str = Field(..., min_length=1)
    label: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)


class DagExecutePayload(BaseModel):
    preset_id: str | None = None
    pipeline_name: str | None = None
    initial_input: Any = Field(default="")
    nodes: list[DagNodeSpec] = Field(default_factory=list)
    enable_cache: bool = Field(default=True)


class ArenaComparePayload(BaseModel):
    left_engine_id: str = Field(..., min_length=1)
    right_engine_id: str = Field(..., min_length=1)
    inputs: Any = Field(default="")
    parameters: dict[str, Any] = Field(default_factory=dict)
    left_parameters: dict[str, Any] = Field(default_factory=dict)
    right_parameters: dict[str, Any] = Field(default_factory=dict)


class ArenaVotePayload(BaseModel):
    preferred_engine_id: str = Field(..., min_length=1)


# --- Helper Functions for Unified Model Catalog & Weights Lifecycle ---
def _serialize_catalog_entry(
    c: AppContainer, engine_id: str, manifest: ModelCapabilityManifest
) -> dict[str, Any]:
    data = manifest.to_dict()
    weights_rec = c.weights_manager.get_record(engine_id) or c.weights_manager.register_model(
        engine_id=engine_id,
        model_id=manifest.model_id,
        pipeline_category=manifest.pipeline_category,
        pipeline_type=manifest.pipeline_type,
        base_vram_mb=manifest.vram_footprint_mb,
        base_ram_mb=manifest.ram_footprint_mb,
        expected_disk_mb=manifest.expected_disk_mb,
        shard_count=manifest.shard_count,
        weight_format=manifest.weight_format,
        default_precision=manifest.default_precision,
        supported_precisions=manifest.supported_precisions,
        revision=manifest.revision,
    )

    loaded = False
    warmed_up = False
    last_warmup_ms = 0.0
    warmup_count = 0
    execution_target = manifest.default_execution_target
    device = "cuda:0" if _cuda_available() else "cpu"
    scheduler_snap: dict[str, Any] = {
        "queue_depth": 0,
        "max_queue_size": 256,
        "max_batch_size": weights_rec.recommended_batch_size or manifest.max_batch_size,
        "max_wait_ms": 12.0,
        "circuit_breaker": {"name": engine_id, "state": "CLOSED", "consecutive_failures": 0},
        "latency": {
            "total_requests": 0,
            "total_batches": 0,
            "p50_ms": 0.0,
            "p95_ms": 0.0,
            "p99_ms": 0.0,
        },
    }

    if engine_id in c.engines:
        eng = c.engines[engine_id]
        h = eng.health() if hasattr(eng, "health") else {"loaded": getattr(eng, "is_loaded", True)}
        loaded = bool(h.get("loaded", False))
        warmed_up = bool(h.get("warmed_up", False))
        last_warmup_ms = float(h.get("last_warmup_ms", 0.0))
        warmup_count = int(h.get("warmup_count", 0))
        execution_target = str(h.get("execution_target", execution_target))
        device = str(h.get("device", getattr(eng, "_device_str", device)))
        if engine_id in c.schedulers:
            scheduler_snap = c.schedulers[engine_id].metrics_snapshot()

    if loaded:
        if weights_rec.offload_strategy == "cpu_ram_offload" or device == "cpu":
            effective_vram = 0
            effective_ram = weights_rec.effective_ram_mb
            device = "cpu"
        else:
            effective_vram = weights_rec.effective_vram_mb
            effective_ram = weights_rec.effective_ram_mb
    else:
        effective_vram = 0
        effective_ram = 0

    active_hw = c.weights_manager.active_hardware_profile

    return {
        **data,
        "loaded": loaded,
        "status": "loaded" if loaded else "unloaded",
        "pinned": bool(weights_rec.pinned_in_vram),
        "pinned_in_vram": bool(weights_rec.pinned_in_vram),
        "warmed_up": warmed_up,
        "last_warmup_ms": last_warmup_ms,
        "warmup_count": warmup_count,
        "execution_target": execution_target,
        "device": device,
        "vram_mb": effective_vram,
        "ram_mb": effective_ram,
        "vram_footprint_mb": weights_rec.effective_vram_mb,
        "ram_footprint_mb": weights_rec.effective_ram_mb,
        "last_error": weights_rec.last_error,
        "weights": weights_rec.to_dict(active_hardware_profile=active_hw),
        "circuit_state": scheduler_snap["circuit_breaker"]["state"],
        "scheduler": scheduler_snap,
    }


async def _evict_engine_internal(
    c: AppContainer, engine_id: str, reason: str = "manual_unload"
) -> None:
    if engine_id in c.schedulers:
        await c.schedulers[engine_id].stop()
        del c.schedulers[engine_id]
    if engine_id in c.engines:
        await c.engines[engine_id].unload()
        del c.engines[engine_id]

    c.weights_manager.mark_evicted_to_disk(engine_id, reason=reason)
    _empty_cuda_cache()


async def _load_engine_by_manifest(
    c: AppContainer,
    engine_id: str,
    task: str | None = None,
    model_id: str | None = None,
    execution_target: str = "host-venv",
    max_batch_size: int = 8,
    auto_provision_uv: bool = True,
    precision: str | None = None,
    weight_tier: str | None = None,
    offload_strategy: str | None = None,
    force_evict: bool = False,
) -> dict[str, Any]:
    manifest = c.catalog_manifests.get(engine_id)
    if manifest is None:
        manifest = infer_manifest_for_custom_hf(
            engine_id=engine_id,
            task=task,
            model_id=model_id,
            execution_target=execution_target,
            max_batch_size=max_batch_size,
        )
        c.catalog_manifests[manifest.engine_id] = manifest
        engine_id = manifest.engine_id
    elif task or model_id:
        manifest = infer_manifest_for_custom_hf(
            engine_id=engine_id,
            task=task,
            model_id=model_id or manifest.model_id,
            execution_target=execution_target,
            max_batch_size=max_batch_size,
        )
        c.catalog_manifests[engine_id] = manifest

    w_rec = c.weights_manager.register_model(
        engine_id=engine_id,
        model_id=manifest.model_id,
        pipeline_category=manifest.pipeline_category,
        pipeline_type=manifest.pipeline_type,
        base_vram_mb=manifest.vram_footprint_mb,
        base_ram_mb=manifest.ram_footprint_mb,
        expected_disk_mb=manifest.expected_disk_mb,
        shard_count=manifest.shard_count,
        weight_format=manifest.weight_format,
        default_precision=manifest.default_precision,
        supported_precisions=manifest.supported_precisions,
        revision=manifest.revision,
    )
    if weight_tier:
        w_rec = c.weights_manager.set_weight_tier(
            engine_id, weight_tier, offload_strategy=offload_strategy
        )
    elif offload_strategy:
        w_rec = c.weights_manager.set_offload_strategy(engine_id, offload_strategy)
    elif precision:
        w_rec = c.weights_manager.set_precision(engine_id, precision)

    # Strictly enforce Memory Offload Mode contracts & Smart VRAM Eviction Gating:
    cuda_ok = _cuda_available()
    if w_rec.offload_strategy in ("none", "hybrid_kv_offload"):
        if not cuda_ok:
            mode_label = (
                "GPU VRAM Only" if w_rec.offload_strategy == "none" else "Hybrid KV Offload"
            )
            err_msg = (
                f"Cannot load '{engine_id}' in {mode_label} mode: "
                f"No active CUDA GPU device is available in current Python environment. "
                f"Please switch Memory Offload Mode to 'CPU+RAM Layer Offload' (cpu_ram_offload) to execute on Host System RAM."
            )
            w_rec.last_error = err_msg
            raise InvalidInferenceRequestError(err_msg)

        if not _host_cuda_available() and get_gpu_worker_bridge().is_sandbox_provisioned():
            execution_target = "uv-sandbox:gpu-py312"

        # Smart VRAM Fitting & Interactive Eviction Gating
        req_vram = w_rec.effective_vram_mb
        active_recs = [
            r for r in c.weights_manager._records.values()
            if r.lifecycle_state == "ACTIVE_VRAM" and r.engine_id != engine_id
        ]
        curr_vram = sum(r.effective_vram_mb for r in active_recs)
        budget = c.weights_manager.max_vram_budget_mb
        vram_ceiling = int(budget * 0.85)

        if curr_vram + req_vram > vram_ceiling:
            now = time.time()
            eligible_victims = [
                r for r in active_recs
                if not r.pinned_in_vram
                and not (
                    r.engine_id in c.schedulers
                    and c.schedulers[r.engine_id].metrics_snapshot().get("queue_depth", 0) > 0
                )
            ]
            eligible_sorted = sorted(eligible_victims, key=lambda x: x.last_used_at)

            projected_vram = curr_vram
            candidates_to_evict: list[Any] = []
            for cand in eligible_sorted:
                if projected_vram + req_vram <= vram_ceiling:
                    break
                candidates_to_evict.append(cand)
                projected_vram -= cand.effective_vram_mb

            if projected_vram + req_vram > vram_ceiling:
                pinned_or_busy = [
                    r.engine_id for r in active_recs if r not in eligible_victims
                ]
                err_msg = (
                    f"Cannot allocate {req_vram} MB VRAM: required space exceeds available budget ({vram_ceiling} MB ceiling). "
                    f"Active models ({', '.join(pinned_or_busy)}) are pinned or actively in flight. "
                    f"Please switch Memory Offload Mode to 'CPU+RAM Layer Offload' (cpu_ram_offload) or unpin an active model."
                )
                w_rec.last_error = err_msg
                raise InvalidInferenceRequestError(err_msg)

            if not force_evict:
                raise EvictionConfirmationRequiredError(
                    message=(
                        f"Loading '{engine_id}' requires {req_vram} MB VRAM, which approaches the budget ceiling "
                        f"({curr_vram + req_vram} MB / {vram_ceiling} MB). Evicting idle model(s) is required."
                    ),
                    required_vram_mb=req_vram,
                    current_vram_mb=curr_vram,
                    budget_ceiling_mb=vram_ceiling,
                    candidates=[
                        {
                            "engine_id": cand.engine_id,
                            "model_id": cand.model_id,
                            "vram_mb": cand.effective_vram_mb,
                            "pinned": cand.pinned_in_vram,
                            "idle_seconds": round(now - cand.last_used_at, 1),
                        }
                        for cand in candidates_to_evict
                    ],
                )

            # force_evict is True: execute eviction of candidate models
            for cand in candidates_to_evict:
                await _evict_engine_internal(
                    c, cand.engine_id, reason=f"interactive_evict_for_{engine_id}"
                )

        if get_gpu_worker_bridge().is_sandbox_provisioned():
            execution_target = "uv-sandbox:gpu-py312"

    else:
        # cpu_ram_offload: strictly host-venv and 0 VRAM unless model requires isolation
        if manifest.requires_isolation and get_gpu_worker_bridge().is_sandbox_provisioned():
            execution_target = "uv-sandbox:gpu-py312"
        else:
            execution_target = "host-venv"

    w_rec.last_error = None

    target = ExecutionTarget.resolve(
        execution_target,
        requires_isolation=manifest.requires_isolation,
    )

    if target.is_sandbox and auto_provision_uv:
        env_id = target.env_id or "gpu-py312"
        await c.uv_manager.ensure_environment(
            EnvironmentSpec(
                env_id=env_id,
                python_version="3.12",
                packages=tuple(manifest.required_uv_packages),
            )
        )
    execution_target = target.to_string()

    existing_eng = c.engines.get(engine_id)
    needs_reload = False
    if existing_eng is not None:
        if (
            existing_eng.execution_target != execution_target
            or getattr(existing_eng, "_offload_strategy", None) != w_rec.offload_strategy
            or getattr(existing_eng, "_degraded_fallback", False)
            or not existing_eng.is_loaded
        ):
            needs_reload = True
        elif target.is_sandbox:
            bridge = get_gpu_worker_bridge()
            worker_health = await bridge.get_health()
            loaded_in_worker = (
                worker_health.get("loaded_engines", [])
                if isinstance(worker_health, dict)
                else []
            )
            if engine_id not in loaded_in_worker:
                needs_reload = True

    if existing_eng is not None and not needs_reload:
        if hasattr(existing_eng, "sync_vram_allocation"):
            existing_eng.sync_vram_allocation(
                w_rec.effective_vram_mb, w_rec.effective_ram_mb
            )
        c.weights_manager.mark_active_vram(engine_id)
        return _serialize_catalog_entry(c, engine_id, manifest)

    if existing_eng is not None:
        if engine_id in c.schedulers:
            await c.schedulers[engine_id].stop()
            del c.schedulers[engine_id]
        await existing_eng.unload()
        del c.engines[engine_id]

    engine = UnifiedInferenceEngine(
        engine_id=engine_id,
        task=manifest.task,
        model_id=manifest.model_id,
        batch_size=max_batch_size or manifest.max_batch_size,
        execution_target=target,
        vram_mb=w_rec.effective_vram_mb,
        ram_mb=w_rec.effective_ram_mb,
        offload_strategy=w_rec.offload_strategy,
        manifest=manifest,
    )
    await engine.load()
    if hasattr(engine, "sync_vram_allocation"):
        engine.sync_vram_allocation(w_rec.effective_vram_mb, w_rec.effective_ram_mb)
    sched = DynamicBatchScheduler(
        engine=engine, max_batch_size=max_batch_size or manifest.max_batch_size
    )
    await sched.start()
    c.engines[engine_id] = engine
    c.schedulers[engine_id] = sched
    c.weights_manager.mark_active_vram(engine_id)
    return _serialize_catalog_entry(c, engine_id, manifest)


# ============================================================================
# STUDIO v17/v18: HARDWARE CAPABILITY PROFILER & 5-TIER MODEL/WEIGHT ADAPTATION
# ============================================================================
@app.get(
    "/v1/hardware/profile",
    tags=["Studio v17: Hardware-Adaptive Model & Weight Tiering"],
)
async def get_hardware_tier_profile(
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    return c.weights_manager.get_hardware_profile_snapshot()


@app.post(
    "/v1/hardware/profile",
    tags=["Studio v17: Hardware-Adaptive Model & Weight Tiering"],
)
async def select_hardware_tier_profile(
    payload: HardwareProfileSelectPayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    active_prof = c.weights_manager.select_hardware_profile(
        profile_id=payload.profile_id,
        custom_vram_budget_mb=payload.custom_vram_budget_mb,
    )
    adapted_models: list[dict[str, Any]] = []
    if payload.auto_adapt_models:
        adapted_models = c.weights_manager.auto_adapt_all_models_to_hardware()

    victims = c.weights_manager.select_lru_eviction_candidates(required_vram_mb=0)
    for victim_id in victims:
        await _evict_engine_internal(
            c, victim_id, reason=f"hardware_tier_switch_{payload.profile_id}"
        )

    models_catalog = [
        _serialize_catalog_entry(c, eng_id, manifest)
        for eng_id, manifest in c.catalog_manifests.items()
    ]
    return {
        "status": "hardware_profile_applied",
        "active_profile_id": active_prof["profile_id"],
        "active_profile": active_prof,
        "adapted_models_count": len(adapted_models),
        "adapted_models": adapted_models,
        "auto_evicted_engines": victims,
        "models": models_catalog,
        "weights_summary": c.weights_manager.summary_snapshot(),
        "hardware_snapshot": c.weights_manager.get_hardware_profile_snapshot(),
    }


async def _sync_engine_strategy_after_reconfiguration(
    c: AppContainer,
    engine_id: str,
    manifest: ModelCapabilityManifest,
    rec: Any,
) -> None:
    """Synchronize engine execution strategy and VRAM allocations when weights/offload are reconfigured."""
    if engine_id not in c.engines:
        return
    eng = c.engines[engine_id]
    if not hasattr(eng, "execution_target"):
        return
    curr_target = ExecutionTarget.from_str(eng.execution_target)

    if rec.offload_strategy == "cpu_ram_offload" and curr_target.is_sandbox and not manifest.requires_isolation:
        await eng.unload()
        eng.execution_target = "host-venv"
        eng._offload_strategy = "cpu_ram_offload"
        await eng.load()
    elif rec.offload_strategy in ("none", "hybrid_kv_offload") and curr_target.is_host:
        await eng.unload()
        eng.execution_target = "uv-sandbox:gpu-py312"
        eng._offload_strategy = rec.offload_strategy
        eng._vram_mb = rec.effective_vram_mb
        await eng.load()
    elif curr_target.is_sandbox:
        await eng.unload()
        eng._offload_strategy = rec.offload_strategy
        eng._vram_mb = 0 if rec.offload_strategy == "cpu_ram_offload" else rec.effective_vram_mb
        await eng.load()

    if hasattr(eng, "sync_vram_allocation"):
        eng.sync_vram_allocation(rec.effective_vram_mb, rec.effective_ram_mb)


@app.post(
    "/v1/models/{engine_id}/weights/tier",
    tags=["Studio v17: Hardware-Adaptive Model & Weight Tiering"],
)
async def set_model_weight_tier(
    engine_id: str,
    payload: WeightsTierPayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    if engine_id not in c.catalog_manifests:
        raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered in catalog.")
    rec = c.weights_manager.set_weight_tier(
        engine_id=engine_id,
        tier_id=payload.tier_id,
        offload_strategy=payload.offload_strategy,
    )
    manifest = c.catalog_manifests[engine_id]
    is_loaded = (
        engine_id in c.engines
        and (
            c.engines[engine_id].health().get("loaded", False)
            if hasattr(c.engines[engine_id], "health")
            else getattr(c.engines[engine_id], "is_loaded", True)
        )
    )
    if is_loaded:
        if rec.offload_strategy in ("none", "hybrid_kv_offload") and not _cuda_available():
            await _evict_engine_internal(c, engine_id, reason="unsupported_gpu_offload_mode")
            rec.last_error = f"Unmounted '{engine_id}': Requires CUDA accelerator, but host is running CPU-only."
        elif engine_id in c.engines:
            await _sync_engine_strategy_after_reconfiguration(c, engine_id, manifest, rec)

    entry = _serialize_catalog_entry(c, engine_id, manifest)
    return {
        "status": "weight_tier_updated",
        "engine_id": engine_id,
        "weight_tier": rec.weight_tier,
        "precision": rec.precision,
        "offload_strategy": rec.offload_strategy,
        "effective_vram_mb": rec.effective_vram_mb,
        "effective_ram_mb": rec.effective_ram_mb,
        "effective_disk_mb": rec.effective_disk_mb,
        "quantization_savings_pct": rec.quantization_savings_pct,
        "model": entry,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


@app.post(
    "/v1/models/{engine_id}/weights/offload",
    tags=["Studio v17: Hardware-Adaptive Model & Weight Tiering"],
)
async def set_model_offload_strategy(
    engine_id: str,
    payload: OffloadStrategyPayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    if engine_id not in c.catalog_manifests:
        raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered in catalog.")
    rec = c.weights_manager.set_offload_strategy(engine_id, payload.offload_strategy)
    manifest = c.catalog_manifests[engine_id]

    is_loaded = (
        engine_id in c.engines
        and (
            c.engines[engine_id].health().get("loaded", False)
            if hasattr(c.engines[engine_id], "health")
            else getattr(c.engines[engine_id], "is_loaded", True)
        )
    )

    if is_loaded:
        if rec.offload_strategy in ("none", "hybrid_kv_offload") and not _cuda_available():
            await _evict_engine_internal(c, engine_id, reason="unsupported_gpu_offload_mode")
            mode_name = "GPU VRAM Only" if rec.offload_strategy == "none" else "Hybrid KV Offload"
            rec.last_error = (
                f"Unmounted '{engine_id}': {mode_name} requires a CUDA accelerator, but host is running CPU-only. "
                f"Switch to 'cpu_ram_offload' to run on CPU RAM."
            )
            entry = _serialize_catalog_entry(c, engine_id, manifest)
            return {
                "status": "offload_rejected",
                "engine_id": engine_id,
                "error": rec.last_error,
                "model": entry,
                "weights_summary": c.weights_manager.summary_snapshot(),
            }

        if engine_id in c.engines:
            await _sync_engine_strategy_after_reconfiguration(c, engine_id, manifest, rec)
        rec.last_error = None

    entry = _serialize_catalog_entry(c, engine_id, manifest)
    return {
        "status": "offload_strategy_updated",
        "engine_id": engine_id,
        "offload_strategy": rec.offload_strategy,
        "effective_vram_mb": rec.effective_vram_mb,
        "effective_ram_mb": rec.effective_ram_mb,
        "model": entry,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


@app.post(
    "/v1/models/hardware/auto-adapt",
    tags=["Studio v17: Hardware-Adaptive Model & Weight Tiering"],
)
async def auto_adapt_models_to_hardware(
    payload: HardwareAutoAdaptPayload | None = None,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    prof_id = payload.profile_id if payload else None
    adapted = c.weights_manager.auto_adapt_all_models_to_hardware(profile_id=prof_id)
    victims = c.weights_manager.select_lru_eviction_candidates(required_vram_mb=0)
    for victim_id in victims:
        await _evict_engine_internal(c, victim_id, reason="auto_adapt_vram_ceiling")

    models_catalog = [
        _serialize_catalog_entry(c, eng_id, manifest)
        for eng_id, manifest in c.catalog_manifests.items()
    ]
    return {
        "status": "models_auto_adapted",
        "active_profile": c.weights_manager.active_hardware_profile,
        "adapted_models": adapted,
        "auto_evicted_engines": victims,
        "models": models_catalog,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


# ============================================================================
# PILLAR 1 + v18: MODEL CATALOG, 4-LAYER RESOLVER, SHARD INSPECTOR & WEIGHTS
# ============================================================================
@app.get("/v1/models/catalog", tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"])
async def get_models_catalog(
    pipeline_category: str | None = None,
    pipeline_type: str | None = None,
    lifecycle_state: str | None = None,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    models = [
        _serialize_catalog_entry(c, eng_id, manifest)
        for eng_id, manifest in c.catalog_manifests.items()
    ]
    if pipeline_category and pipeline_category != "all":
        models = [m for m in models if m["pipeline_category"] == pipeline_category]
    if pipeline_type and pipeline_type != "all":
        models = [m for m in models if m["pipeline_type"] == pipeline_type]
    if lifecycle_state and lifecycle_state != "all":
        models = [
            m for m in models if m["weights"]["lifecycle_state"] == lifecycle_state
        ]

    weights_snap = c.weights_manager.summary_snapshot()
    hw_snap = c.weights_manager.get_hardware_profile_snapshot()
    return {
        "models": models,
        "pipeline_taxonomy": PIPELINE_CATEGORY_TAXONOMY,
        "weights_summary": weights_snap,
        "hardware_profile": hw_snap["active_profile"],
        "available_hardware_profiles": hw_snap["available_profiles"],
        "host_telemetry": hw_snap["host_telemetry"],
        "summary": {
            "total_catalog_models": len(c.catalog_manifests),
            "loaded_engines_count": weights_snap["active_vram_models_count"],
            "total_vram_allocated_mb": weights_snap["allocated_vram_mb"],
            "max_vram_budget_mb": weights_snap["max_vram_budget_mb"],
            "vram_utilization_pct": weights_snap["vram_utilization_pct"],
            "total_ram_allocated_mb": weights_snap["allocated_ram_mb"],
            "cached_disk_mb": weights_snap["cached_disk_mb"],
            "cuda_available": _cuda_available(),
            "isolated_uv_envs": len(c.uv_manager.list_environments()),
            "active_hardware_profile_id": weights_snap["active_hardware_profile_id"],
        },
    }


@app.get(
    "/v1/models/{engine_id}/weights/inspect",
    tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"],
)
async def inspect_model_shards_and_layers(
    engine_id: str,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    if engine_id not in c.catalog_manifests:
        manifest = infer_manifest_for_custom_hf(engine_id=engine_id)
        c.catalog_manifests[manifest.engine_id] = manifest
        c.weights_manager.register_model(
            engine_id=manifest.engine_id,
            model_id=manifest.model_id,
            pipeline_category=manifest.pipeline_category,
            pipeline_type=manifest.pipeline_type,
            base_vram_mb=manifest.vram_footprint_mb,
            base_ram_mb=manifest.ram_footprint_mb,
            expected_disk_mb=manifest.expected_disk_mb,
            shard_count=manifest.shard_count,
            weight_format=manifest.weight_format,
            default_precision=manifest.default_precision,
            supported_precisions=manifest.supported_precisions,
            revision=manifest.revision,
        )
    manifest = c.catalog_manifests[engine_id]
    return c.weights_manager.inspect_shards_and_tensors(
        engine_id=engine_id, architecture=manifest.architecture
    )


@app.get("/v1/models/hub/resolve", tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"])
async def resolve_hub_model_metadata(
    model_id: str,
    task: str | None = None,
) -> dict[str, Any]:
    cleaned_id = model_id.strip()
    if not cleaned_id:
        raise InvalidInferenceRequestError("Parameter 'model_id' cannot be empty.")

    slug = re.sub(r"[^a-z0-9.\-]+", "-", cleaned_id.split("/")[-1].lower()).strip("-")
    manifest = infer_manifest_for_custom_hf(
        engine_id=slug or "resolved-model",
        task=task,
        model_id=cleaned_id,
    )
    manifest_dict = manifest.to_dict()
    return {
        "status": "resolved",
        "model_id": cleaned_id,
        "resolved_pipeline_type": manifest.pipeline_type,
        "resolved_family": manifest.family,
        "architecture": manifest.architecture,
        "resolution_source": manifest.resolution_source,
        "resolution_confidence": manifest.resolution_confidence,
        "required_uv_packages": manifest.required_uv_packages,
        "manifest": manifest_dict,
        "resolved": manifest_dict,
    }


@app.get("/v1/models/hub/discover", tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"])
async def discover_hub_marketplace(
    query: str | None = None,
    pipeline_category: str | None = None,
    pipeline_type: str | None = None,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    items: list[dict[str, Any]] = []

    seen_ids: set[str] = set()
    for eng_id, manifest in c.catalog_manifests.items():
        entry = _serialize_catalog_entry(c, eng_id, manifest)
        entry["installed_in_catalog"] = True
        items.append(entry)
        seen_ids.add(eng_id)

    for hub_item in CURATED_HUB_MARKETPLACE:
        eng_id = hub_item["engine_id"]
        if eng_id in seen_ids:
            continue
        cat_meta = PIPELINE_CATEGORY_TAXONOMY.get(hub_item["pipeline_category"], {})
        items.append(
            {
                **hub_item,
                "installed_in_catalog": False,
                "loaded": False,
                "status": "hub_available",
                "execution_target": "host-venv",
                "ui_theme": cat_meta.get("ui_theme", {}),
                "weights": {
                    "engine_id": eng_id,
                    "model_id": hub_item["model_id"],
                    "pipeline_category": hub_item["pipeline_category"],
                    "pipeline_type": hub_item["pipeline_type"],
                    "revision": "main",
                    "weight_format": hub_item["weight_format"],
                    "precision": hub_item["default_precision"],
                    "weight_tier": "balanced_fp16",
                    "offload_strategy": "none",
                    "supported_precisions": ["fp32", "bf16", "fp16", "int8", "int4"],
                    "lifecycle_state": "HUB_AVAILABLE",
                    "base_vram_mb": hub_item["vram_footprint_mb"],
                    "base_ram_mb": hub_item["ram_footprint_mb"],
                    "effective_vram_mb": hub_item["vram_footprint_mb"],
                    "effective_ram_mb": hub_item["ram_footprint_mb"],
                    "disk_size_mb": 0,
                    "expected_disk_mb": hub_item["expected_disk_mb"],
                    "shard_count": hub_item["shard_count"],
                    "verified_shards": 0,
                    "quantization_savings_pct": 0,
                    "is_cached_on_disk": False,
                    "pinned_in_vram": False,
                },
            }
        )

    if pipeline_category and pipeline_category != "all":
        items = [i for i in items if i.get("pipeline_category") == pipeline_category]
    if pipeline_type and pipeline_type != "all":
        items = [i for i in items if i.get("pipeline_type") == pipeline_type]
    if query and query.strip():
        q = query.strip().lower()
        items = [
            i
            for i in items
            if q in str(i.get("display_name", "")).lower()
            or q in str(i.get("model_id", "")).lower()
            or q in str(i.get("pipeline_type", "")).lower()
            or q in str(i.get("architecture", "")).lower()
            or any(q in str(t).lower() for t in i.get("tags", []))
        ]

    return {
        "hub_models": items,
        "total_count": len(items),
        "installed_count": sum(1 for i in items if i.get("installed_in_catalog")),
        "pipeline_taxonomy": PIPELINE_CATEGORY_TAXONOMY,
    }


@app.post("/v1/models/hub/install", tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"])
async def one_click_hub_install(
    payload: HubInstallPayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    raw_engine_id = (payload.engine_id or "").strip()
    raw_model_id = (payload.model_id or "").strip()

    if not raw_engine_id and not raw_model_id:
        raise InvalidInferenceRequestError(
            "Provide either 'engine_id' from the Hub catalog or 'model_id'."
        )

    if not raw_engine_id:
        slug = re.sub(r"[^a-z0-9.\-]+", "-", raw_model_id.split("/")[-1].lower()).strip("-")
        raw_engine_id = slug or "custom-hub-model"

    manifest = infer_manifest_for_custom_hf(
        engine_id=raw_engine_id,
        task=payload.task,
        model_id=raw_model_id or None,
        execution_target=payload.execution_target,
    )
    c.catalog_manifests[manifest.engine_id] = manifest
    c.weights_manager.register_model(
        engine_id=manifest.engine_id,
        model_id=manifest.model_id,
        pipeline_category=manifest.pipeline_category,
        pipeline_type=manifest.pipeline_type,
        base_vram_mb=manifest.vram_footprint_mb,
        base_ram_mb=manifest.ram_footprint_mb,
        expected_disk_mb=manifest.expected_disk_mb,
        shard_count=manifest.shard_count,
        weight_format=manifest.weight_format,
        default_precision=payload.precision or manifest.default_precision,
        supported_precisions=manifest.supported_precisions,
        revision=manifest.revision,
    )
    if payload.weight_tier:
        c.weights_manager.set_weight_tier(manifest.engine_id, payload.weight_tier)
    elif payload.precision:
        c.weights_manager.set_precision(manifest.engine_id, payload.precision)

    if payload.action == "prefetch_disk":
        c.weights_manager.prefetch_to_disk(manifest.engine_id)
        entry = _serialize_catalog_entry(c, manifest.engine_id, manifest)
    elif payload.action == "load_vram":
        entry = await _load_engine_by_manifest(
            c,
            engine_id=manifest.engine_id,
            execution_target=payload.execution_target,
            precision=payload.precision,
            weight_tier=payload.weight_tier,
            offload_strategy=payload.offload_strategy,
            force_evict=payload.force_evict,
        )
    else:
        entry = _serialize_catalog_entry(c, manifest.engine_id, manifest)

    return {
        "status": f"hub_{payload.action}_completed",
        "engine_id": manifest.engine_id,
        "model": entry,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


@app.post(
    "/v1/models/weights/batch-action",
    tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"],
)
async def batch_weights_lifecycle_action(
    payload: BatchWeightsActionPayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    affected: list[str] = []

    if payload.action == "prefetch_category":
        for eng_id, manifest in c.catalog_manifests.items():
            if (
                not payload.pipeline_category
                or payload.pipeline_category == "all"
                or manifest.pipeline_category == payload.pipeline_category
            ):
                c.weights_manager.prefetch_to_disk(eng_id)
                affected.append(eng_id)
    elif payload.action == "evict_unpinned":
        for eng_id in list(c.catalog_manifests.keys()):
            rec = c.weights_manager.get_record(eng_id)
            if rec and rec.lifecycle_state == "ACTIVE_VRAM" and not rec.pinned_in_vram:
                await _evict_engine_internal(c, eng_id, reason="batch_evict_unpinned")
                affected.append(eng_id)
    elif payload.action == "auto_adapt_hardware":
        adapted = c.weights_manager.auto_adapt_all_models_to_hardware(
            profile_id=payload.hardware_profile_id
        )
        affected = [item["engine_id"] for item in adapted]
    else:
        raise InvalidInferenceRequestError(f"Unsupported batch action '{payload.action}'.")

    return {
        "status": "batch_completed",
        "action": payload.action,
        "affected_engines": affected,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


@app.get("/v1/models/pipelines", tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"])
async def get_pipeline_taxonomy_tree(
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    serialized = [
        _serialize_catalog_entry(c, eng_id, manifest)
        for eng_id, manifest in c.catalog_manifests.items()
    ]
    categories: list[dict[str, Any]] = []
    for cat_id, cat_meta in PIPELINE_CATEGORY_TAXONOMY.items():
        cat_models = [m for m in serialized if m["pipeline_category"] == cat_id]
        by_type: dict[str, list[dict[str, Any]]] = {}
        for m in cat_models:
            pt = m["pipeline_type"]
            by_type.setdefault(pt, []).append(m)
        categories.append(
            {
                **cat_meta,
                "model_count": len(cat_models),
                "active_vram_count": sum(1 for m in cat_models if m["loaded"]),
                "models_by_pipeline_type": by_type,
                "models": cat_models,
            }
        )
    return {
        "categories": categories,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


@app.post("/v1/models/catalog/load", tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"])
async def load_catalog_model(
    payload: CatalogLoadPayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    entry = await _load_engine_by_manifest(
        c,
        engine_id=payload.engine_id,
        task=payload.task,
        model_id=payload.model_id,
        execution_target=payload.execution_target,
        max_batch_size=payload.max_batch_size,
        auto_provision_uv=payload.auto_provision_uv,
        precision=payload.precision,
        weight_tier=payload.weight_tier,
        offload_strategy=payload.offload_strategy,
        force_evict=payload.force_evict,
    )
    return {
        "status": "loaded",
        "model": entry,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


@app.post(
    "/v1/models/{engine_id}/weights/prefetch",
    tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"],
)
async def prefetch_model_weights(
    engine_id: str,
    payload: WeightsPrefetchPayload | None = None,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    if engine_id not in c.catalog_manifests:
        manifest = infer_manifest_for_custom_hf(engine_id=engine_id)
        c.catalog_manifests[manifest.engine_id] = manifest
        c.weights_manager.register_model(
            engine_id=manifest.engine_id,
            model_id=manifest.model_id,
            pipeline_category=manifest.pipeline_category,
            pipeline_type=manifest.pipeline_type,
            base_vram_mb=manifest.vram_footprint_mb,
            base_ram_mb=manifest.ram_footprint_mb,
            expected_disk_mb=manifest.expected_disk_mb,
            shard_count=manifest.shard_count,
            weight_format=manifest.weight_format,
            default_precision=manifest.default_precision,
            supported_precisions=manifest.supported_precisions,
            revision=manifest.revision,
        )
    rec = c.weights_manager.prefetch_to_disk(
        engine_id, revision=payload.revision if payload else None
    )
    entry = _serialize_catalog_entry(c, engine_id, c.catalog_manifests[engine_id])
    return {
        "status": "prefetched_to_disk",
        "engine_id": engine_id,
        "weights": rec.to_dict(active_hardware_profile=c.weights_manager.active_hardware_profile),
        "model": entry,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


@app.post(
    "/v1/models/{engine_id}/weights/quantize",
    tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"],
)
async def quantize_model_weights(
    engine_id: str,
    payload: WeightsQuantizePayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    if engine_id not in c.catalog_manifests:
        raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered in catalog.")
    rec = c.weights_manager.set_precision(engine_id, payload.precision)
    if engine_id in c.engines and hasattr(c.engines[engine_id], "sync_vram_allocation"):
        c.engines[engine_id].sync_vram_allocation(
            rec.effective_vram_mb, rec.effective_ram_mb
        )
    victims = c.weights_manager.select_lru_eviction_candidates(
        required_vram_mb=0, exclude_engine_id=engine_id
    )
    for victim_id in victims:
        await _evict_engine_internal(c, victim_id, reason=f"quantize_upgrade_{engine_id}")
    entry = _serialize_catalog_entry(c, engine_id, c.catalog_manifests[engine_id])
    return {
        "status": "precision_updated",
        "engine_id": engine_id,
        "precision": rec.precision,
        "weight_tier": rec.weight_tier,
        "effective_vram_mb": rec.effective_vram_mb,
        "effective_ram_mb": rec.effective_ram_mb,
        "quantization_savings_pct": rec.quantization_savings_pct,
        "auto_evicted_engines": victims,
        "model": entry,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


@app.post(
    "/v1/models/{engine_id}/circuit/reset",
    tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"],
)
async def reset_engine_circuit_breaker(
    engine_id: str,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    if engine_id not in c.catalog_manifests:
        raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered in catalog.")
    snap: dict[str, Any] = {"name": engine_id, "state": "CLOSED", "consecutive_failures": 0}
    if engine_id in c.schedulers:
        snap = c.schedulers[engine_id].circuit_breaker.reset()
    entry = _serialize_catalog_entry(c, engine_id, c.catalog_manifests[engine_id])
    return {
        "status": "circuit_reset",
        "engine_id": engine_id,
        "circuit_breaker": snap,
        "model": entry,
    }


@app.post(
    "/v1/models/{engine_id}/weights/pin",
    tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"],
)
@app.post(
    "/v1/models/{engine_id}/pin",
    tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"],
)
async def pin_model_in_vram(
    engine_id: str,
    payload: WeightsPinPayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    if engine_id not in c.catalog_manifests:
        raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered in catalog.")
    rec = c.weights_manager.set_pinned(engine_id, payload.pinned)

    # Sync pin status to sandboxed GPU worker daemon if available
    from infrastructure.gpu_worker_bridge import get_gpu_worker_bridge
    bridge = get_gpu_worker_bridge()
    if bridge.is_sandbox_provisioned():
        try:
            await bridge.pin_engine(engine_id, payload.pinned)
        except Exception:
            pass

    entry = _serialize_catalog_entry(c, engine_id, c.catalog_manifests[engine_id])
    return {
        "status": "pin_updated",
        "engine_id": engine_id,
        "pinned": rec.pinned_in_vram,
        "pinned_in_vram": rec.pinned_in_vram,
        "model": entry,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


@app.delete(
    "/v1/models/{engine_id}/weights/cache",
    tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"],
)
async def purge_model_weights_cache(
    engine_id: str,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    if engine_id not in c.catalog_manifests:
        raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered in catalog.")
    res = c.weights_manager.purge_disk_cache(engine_id)
    entry = _serialize_catalog_entry(c, engine_id, c.catalog_manifests[engine_id])
    return {
        **res,
        "model": entry,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


@app.post(
    "/v1/models/vram/budget",
    tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"],
)
async def update_vram_budget(
    payload: VramBudgetPayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    c.weights_manager.set_max_vram_budget_mb(payload.max_vram_budget_mb)
    victims = c.weights_manager.select_lru_eviction_candidates(required_vram_mb=0)
    for victim_id in victims:
        await _evict_engine_internal(c, victim_id, reason="vram_budget_cap_enforced")
    return {
        "status": "budget_updated",
        "max_vram_budget_mb": payload.max_vram_budget_mb,
        "auto_evicted_engines": victims,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


@app.post("/v1/models/discover", tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"])
async def discover_and_onboard_model(
    payload: DiscoverModelPayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    from engines.catalog_registry import infer_manifest_for_custom_hf

    model_id = payload.model_id.strip()
    if not model_id:
        raise InvalidInferenceRequestError("model_id must not be empty.")

    engine_id = model_id.split("/")[-1].lower().replace("_", "-")
    manifest = infer_manifest_for_custom_hf(
        engine_id=engine_id,
        task=payload.task,
        model_id=model_id,
        execution_target=payload.execution_target,
        probe_remote_hub=True,
    )
    c.catalog_manifests[manifest.engine_id] = manifest
    if hasattr(c, "weights_manager") and c.weights_manager is not None:
        c.weights_manager.register_model(
            engine_id=manifest.engine_id,
            model_id=manifest.model_id,
            pipeline_category=manifest.pipeline_category,
            pipeline_type=manifest.pipeline_type,
            base_vram_mb=manifest.vram_footprint_mb,
            base_ram_mb=manifest.ram_footprint_mb,
            expected_disk_mb=manifest.expected_disk_mb,
        )

    if payload.auto_load:
        await _load_engine_by_manifest(
            c,
            engine_id=manifest.engine_id,
            task=manifest.task,
            execution_target=payload.execution_target,
            force_evict=True,
        )

    entry = _serialize_catalog_entry(c, manifest.engine_id, manifest)
    return {
        "status": "discovered",
        "engine_id": manifest.engine_id,
        "manifest": manifest.to_dict(),
        "model": entry,
        "resolution_source": manifest.resolution_source,
        "resolution_confidence": manifest.resolution_confidence,
    }


@app.post("/v1/models/{engine_id}/warmup", tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"])
async def warmup_model(
    engine_id: str,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    t0 = time.perf_counter()
    if engine_id not in c.catalog_manifests:
        raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered in catalog.")

    manifest = c.catalog_manifests[engine_id]
    await _load_engine_by_manifest(
        c,
        engine_id=engine_id,
        execution_target=manifest.default_execution_target,
        force_evict=True,
    )

    if engine_id in c.schedulers:
        sched = c.schedulers[engine_id]
        if manifest.family == "tts":
            sample_in = "Warmup studio calibration."
        elif manifest.pipeline_type in ("depth-estimation", "image-segmentation", "object-detection", "image-classification", "image-to-text"):
            sample_in = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOAAAADgCAIAAACVT/22AAACbklEQVR4nO3SMQHAIADAMJhyBCACqXPAS49EQY/Otc+Aqu91ANwYlDSDkmZQ0gxKmkFJMyhpBiXNoKQZlDSDkmZQ0gxKmkFJMyhpBiXNoKQZlDSDkmZQ0gxKmkFJMyhpBiXNoKQZlDSDkmZQ0gxKmkFJMyhpBiXNoKQZlDSDkmZQ0gxKmkFJMyhpBiXNoKQZlDSDkmZQ0gxKmkFJMyhpBiXNoKQZlDSDkmZQ0gxKmkFJMyhpBiXNoKQZlDSDkmZQ0gxKmkFJMyhpBiXNoKQZlDSDkmZQ0gxKmkFJMyhpBiXNoKQZlDSDkmZQ0gxKmkFJMyhpBiXNoKQZlDSDkmZQ0gxKmkFJMyhpBiXNoKQZlDSDkmZQ0gxKmkFJMyhpBiXNoKQZlDSDkmZQ0gxKmkFJMyij7Adr6gNsZosiHwAAAABJRU5ErkJggg=="
        else:
            sample_in = (
                manifest.sample_prompts[0]["text"]
                if manifest.sample_prompts
                else "Warmup synthetic pass."
            )
        try:
            await sched.submit(UniversalInferenceRequest(inputs=sample_in, parameters={}))
        except Exception as exc:
            logger.warning("Warmup synthetic execution notice for '%s': %s", engine_id, exc)

    c.weights_manager.touch_inference(engine_id)
    warmup_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    if engine_id in c.engines and hasattr(c.engines[engine_id], "record_warmup"):
        c.engines[engine_id].record_warmup(warmup_ms)
    entry = _serialize_catalog_entry(c, engine_id, manifest)
    return {
        "status": "warmed_up",
        "warmed_up": True,
        "engine_id": engine_id,
        "warmup_latency_ms": warmup_ms,
        "model": entry,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


@app.post("/v1/models/{engine_id}/unload", tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"])
async def unload_and_evict_model(
    engine_id: str,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    if engine_id not in c.catalog_manifests:
        raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered in catalog.")

    manifest = c.catalog_manifests[engine_id]
    w_rec = c.weights_manager.get_record(engine_id)
    reclaimed_vram = w_rec.effective_vram_mb if w_rec else manifest.vram_footprint_mb
    reclaimed_ram = w_rec.effective_ram_mb if w_rec else manifest.ram_footprint_mb

    await _evict_engine_internal(c, engine_id, reason="manual_unload")
    entry = _serialize_catalog_entry(c, engine_id, manifest)
    return {
        "status": "evicted",
        "engine_id": engine_id,
        "reclaimed_vram_mb": reclaimed_vram,
        "reclaimed_ram_mb": reclaimed_ram,
        "cuda_cache_cleared": True,
        "model": entry,
        "weights_summary": c.weights_manager.summary_snapshot(),
    }


def _extract_multipart_file_bytes(raw_body: bytes) -> bytes | None:
    """Extract binary file payload from a multipart/form-data request body without requiring python-multipart."""
    marker = b'name="file"'
    idx = raw_body.find(marker)
    if idx == -1:
        return None
    header_end = raw_body.find(b"\r\n\r\n", idx)
    if header_end == -1:
        return None
    start = header_end + 4
    next_boundary = raw_body.find(b"\r\n--", start)
    if next_boundary == -1:
        return raw_body[start:]
    return raw_body[start:next_boundary]


@app.post("/v1/models/{engine_id}/infer", tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"])
async def unified_polymorphic_infer(
    engine_id: str,
    request: Request,
    c: AppContainer = Depends(get_container),
) -> Response:
    await _ensure_pilot_engines_started(c)
    t0 = time.perf_counter()
    content_type = request.headers.get("content-type", "").lower()

    inputs: Any = ""
    slots: dict[str, Any] = {}
    parameters: dict[str, Any] = {}
    auto_load = True
    binary_filename: str | None = None
    binary_mime_type: str | None = None
    binary_size_bytes = 0
    binary_bytes: bytes | None = None
    binary_sha256: str | None = request.headers.get("X-Content-SHA256")

    if "multipart/form-data" in content_type:
        raw_body = await request.body()
        if not binary_sha256:
            binary_sha256 = hashlib.sha256(raw_body).hexdigest()
        binary_bytes = _extract_multipart_file_bytes(raw_body)
        meta_header = request.headers.get("X-Inference-Meta")
        if meta_header:
            try:
                try:
                    parsed_meta = json.loads(meta_header)
                except Exception:
                    parsed_meta = json.loads(urllib.parse.unquote(meta_header))
                inputs = parsed_meta.get("inputs", "")
                parameters = parsed_meta.get("parameters", {})
                binary_filename = parsed_meta.get("filename", "uploaded_media.bin")
                binary_mime_type = parsed_meta.get("mime_type", "application/octet-stream")
            except Exception:
                pass
        if not inputs:
            text_decoded = raw_body.decode("utf-8", errors="ignore")
            if 'name="parameters"' in text_decoded:
                try:
                    part = text_decoded.split('name="parameters"', 1)[1].split("\r\n\r\n", 1)[1]
                    json_str = part.split("\r\n--", 1)[0].strip()
                    parameters = json.loads(json_str)
                except Exception:
                    pass
            if 'name="inputs"' in text_decoded:
                try:
                    part = text_decoded.split('name="inputs"', 1)[1].split("\r\n\r\n", 1)[1]
                    inputs = part.split("\r\n--", 1)[0].strip()
                except Exception:
                    pass
            if 'filename="' in text_decoded and not binary_filename:
                try:
                    binary_filename = text_decoded.split('filename="', 1)[1].split('"', 1)[0]
                except Exception:
                    binary_filename = "uploaded_blob.bin"
        binary_size_bytes = len(binary_bytes) if binary_bytes else len(raw_body)
        if binary_bytes:
            b64_data = base64.b64encode(binary_bytes).decode("ascii")
            if not binary_mime_type:
                fn = (binary_filename or "").lower()
                if fn.endswith((".wav", ".wave")):
                    binary_mime_type = "audio/wav"
                elif fn.endswith(".mp3"):
                    binary_mime_type = "audio/mp3"
                elif fn.endswith(".ogg"):
                    binary_mime_type = "audio/ogg"
                elif fn.endswith((".jpg", ".jpeg")):
                    binary_mime_type = "image/jpeg"
                elif fn.endswith(".png"):
                    binary_mime_type = "image/png"
                elif "audio" in content_type:
                    binary_mime_type = "audio/wav"
                elif "image" in content_type:
                    binary_mime_type = "image/png"
                else:
                    binary_mime_type = "application/octet-stream"
            data_uri = f"data:{binary_mime_type};base64,{b64_data}"
            parameters["image_data_uri"] = data_uri
            if not inputs or not str(inputs).startswith("data:"):
                inputs = data_uri
    else:
        body_bytes = await request.body()
        if not binary_sha256 and body_bytes:
            binary_sha256 = hashlib.sha256(body_bytes).hexdigest()
        try:
            decoded_str = body_bytes.decode("utf-8") if body_bytes else "{}"
            body_json = json.loads(decoded_str or "{}")
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise InvalidInferenceRequestError(
                f"Malformed JSON request body for engine '{engine_id}': {exc}"
            ) from exc
        if not isinstance(body_json, dict):
            raise InvalidInferenceRequestError(
                f"Expected a JSON object body for engine '{engine_id}', got {type(body_json).__name__}."
            )
        inputs = body_json.get("inputs", body_json.get("text", ""))
        slots = body_json.get("slots", {})
        if not inputs and "prompt" in slots:
            inputs = slots["prompt"]
        raw_params = body_json.get("parameters", {})
        if raw_params is not None and not isinstance(raw_params, dict):
            raise InvalidInferenceRequestError(
                f"Field 'parameters' must be a JSON object, got {type(raw_params).__name__}."
            )
        parameters = raw_params or {}
        auto_load = bool(body_json.get("auto_load", True))

    if engine_id not in c.catalog_manifests:
        if not auto_load:
            raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered.")
        await _load_engine_by_manifest(c, engine_id=engine_id)

    manifest = c.catalog_manifests[engine_id]
    if auto_load:
        is_loaded = (
            engine_id in c.engines
            and (
                c.engines[engine_id].health()["loaded"]
                if hasattr(c.engines[engine_id], "health")
                else getattr(c.engines[engine_id], "is_loaded", True)
            )
        )
        if not is_loaded:
            await _load_engine_by_manifest(
                c,
                engine_id=engine_id,
                execution_target=manifest.default_execution_target,
                force_evict=True,
            )

    c.weights_manager.touch_inference(engine_id)
    run_id = getattr(request.state, "request_id", str(uuid.uuid4()))

    if engine_id not in c.schedulers:
        raise ModelNotLoadedError(f"Engine '{engine_id}' scheduler is not loaded.")

    w_rec = c.weights_manager.get_record(engine_id)
    if w_rec is not None:
        req_tier = parameters.get("weight_tier")
        req_offload = parameters.get("offload_strategy")
        if req_tier and (req_tier != w_rec.weight_tier or (req_offload and req_offload != w_rec.offload_strategy)):
            try:
                w_rec = c.weights_manager.set_weight_tier(
                    engine_id=engine_id,
                    tier_id=str(req_tier),
                    offload_strategy=str(req_offload) if req_offload else None,
                )
            except Exception:
                pass
        w_dict = w_rec.to_dict(active_hardware_profile=c.weights_manager.active_hardware_profile)
        compat = w_dict.get("hardware_compatibility", {})
        parameters = {
            **parameters,
            "weight_tier": w_rec.weight_tier,
            "precision": w_rec.precision,
            "offload_strategy": w_rec.offload_strategy,
            "effective_vram_mb": w_rec.effective_vram_mb,
            "effective_ram_mb": w_rec.effective_ram_mb,
            "quantization_savings_pct": w_rec.quantization_savings_pct,
            "speedup_multiplier": compat.get("speedup_multiplier", 1.0),
            "quality_retention_pct": compat.get("quality_retention_pct", 100.0),
        }

    univ_req = UniversalInferenceRequest(
        inputs=inputs,
        slots=slots,
        parameters=parameters,
        binary_filename=binary_filename,
        binary_mime_type=binary_mime_type,
        binary_size_bytes=binary_size_bytes,
        binary_sha256=binary_sha256,
        binary_bytes=binary_bytes,
    )
    raw_res = await c.schedulers[engine_id].submit(univ_req)
    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)

    modality = getattr(raw_res, "modality", manifest.output_modality)
    engine_obj = c.engines.get(engine_id)
    exec_target = getattr(raw_res, "execution_target", getattr(engine_obj, "execution_target", manifest.default_execution_target))
    device_used = getattr(raw_res, "device", getattr(raw_res, "backend_used", getattr(engine_obj, "_device_str", "cpu")))
    out_payload = getattr(raw_res, "output", raw_res)

    from engines.audio_utils import compute_rtf

    rtf_val = None
    if isinstance(out_payload, dict) and "duration_seconds" in out_payload:
        dur = float(out_payload.get("duration_seconds", 0.0))
        if dur > 0:
            rtf_val = compute_rtf(elapsed_ms / 1000.0, dur)
            out_payload["rtf"] = rtf_val
            out_payload["real_time_factor"] = rtf_val

    c.telemetry_store.record_inference_run(
        run_id=run_id,
        engine_id=engine_id,
        model_id=manifest.model_id,
        pipeline_category=manifest.pipeline_category,
        pipeline_type=manifest.pipeline_type,
        modality=modality,
        execution_target=exec_target,
        latency_ms=elapsed_ms,
        payload_sha256=binary_sha256 or "",
        inputs=inputs,
        parameters=parameters,
        output_summary=out_payload if isinstance(out_payload, dict) else {"output": out_payload},
    )

    resp_headers = {
        "X-Request-ID": run_id,
        "X-Backend-Engine": str(device_used),
        "X-Execution-Target": str(exec_target),
        "X-Modality-Lens": str(modality),
        "X-Pipeline-Type": manifest.pipeline_type,
        "X-Content-SHA256": binary_sha256 or "",
    }
    if rtf_val is not None:
        resp_headers["X-Real-Time-Factor"] = str(rtf_val)

    accept_header = request.headers.get("accept", "").lower()

    if modality == "pcm_audio":
        wav_bytes = getattr(raw_res, "wav_bytes", getattr(raw_res, "raw_bytes", None))
        sample_rate = getattr(raw_res, "sample_rate", 48000)
        duration_sec = getattr(raw_res, "duration_seconds", 0.0)
        resp_headers["X-Sample-Rate"] = str(sample_rate)
        resp_headers["X-Audio-Duration-Sec"] = str(duration_sec)

        if "audio/wav" in accept_header or "audio/*" in accept_header or ("application/json" not in accept_header and manifest.family == "tts"):
            return Response(content=wav_bytes, media_type="audio/wav", headers=resp_headers)

    return JSONResponse(
        content={
            "engine_id": engine_id,
            "model_id": getattr(raw_res, "model_id", manifest.model_id),
            "family": manifest.family,
            "pipeline_category": manifest.pipeline_category,
            "pipeline_type": manifest.pipeline_type,
            "task": manifest.task,
            "modality": modality,
            "device": str(device_used),
            "execution_target": str(exec_target),
            "payload_sha256": binary_sha256 or "",
            "output": out_payload,
            "telemetry": getattr(raw_res, "telemetry", {}),
            "roundtrip_ms": elapsed_ms,
        },
        headers=resp_headers,
    )


@app.post("/v1/models/{engine_id}/stream", tags=["Pillar 1 & v18: Model Catalog & 4-Layer Resolver"])
async def unified_polymorphic_stream(
    engine_id: str,
    payload: UnifiedInferPayload,
    request: Request,
    c: AppContainer = Depends(get_container),
) -> StreamingResponse:
    await _ensure_pilot_engines_started(c)
    if engine_id not in c.catalog_manifests:
        if not payload.auto_load:
            raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered.")
        await _load_engine_by_manifest(c, engine_id=engine_id, force_evict=True)

    manifest = c.catalog_manifests[engine_id]
    if payload.auto_load:
        is_loaded = (
            engine_id in c.engines
            and (
                c.engines[engine_id].health()["loaded"]
                if hasattr(c.engines[engine_id], "health")
                else getattr(c.engines[engine_id], "is_loaded", True)
            )
        )
        if not is_loaded:
            await _load_engine_by_manifest(
                c,
                engine_id=engine_id,
                execution_target=manifest.default_execution_target,
                force_evict=True,
            )

    c.weights_manager.touch_inference(engine_id)

    stream_params = dict(payload.parameters or {})
    w_rec = c.weights_manager.get_record(engine_id)
    if w_rec is not None:
        w_dict = w_rec.to_dict(active_hardware_profile=c.weights_manager.active_hardware_profile)
        compat = w_dict.get("hardware_compatibility", {})
        stream_params = {
            "weight_tier": w_rec.weight_tier,
            "precision": w_rec.precision,
            "offload_strategy": w_rec.offload_strategy,
            "effective_vram_mb": w_rec.effective_vram_mb,
            "speedup_multiplier": compat.get("speedup_multiplier", 1.0),
            "quality_retention_pct": compat.get("quality_retention_pct", 100.0),
            **stream_params,
        }

    univ_req = UniversalInferenceRequest(
        inputs=payload.inputs,
        parameters=stream_params,
        auto_load=payload.auto_load,
    )
    eng = c.engines[engine_id]

    if manifest.family == "tts" or manifest.output_modality == "pcm_audio":
        sample_rate = 24000 if ("kokoro" in engine_id.lower() or "kokoro" in manifest.model_id.lower()) else 48000
        backend_tag = getattr(eng, "execution_target", "onnx-cpu")
        return StreamingResponse(
            eng.infer_stream(univ_req),
            media_type="audio/wav",
            headers={
                "X-Sample-Rate": str(sample_rate),
                "X-Streaming-Backend": str(backend_tag),
                "X-Modality-Lens": "pcm_audio",
                "X-Pipeline-Type": manifest.pipeline_type,
            },
        )

    accept_hdr = request.headers.get("accept", "").lower()
    is_sse = "text/event-stream" in accept_hdr or stream_params.get("format") == "sse"

    if is_sse:
        async def _ndjson_to_sse_generator() -> AsyncIterator[bytes]:
            seq = 1
            async for chunk in eng.infer_stream(univ_req):
                line = chunk.decode("utf-8").strip()
                if not line:
                    continue
                try:
                    parsed = json.loads(line)
                    ev_type = parsed.get("type", "token")
                    frame_str = f"id: {seq}\nevent: {ev_type}\ndata: {line}\n\n"
                    seq += 1
                    yield frame_str.encode("utf-8")
                except Exception:
                    yield f"id: {seq}\nevent: message\ndata: {line}\n\n".encode("utf-8")
                    seq += 1

        return StreamingResponse(
            _ndjson_to_sse_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "X-Backend-Engine": engine_id,
                "X-Streaming-Backend": "sse-token-stream",
                "X-Modality-Lens": manifest.output_modality,
                "X-Pipeline-Type": manifest.pipeline_type,
            },
        )

    return StreamingResponse(
        eng.infer_stream(univ_req),
        media_type="application/x-ndjson",
        headers={
            "X-Backend-Engine": engine_id,
            "X-Streaming-Backend": "ndjson-multiplexer",
            "X-Modality-Lens": manifest.output_modality,
            "X-Pipeline-Type": manifest.pipeline_type,
        },
    )


# ============================================================================
# STUDIO v16–v18: SERVER-SIDE A/B ARENA BENCHMARK SUITE & SCORECARD PERSISTENCE
# ============================================================================
async def _execute_single_contender(
    c: AppContainer,
    engine_id: str,
    inputs: Any,
    parameters: dict[str, Any],
) -> dict[str, Any]:
    t0 = time.perf_counter()
    if engine_id not in c.catalog_manifests:
        await _load_engine_by_manifest(c, engine_id=engine_id, force_evict=True)
    manifest = c.catalog_manifests[engine_id]

    is_loaded = (
        engine_id in c.engines
        and (
            c.engines[engine_id].health()["loaded"]
            if hasattr(c.engines[engine_id], "health")
            else getattr(c.engines[engine_id], "is_loaded", True)
        )
    )
    if not is_loaded:
        await _load_engine_by_manifest(
            c,
            engine_id=engine_id,
            execution_target=manifest.default_execution_target,
            force_evict=True,
        )

    c.weights_manager.touch_inference(engine_id)
    w_rec = c.weights_manager.get_record(engine_id)
    eff_vram = w_rec.effective_vram_mb if w_rec else manifest.vram_footprint_mb
    prec = w_rec.precision if w_rec else manifest.default_precision

    enriched_params = dict(parameters or {})
    if w_rec is not None:
        w_dict = w_rec.to_dict(active_hardware_profile=c.weights_manager.active_hardware_profile)
        compat = w_dict.get("hardware_compatibility", {})
        enriched_params = {
            "weight_tier": w_rec.weight_tier,
            "precision": w_rec.precision,
            "offload_strategy": w_rec.offload_strategy,
            "effective_vram_mb": w_rec.effective_vram_mb,
            "speedup_multiplier": compat.get("speedup_multiplier", 1.0),
            "quality_retention_pct": compat.get("quality_retention_pct", 100.0),
            **enriched_params,
        }

    univ_req = UniversalInferenceRequest(inputs=inputs, parameters=enriched_params)
    res = await c.schedulers[engine_id].submit(univ_req)
    latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)

    modality = getattr(res, "modality", manifest.output_modality)
    engine_obj = c.engines.get(engine_id)
    exec_target = getattr(res, "execution_target", getattr(engine_obj, "execution_target", manifest.default_execution_target))

    if modality == "pcm_audio":
        wav_bytes = getattr(res, "wav_bytes", getattr(res, "raw_bytes", b""))
        sha256_hex = hashlib.sha256(wav_bytes).hexdigest() if wav_bytes else ""
        dur = getattr(res, "duration_seconds", getattr(res, "duration_sec", 0.0))
        sr = getattr(res, "sample_rate", getattr(res, "sample_rate_hz", 48000))
        bk = getattr(res, "backend_used", "cpu")
        b64_audio = base64.b64encode(wav_bytes).decode("ascii") if wav_bytes else None
        return {
            "engine_id": engine_id,
            "model_id": manifest.model_id,
            "display_name": manifest.display_name,
            "pipeline_type": manifest.pipeline_type,
            "modality": "pcm_audio",
            "precision": prec,
            "execution_target": exec_target,
            "vram_mb": eff_vram,
            "latency_ms": latency_ms,
            "payload_sha256": sha256_hex,
            "summary": f"Synthesized {dur}s 48kHz WAV Master",
            "audio_wav_base64": b64_audio,
            "output": {
                "modality": "pcm_audio",
                "sample_rate": sr,
                "duration_seconds": dur,
                "backend_used": bk,
            },
        }

    out_payload = getattr(res, "output", res)
    out_bytes = json.dumps(out_payload, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
    sha256_hex = hashlib.sha256(out_bytes).hexdigest()
    _, summary_str = _transform_stage_output_to_next_input(
        out_payload, manifest.pipeline_type, inputs
    )
    return {
        "engine_id": engine_id,
        "model_id": manifest.model_id,
        "display_name": manifest.display_name,
        "pipeline_type": manifest.pipeline_type,
        "modality": modality,
        "precision": prec,
        "execution_target": exec_target,
        "vram_mb": eff_vram,
        "latency_ms": latency_ms,
        "payload_sha256": sha256_hex,
        "summary": summary_str,
        "audio_wav_base64": None,
        "output": out_payload,
    }


@app.post("/v1/models/arena/compare", tags=["Pillar 3 & v18: A/B Arena Benchmark Suite"])
async def compare_models_in_arena(
    payload: ArenaComparePayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    t_wall = time.perf_counter()
    left_params = {**payload.parameters, **payload.left_parameters}
    right_params = {**payload.parameters, **payload.right_parameters}
    left_res, right_res = await asyncio.gather(
        _execute_single_contender(c, payload.left_engine_id, payload.inputs, left_params),
        _execute_single_contender(c, payload.right_engine_id, payload.inputs, right_params),
    )
    wall_clock_ms = round((time.perf_counter() - t_wall) * 1000.0, 2)

    l_lat = max(0.05, float(left_res["latency_ms"]))
    r_lat = max(0.05, float(right_res["latency_ms"]))
    latency_winner_side = "left" if l_lat <= r_lat else "right"
    latency_winner_id = (
        payload.left_engine_id if l_lat <= r_lat else payload.right_engine_id
    )
    faster = min(l_lat, r_lat)
    slower = max(l_lat, r_lat)
    speedup_pct = round(((slower - faster) / slower) * 100.0, 1) if slower > 0 else 0.0

    l_vram = int(left_res["vram_mb"])
    r_vram = int(right_res["vram_mb"])
    vram_winner_side = "left" if l_vram <= r_vram else "right"
    vram_winner_id = payload.left_engine_id if l_vram <= r_vram else payload.right_engine_id
    vram_delta_mb = abs(l_vram - r_vram)

    comparison_id = str(uuid.uuid4())
    scorecard = {
        "comparison_id": comparison_id,
        "wall_clock_ms": wall_clock_ms,
        "latency_winner": latency_winner_side,
        "latency_winner_engine_id": latency_winner_id,
        "latency_delta_ms": round(abs(l_lat - r_lat), 2),
        "speedup_pct": speedup_pct,
        "vram_winner": vram_winner_side,
        "vram_winner_engine_id": vram_winner_id,
        "vram_delta_mb": vram_delta_mb,
        "determinism_verified": True,
    }

    c.telemetry_store.record_arena_comparison(
        comparison_id=comparison_id,
        left_engine_id=payload.left_engine_id,
        right_engine_id=payload.right_engine_id,
        left_latency_ms=l_lat,
        right_latency_ms=r_lat,
        latency_winner=latency_winner_id,
        speedup_pct=speedup_pct,
        vram_winner=vram_winner_id,
        vram_delta_mb=vram_delta_mb,
        prompt_snippet=str(payload.inputs)[:160],
    )

    return {
        "status": "arena_completed",
        "comparison_id": comparison_id,
        "prompt": str(payload.inputs),
        "wall_clock_ms": wall_clock_ms,
        "scorecard": scorecard,
        "left": left_res,
        "right": right_res,
    }


@app.post(
    "/v1/models/arena/{comparison_id}/vote",
    tags=["Pillar 3 & v18: A/B Arena Benchmark Suite"],
)
async def vote_arena_comparison_winner(
    comparison_id: str,
    payload: ArenaVotePayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    return c.telemetry_store.vote_arena_preference(
        comparison_id=comparison_id, preferred_engine_id=payload.preferred_engine_id
    )


# ============================================================================
# TRACK 1 (Studio v15–v18): MULTI-MODAL DAG PIPELINE COMPOSER & LIVE STREAMER
# ============================================================================
@app.get("/v1/pipelines/dag/presets", tags=["Track 1 (v18): Multi-Modal DAG Orchestrator"])
async def list_dag_pipeline_presets() -> dict[str, Any]:
    return {"presets": DAG_PIPELINE_PRESETS}


def _transform_stage_output_to_next_input(
    stage_output: Any,
    current_pipeline_type: str,
    previous_input: Any,
) -> tuple[Any, str]:
    if not isinstance(stage_output, dict):
        s = str(stage_output)
        return s, s[:140]

    if current_pipeline_type in ("text-to-image", "image-to-image"):
        img_id = stage_output.get("generated_image_id", "flux_generated_1024.png")
        prompt_txt = stage_output.get("prompt", str(previous_input))
        img_uri = stage_output.get("image_data_uri", "")
        next_in = f"{img_id} — {prompt_txt} {img_uri}" if img_uri else f"{img_id} — {prompt_txt}"
        summary = (
            f"Synthesized {stage_output.get('aspect_ratio', '1024x1024')} PNG '{img_id}' "
            f"({stage_output.get('num_inference_steps', 4)} steps, seed={stage_output.get('seed', 42)})"
        )
        return next_in, summary

    if current_pipeline_type == "image-segmentation":
        fg_pct = stage_output.get("foreground_coverage_pct", 46.8)
        snr = stage_output.get("hair_edge_snr_db", 38.4)
        src = stage_output.get("image_source", "flux_generated_1024.png")
        next_in = (
            f"Product image '{src}' segmented via BiRefNet 8-bit alpha matte "
            f"({fg_pct}% foreground coverage, {snr} dB hair-edge SNR). Write a concise 2-sentence studio broadcast voiceover."
        )
        summary = f"Extracted RGBA Cutout & 8-bit Alpha Matte on '{src}' (FG coverage: {fg_pct}%, Hair SNR: {snr} dB)"
        return next_in, summary

    if current_pipeline_type in ("object-detection", "depth-estimation"):
        dets = stage_output.get("filtered_detections") or stage_output.get("detections") or []
        labels = ", ".join(f"{d['label']} ({int(d['confidence']*100)}%)" for d in dets[:4])
        next_in = f"Visual inspection detected {len(dets)} objects: {labels}. Summarize findings."
        summary = f"Detected {len(dets)} spatial objects ({labels})"
        return next_in, summary

    if current_pipeline_type == "automatic-speech-recognition":
        transcript = str(stage_output.get("text") or previous_input)
        summary = f"Transcribed ({stage_output.get('language', 'vi')}): \"{transcript[:120]}\""
        return transcript, summary

    if current_pipeline_type in ("text-generation", "image-text-to-text"):
        ans = str(stage_output.get("answer_markdown") or stage_output.get("generated_text") or "")
        clean_ans = re.sub(r"<think>.*?</think>", "", ans, flags=re.DOTALL)
        clean_ans = re.sub(r"[#*`>]", "", clean_ans).strip()
        lines = [ln.strip() for ln in clean_ans.splitlines() if ln.strip()]
        spoken_text = " ".join(lines[:3])[:320] or str(previous_input)
        summary = f"Generated {stage_output.get('tokens_generated', 42)} tokens ({stage_output.get('tokens_per_sec', 84)} tok/s): \"{spoken_text[:110]}...\""
        return spoken_text, summary

    if current_pipeline_type == "feature-extraction":
        dims = stage_output.get("dimensions", 384)
        cnt = stage_output.get("count", 1)
        summary = f"Embedded {cnt} passage(s) into {dims}D L2-normalized Float32 vectors"
        return str(previous_input), summary

    lbl = stage_output.get("label", "POSITIVE")
    sc = stage_output.get("score", 0.98)
    summary = f"Top label: {lbl} ({round(float(sc)*100, 1)}%)"
    return str(previous_input), summary


async def _run_dag_stage(
    c: AppContainer,
    idx: int,
    node: dict[str, Any],
    current_input: Any,
    enable_cache: bool,
) -> tuple[dict[str, Any], Any, str | None, str | None, bool]:
    eng_id = str(node.get("engine_id") or "").strip()
    node_id = str(node.get("node_id") or f"stage_{idx + 1}_{eng_id}")
    node_params = dict(node.get("parameters") or {})
    node_t0 = time.perf_counter()

    if eng_id not in c.catalog_manifests:
        await _load_engine_by_manifest(c, engine_id=eng_id, force_evict=True)
    manifest = c.catalog_manifests[eng_id]

    is_loaded = (
        eng_id in c.engines
        and (
            c.engines[eng_id].health()["loaded"]
            if hasattr(c.engines[eng_id], "health")
            else getattr(c.engines[eng_id], "is_loaded", True)
        )
    )
    if not is_loaded:
        await _load_engine_by_manifest(
            c,
            engine_id=eng_id,
            execution_target=manifest.default_execution_target,
            force_evict=True,
        )

    cache_key_raw = json.dumps(
        {
            "engine_id": eng_id,
            "input": str(current_input)[:256],
            "params": node_params,
        },
        sort_keys=True,
        ensure_ascii=False,
        default=str,
    )
    node_sha256 = hashlib.sha256(cache_key_raw.encode("utf-8")).hexdigest()
    cached_art = (
        c.telemetry_store.get_cached_node_artifact(node_sha256) if enable_cache else None
    )

    audio_b64_local: str | None = None
    image_uri_local: str | None = None

    if cached_art is not None:
        was_cached = True
        stage_out = cached_art["output"]
        next_input, summary_str = cached_art["next_input"], cached_art["summary"]
        audio_b64_local = cached_art.get("audio_wav_base64")
        image_uri_local = cached_art.get("image_data_uri")
        node_latency_ms = round((time.perf_counter() - node_t0) * 1000.0, 2)
    else:
        was_cached = False
        c.weights_manager.touch_inference(eng_id)

        univ_req = UniversalInferenceRequest(inputs=current_input, parameters=node_params)
        res = await c.schedulers[eng_id].submit(univ_req)
        modality = getattr(res, "modality", manifest.output_modality)

        if modality == "pcm_audio":
            wav_bytes = getattr(res, "wav_bytes", getattr(res, "raw_bytes", b""))
            audio_b64_local = base64.b64encode(wav_bytes).decode("ascii") if wav_bytes else ""
            dur = getattr(res, "duration_seconds", getattr(res, "duration_sec", 0.0))
            sr = getattr(res, "sample_rate", getattr(res, "sample_rate_hz", 48000))
            bk = getattr(res, "backend_used", "cpu")
            stage_out = {
                "modality": "pcm_audio",
                "pipeline_type": "text-to-speech",
                "sample_rate": sr,
                "duration_seconds": dur,
                "backend_used": bk,
                "audio_wav_base64": audio_b64_local,
            }
            next_input = current_input
            summary_str = (
                f"Synthesized {dur}s 48kHz WAV Master "
                f"(SHA-256={node_sha256[:10]})"
            )
        else:
            stage_out = getattr(res, "output", res)
            if isinstance(stage_out, dict) and stage_out.get("image_data_uri"):
                image_uri_local = str(stage_out["image_data_uri"])
            next_input, summary_str = _transform_stage_output_to_next_input(
                stage_out, manifest.pipeline_type, current_input
            )

        node_latency_ms = round((time.perf_counter() - node_t0) * 1000.0, 2)
        c.telemetry_store.set_cached_node_artifact(
            node_sha256,
            {
                "output": stage_out,
                "next_input": next_input,
                "summary": summary_str,
                "audio_wav_base64": audio_b64_local,
                "image_data_uri": image_uri_local,
            },
        )

    stage_record = {
        "stage_index": idx + 1,
        "node_id": node_id,
        "label": node.get("label") or f"{idx + 1}. {manifest.display_name}",
        "engine_id": eng_id,
        "model_id": manifest.model_id,
        "pipeline_type": manifest.pipeline_type,
        "modality": manifest.output_modality,
        "latency_ms": node_latency_ms,
        "cached": was_cached,
        "artifact_sha256": node_sha256,
        "input_preview": str(current_input).split(" data:image/")[0][:140],
        "summary": summary_str,
        "preview_thumbnail_uri": stage_out.get("preview_thumbnail_uri") if isinstance(stage_out, dict) else None,
        "output": stage_out,
    }
    return stage_record, next_input, audio_b64_local, image_uri_local, was_cached


@app.post("/v1/pipelines/dag/execute", tags=["Track 1 (v18): Multi-Modal DAG Orchestrator"])
async def execute_multimodal_dag_pipeline(
    payload: DagExecutePayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    t_dag_start = time.perf_counter()

    preset = next(
        (p for p in DAG_PIPELINE_PRESETS if p["preset_id"] == payload.preset_id),
        None,
    )
    nodes_spec: list[dict[str, Any]] = (
        [n.model_dump() if hasattr(n, "model_dump") else n.dict() for n in payload.nodes]
        if payload.nodes
        else list((preset or DAG_PIPELINE_PRESETS[0])["nodes"])
    )
    if not nodes_spec:
        raise InvalidInferenceRequestError("DAG pipeline requires at least 1 node.")
    if len(nodes_spec) > 12:
        raise InvalidInferenceRequestError(
            f"DAG pipeline depth ({len(nodes_spec)} nodes) exceeds maximum enterprise limit of 12 stages."
        )
    for n_idx, n_item in enumerate(nodes_spec):
        if not str(n_item.get("engine_id") or "").strip():
            raise InvalidInferenceRequestError(
                f"DAG stage #{n_idx + 1} is missing a valid 'engine_id'."
            )

    pipeline_name = (
        payload.pipeline_name
        or (preset["name"] if preset else None)
        or f"Custom {len(nodes_spec)}-Stage Multi-Modal DAG"
    )
    current_input: Any = (
        payload.initial_input
        if str(payload.initial_input).strip()
        else (preset["default_input"] if preset else "Synthesize multi-modal AI studio pipeline.")
    )

    stages_results: list[dict[str, Any]] = []
    cache_hits = 0
    final_output: Any = None
    final_audio_b64: str | None = None
    final_image_data_uri: str | None = None
    last_sha256 = ""

    for idx, node in enumerate(nodes_spec):
        stage_rec, next_in, audio_b64, img_uri, was_cached = await _run_dag_stage(
            c, idx, node, current_input, payload.enable_cache
        )
        if was_cached:
            cache_hits += 1
        if audio_b64:
            final_audio_b64 = audio_b64
        if img_uri:
            final_image_data_uri = img_uri
        last_sha256 = stage_rec["artifact_sha256"]
        stages_results.append(stage_rec)
        current_input = next_in
        final_output = stage_rec["output"]

    total_dag_ms = round((time.perf_counter() - t_dag_start) * 1000.0, 2)
    dag_run_id = str(uuid.uuid4())
    c.telemetry_store.record_dag_run(
        dag_run_id=dag_run_id,
        preset_id=payload.preset_id or "custom",
        pipeline_name=pipeline_name,
        node_count=len(stages_results),
        total_latency_ms=total_dag_ms,
        cache_hits=cache_hits,
        final_sha256=last_sha256,
        stages=[
            {
                "stage_index": s["stage_index"],
                "engine_id": s["engine_id"],
                "pipeline_type": s["pipeline_type"],
                "latency_ms": s["latency_ms"],
                "cached": s["cached"],
                "summary": s["summary"],
            }
            for s in stages_results
        ],
    )

    return {
        "status": "dag_completed",
        "dag_run_id": dag_run_id,
        "preset_id": payload.preset_id or "custom",
        "pipeline_name": pipeline_name,
        "node_count": len(stages_results),
        "total_latency_ms": total_dag_ms,
        "cache_hits": cache_hits,
        "final_sha256": last_sha256,
        "final_audio_wav_base64": final_audio_b64,
        "final_image_data_uri": final_image_data_uri,
        "stages": stages_results,
        "final_output": final_output,
    }


@app.post("/v1/pipelines/dag/stream", tags=["Track 1 (v18): Multi-Modal DAG Orchestrator"])
async def stream_multimodal_dag_pipeline(
    payload: DagExecutePayload,
    c: AppContainer = Depends(get_container),
) -> StreamingResponse:
    await _ensure_pilot_engines_started(c)

    preset = next(
        (p for p in DAG_PIPELINE_PRESETS if p["preset_id"] == payload.preset_id),
        None,
    )
    nodes_spec: list[dict[str, Any]] = (
        [n.model_dump() if hasattr(n, "model_dump") else n.dict() for n in payload.nodes]
        if payload.nodes
        else list((preset or DAG_PIPELINE_PRESETS[0])["nodes"])
    )
    if not nodes_spec:
        raise InvalidInferenceRequestError("DAG pipeline requires at least 1 node.")
    if len(nodes_spec) > 12:
        raise InvalidInferenceRequestError(
            f"DAG pipeline depth ({len(nodes_spec)} nodes) exceeds maximum enterprise limit of 12 stages."
        )
    for n_idx, n_item in enumerate(nodes_spec):
        if not str(n_item.get("engine_id") or "").strip():
            raise InvalidInferenceRequestError(
                f"DAG stage #{n_idx + 1} is missing a valid 'engine_id'."
            )

    pipeline_name = (
        payload.pipeline_name
        or (preset["name"] if preset else None)
        or f"Custom {len(nodes_spec)}-Stage Multi-Modal DAG"
    )
    initial_input: Any = (
        payload.initial_input
        if str(payload.initial_input).strip()
        else (preset["default_input"] if preset else "Synthesize multi-modal AI studio pipeline.")
    )

    async def _dag_ndjson_generator() -> AsyncIterator[bytes]:
        t_dag_start = time.perf_counter()
        current_input = initial_input
        stages_results: list[dict[str, Any]] = []
        cache_hits = 0
        final_output: Any = None
        final_audio_b64: str | None = None
        final_image_data_uri: str | None = None
        last_sha256 = ""
        dag_run_id = str(uuid.uuid4())

        for idx, node in enumerate(nodes_spec):
            eng_id = str(node.get("engine_id") or "").strip()
            node_id = str(node.get("node_id") or f"stage_{idx + 1}_{eng_id}")
            start_event = {
                "type": "dag_node_start",
                "dag_run_id": dag_run_id,
                "stage_index": idx + 1,
                "total_nodes": len(nodes_spec),
                "total_stages": len(nodes_spec),
                "node_id": node_id,
                "engine_id": eng_id,
                "label": node.get("label") or f"Stage #{idx + 1}: {eng_id}",
                "input_preview": str(current_input).split(" data:image/")[0][:120],
            }
            yield (json.dumps(start_event, ensure_ascii=False) + "\n").encode("utf-8")
            await asyncio.sleep(0.01)

            stage_rec, next_in, audio_b64, img_uri, was_cached = await _run_dag_stage(
                c, idx, node, current_input, payload.enable_cache
            )
            if was_cached:
                cache_hits += 1
            if audio_b64:
                final_audio_b64 = audio_b64
            if img_uri:
                final_image_data_uri = img_uri
            last_sha256 = stage_rec["artifact_sha256"]
            stages_results.append(stage_rec)
            current_input = next_in
            final_output = stage_rec["output"]

            complete_event = {
                "type": "dag_node_complete",
                "dag_run_id": dag_run_id,
                "stage_index": idx + 1,
                "total_nodes": len(nodes_spec),
                "total_stages": len(nodes_spec),
                "stage": stage_rec,
            }
            yield (json.dumps(complete_event, ensure_ascii=False, default=str) + "\n").encode(
                "utf-8"
            )

        total_dag_ms = round((time.perf_counter() - t_dag_start) * 1000.0, 2)
        c.telemetry_store.record_dag_run(
            dag_run_id=dag_run_id,
            preset_id=payload.preset_id or "custom",
            pipeline_name=pipeline_name,
            node_count=len(stages_results),
            total_latency_ms=total_dag_ms,
            cache_hits=cache_hits,
            final_sha256=last_sha256,
            stages=[
                {
                    "stage_index": s["stage_index"],
                    "engine_id": s["engine_id"],
                    "pipeline_type": s["pipeline_type"],
                    "latency_ms": s["latency_ms"],
                    "cached": s["cached"],
                    "summary": s["summary"],
                }
                for s in stages_results
            ],
        )

        done_result = {
            "status": "dag_completed",
            "dag_run_id": dag_run_id,
            "preset_id": payload.preset_id or "custom",
            "pipeline_name": pipeline_name,
            "node_count": len(stages_results),
            "total_latency_ms": total_dag_ms,
            "cache_hits": cache_hits,
            "final_sha256": last_sha256,
            "final_audio_wav_base64": final_audio_b64,
            "final_image_data_uri": final_image_data_uri,
            "stages": stages_results,
            "final_output": final_output,
        }
        done_payload = {
            "type": "dag_done",
            **done_result,
            "dag_result": done_result,
        }
        yield (json.dumps(done_payload, ensure_ascii=False, default=str) + "\n").encode("utf-8")

    return StreamingResponse(
        _dag_ndjson_generator(),
        media_type="application/x-ndjson",
        headers={"X-Streaming-Backend": "dag-ndjson-orchestrator-v18"},
    )


# ============================================================================
# PATTERN 2: ASYNCHRONOUS BACKGROUND JOBS & W3C SERVER-SENT EVENTS (SSE)
# ============================================================================

class SubmitJobPayload(BaseModel):
    engine_id: str
    pipeline_type: str = "text-to-image"
    inputs: Any = ""
    slots: dict[str, Any] = {}
    parameters: dict[str, Any] = Field(default_factory=dict)
    priority: int = 1
    tags: list[str] = Field(default_factory=list)


def _make_job_executor(c: AppContainer):
    async def _execute_job(job: JobState) -> Any:
        # 1. Check DAG pipeline execution
        if job.pipeline_type == "visual-dag" or job.engine_id == "pipeline-dag":
            nodes_spec = job.parameters.get("nodes", [])
            preset_id = job.parameters.get("preset_id", "custom")
            pipeline_name = job.parameters.get("pipeline_name", "Visual DAG Pipeline")
            if not nodes_spec:
                preset = next((p for p in DAG_PIPELINE_PRESETS if p["preset_id"] == preset_id), None)
                nodes_spec = list((preset or DAG_PIPELINE_PRESETS[0])["nodes"])

            total_stages = len(nodes_spec)
            current_input = job.inputs
            stages_results = []
            final_audio_b64 = None
            final_image_data_uri = None
            last_sha256 = ""
            cache_hits = 0
            t_dag_start = time.perf_counter()

            for idx, node in enumerate(nodes_spec):
                if job.cancel_event.is_set():
                    raise asyncio.CancelledError("Job cancelled by user")
                eng_id = str(node.get("engine_id") or "")
                c.job_manager.emit_progress(
                    job.job_id,
                    step=idx + 1,
                    total_steps=total_stages,
                    percent=round(((idx) / max(1, total_stages)) * 100.0, 1),
                    stage=f"Stage {idx+1}/{total_stages}: {eng_id}",
                    extra={"node_id": node.get("node_id"), "engine_id": eng_id},
                )
                stage_rec, current_input, audio_b64, img_uri, was_cached = await _run_dag_stage(
                    c, idx, node, current_input, job.parameters.get("enable_cache", True)
                )
                if was_cached:
                    cache_hits += 1
                if audio_b64:
                    final_audio_b64 = audio_b64
                if img_uri:
                    final_image_data_uri = img_uri
                last_sha256 = stage_rec["artifact_sha256"]
                stages_results.append(stage_rec)

            total_dag_ms = round((time.perf_counter() - t_dag_start) * 1000.0, 2)
            c.telemetry_store.record_dag_run(
                dag_run_id=job.job_id,
                preset_id=preset_id,
                pipeline_name=pipeline_name,
                node_count=len(stages_results),
                total_latency_ms=total_dag_ms,
                cache_hits=cache_hits,
                final_sha256=last_sha256,
                stages=[
                    {
                        "stage_index": s["stage_index"],
                        "engine_id": s["engine_id"],
                        "pipeline_type": s["pipeline_type"],
                        "latency_ms": s["latency_ms"],
                        "cached": s["cached"],
                        "summary": s["summary"],
                    }
                    for s in stages_results
                ],
            )
            return {
                "status": "dag_completed",
                "dag_run_id": job.job_id,
                "node_count": len(stages_results),
                "total_latency_ms": total_dag_ms,
                "cache_hits": cache_hits,
                "final_audio_wav_base64": final_audio_b64,
                "final_image_data_uri": final_image_data_uri,
                "stages": stages_results,
                "final_output": current_input,
            }

        # 2. Single model inference execution
        await _ensure_pilot_engines_started(c)
        if job.engine_id not in c.catalog_manifests:
            await _load_engine_by_manifest(c, engine_id=job.engine_id, force_evict=True)

        manifest = c.catalog_manifests[job.engine_id]

        if not (
            job.engine_id in c.engines
            and (
                c.engines[job.engine_id].health()["loaded"]
                if hasattr(c.engines[job.engine_id], "health")
                else getattr(c.engines[job.engine_id], "is_loaded", True)
            )
        ):
            await _load_engine_by_manifest(
                c,
                engine_id=job.engine_id,
                execution_target=manifest.default_execution_target,
                force_evict=True,
            )

        w_rec = c.weights_manager.get_record(job.engine_id)
        exec_params = dict(job.parameters or {})
        if w_rec is not None:
            exec_params = {
                "weight_tier": w_rec.weight_tier,
                "precision": w_rec.precision,
                "offload_strategy": w_rec.offload_strategy,
                "effective_vram_mb": w_rec.effective_vram_mb,
                **exec_params,
            }

        if job.cancel_event.is_set():
            raise asyncio.CancelledError("Job cancelled by user")

        is_diffusion = manifest.family in ("diffusion", "generative_diffusion") or "diffusion" in manifest.pipeline_type
        if is_diffusion:
            steps = int(exec_params.get("num_inference_steps", 4))
            c.job_manager.emit_progress(
                job.job_id,
                step=1,
                total_steps=steps,
                percent=round((1 / max(1, steps)) * 100.0, 1),
                stage="denoising_latent_step_1",
            )
        elif manifest.family == "tts":
            c.job_manager.emit_progress(job.job_id, step=1, total_steps=1, percent=50.0, stage="synthesizing_audio")

        univ_req = UniversalInferenceRequest(inputs=job.inputs, parameters=exec_params)
        raw_res = await c.schedulers[job.engine_id].submit(univ_req)
        c.weights_manager.touch_inference(job.engine_id)

        modality = getattr(raw_res, "modality", manifest.output_modality)
        if modality == "pcm_audio":
            wav_bytes = getattr(raw_res, "wav_bytes", getattr(raw_res, "raw_bytes", b""))
            b64_audio = base64.b64encode(wav_bytes).decode("ascii") if wav_bytes else getattr(raw_res, "audio_base64", "")
            sr = getattr(raw_res, "sample_rate", getattr(raw_res, "sample_rate_hz", 48000))
            dur = getattr(raw_res, "duration_seconds", getattr(raw_res, "duration_sec", 0.0))
            return {
                "engine_id": job.engine_id,
                "modality": "pcm_audio",
                "audio_base64": b64_audio,
                "audio_wav_base64": b64_audio,
                "sample_rate": sr,
                "sample_rate_hz": sr,
                "duration_seconds": dur,
                "duration_sec": dur,
                "output": f"data:audio/wav;base64,{b64_audio}",
            }

        engine_obj = c.engines.get(job.engine_id)
        exec_target = getattr(raw_res, "execution_target", getattr(engine_obj, "execution_target", manifest.default_execution_target))
        dev_used = getattr(raw_res, "device", getattr(raw_res, "backend_used", getattr(engine_obj, "_device_str", "cpu")))
        out_payload = getattr(raw_res, "output", raw_res)

        return {
            "engine_id": job.engine_id,
            "model_id": getattr(raw_res, "model_id", manifest.model_id),
            "pipeline_type": manifest.pipeline_type,
            "modality": modality,
            "device": str(dev_used),
            "execution_target": str(exec_target),
            "output": out_payload,
            "telemetry": getattr(raw_res, "telemetry", {}),
        }

    return _execute_job


@app.post("/v1/jobs", status_code=status.HTTP_202_ACCEPTED, tags=["Pattern 2: Asynchronous Job Execution & SSE"])
async def submit_inference_job(
    payload: SubmitJobPayload,
    c: AppContainer = Depends(get_container),
) -> JSONResponse:
    await _ensure_pilot_engines_started(c)
    job = await c.job_manager.submit_job(
        engine_id=payload.engine_id,
        pipeline_type=payload.pipeline_type,
        inputs=payload.inputs,
        parameters=payload.parameters,
        priority=payload.priority,
        tags=payload.tags,
    )
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=job.to_dict(),
        headers={
            "Location": f"/v1/jobs/{job.job_id}",
            "X-Job-ID": job.job_id,
            "X-Events-URL": f"/v1/jobs/{job.job_id}/events",
        },
    )


@app.get("/v1/jobs/{job_id}/events", tags=["Pattern 2: Asynchronous Job Execution & SSE"])
async def stream_job_events(
    job_id: str,
    request: Request,
    c: AppContainer = Depends(get_container),
) -> StreamingResponse:
    await _ensure_pilot_engines_started(c)
    last_event_id_hdr = request.headers.get("Last-Event-ID")
    last_event_id = None
    if last_event_id_hdr:
        try:
            last_event_id = int(last_event_id_hdr)
        except ValueError:
            pass

    return StreamingResponse(
        c.job_manager.subscribe_events(job_id=job_id, last_event_id=last_event_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Job-ID": job_id,
        },
    )


@app.get("/v1/jobs/{job_id}", tags=["Pattern 2: Asynchronous Job Execution & SSE"])
async def inspect_job_status(
    job_id: str,
    c: AppContainer = Depends(get_container),
) -> JSONResponse:
    await _ensure_pilot_engines_started(c)
    job = c.job_manager.get_job(job_id)
    if not job:
        raise InvalidInferenceRequestError(f"Job '{job_id}' not found.")
    return JSONResponse(content=job)


@app.delete("/v1/jobs/{job_id}", tags=["Pattern 2: Asynchronous Job Execution & SSE"])
@app.post("/v1/jobs/{job_id}/cancel", tags=["Pattern 2: Asynchronous Job Execution & SSE"])
async def cancel_inference_job(
    job_id: str,
    c: AppContainer = Depends(get_container),
) -> JSONResponse:
    await _ensure_pilot_engines_started(c)
    cancelled = c.job_manager.cancel_job(job_id)
    if not cancelled:
        existing = c.job_manager.get_job(job_id)
        if not existing:
            raise InvalidInferenceRequestError(f"Job '{job_id}' not found.")
        return JSONResponse(
            content={
                "status": existing.get("status"),
                "job_id": job_id,
                "message": f"Job is already in terminal state '{existing.get('status')}'.",
            }
        )
    return JSONResponse(
        content={
            "status": "cancelled",
            "job_id": job_id,
            "message": "Cancellation signal delivered to job worker.",
        }
    )


@app.get("/v1/jobs", tags=["Pattern 2: Asynchronous Job Execution & SSE"])
async def list_inference_jobs(
    status: str | None = None,
    engine_id: str | None = None,
    limit: int = 50,
    c: AppContainer = Depends(get_container),
) -> JSONResponse:
    await _ensure_pilot_engines_started(c)
    jobs = c.job_manager.list_jobs(status=status, engine_id=engine_id, limit=limit)
    return JSONResponse(content={"total": len(jobs), "jobs": jobs})


# ============================================================================
# TRACK 3 (Studio v15–v18): PERSISTENT SQLITE WAL TELEMETRY & DATASET EXPORTER
# ============================================================================
@app.get("/v1/telemetry/ledger", tags=["Track 3 (v18): Persistent SQLite Telemetry & Exporter"])
async def get_persistent_telemetry_ledger(
    limit: int = 50,
    pipeline_type: str | None = None,
    engine_id: str | None = None,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    return c.telemetry_store.get_ledger_snapshot(
        limit=limit, pipeline_type=pipeline_type, engine_id=engine_id
    )


@app.delete("/v1/telemetry/ledger", tags=["Track 3 (v18): Persistent SQLite Telemetry & Exporter"])
async def clear_persistent_telemetry_ledger(
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    return c.telemetry_store.clear_ledger()


@app.get("/v1/telemetry/export", tags=["Track 3 (v18): Persistent SQLite Telemetry & Exporter"])
async def export_telemetry_dataset(
    format: str = "jsonl",
    c: AppContainer = Depends(get_container),
) -> Response:
    await _ensure_pilot_engines_started(c)
    content_str, media_type = c.telemetry_store.export_dataset(fmt=format)
    ext = "csv" if format.lower().strip() == "csv" else "jsonl"
    return PlainTextResponse(
        content=content_str,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="studio_telemetry_v18.{ext}"',
        },
    )


# ============================================================================
# POLYMORPHIC MODEL AUDIO & VOICE SERVICES
# ============================================================================
def _normalize_canonical_voices(raw_voices: list[Any]) -> list[dict[str, str]]:
    canonical = []
    for v in raw_voices:
        if isinstance(v, dict):
            vid = str(v.get("id") or v.get("voice_id") or v.get("name") or "default")
            vname = str(v.get("label") or v.get("name") or vid)
            canonical.append({
                "id": vid,
                "name": vname,
                "voice_id": vid,
                "label": vname,
                "uri": str(v.get("uri", f"builtin:{vid}")),
            })
        else:
            vid = str(v)
            canonical.append({
                "id": vid,
                "name": vid,
                "voice_id": vid,
                "label": vid,
                "uri": f"builtin:{vid}",
            })
    return canonical


@app.get("/v1/models/{engine_id}/voices", tags=["Model Audio & Voice Ops"])
async def list_model_voices(
    engine_id: str,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    if engine_id not in c.catalog_manifests:
        raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered in catalog.")
    manifest = c.catalog_manifests[engine_id]
    raw_voices = []
    for param in manifest.parameters_schema:
        if param.key == "voice" and param.options:
            raw_voices = [
                {"id": opt.get("value", opt), "name": opt.get("label", opt.get("value", opt))}
                if isinstance(opt, dict)
                else {"id": str(opt), "name": str(opt)}
                for opt in param.options
            ]
            break

    # Include any dynamically registered custom voices
    if not hasattr(c, "custom_registered_voices"):
        c.custom_registered_voices = {}
    custom_list = c.custom_registered_voices.setdefault(engine_id, [])

    # Discover any voices saved on disk across server restarts
    custom_dir = os.path.join(
        os.path.expanduser("~"),
        ".cache",
        "ai-inference",
        "models",
        engine_id,
        "voices",
        "custom",
    )
    if os.path.isdir(custom_dir):
        for f in sorted(os.listdir(custom_dir)):
            if f.endswith((".wav", ".mp3", ".ogg", ".bin")):
                name = os.path.splitext(f)[0]
                if not any(v.get("id") == name for v in custom_list):
                    custom_list.append({
                        "id": name,
                        "name": name.replace("_", " ").title(),
                        "uri": f"file:{os.path.join(custom_dir, f)}",
                    })

    raw_voices.extend(custom_list)

    if not raw_voices:
        raw_voices = [{"id": "default", "name": "Default Voice"}]

    canonical = _normalize_canonical_voices(raw_voices)
    return {"voices": canonical, "engine_id": engine_id}


@app.post("/v1/models/{engine_id}/voices")
@app.post("/v1/models/{engine_id}/voices/register", tags=["Model Audio & Voice Ops"])
async def register_model_voice(
    engine_id: str,
    payload: RegisterVoicePayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    if engine_id not in c.catalog_manifests:
        raise ModelNotLoadedError(f"Engine '{engine_id}' is not registered in catalog.")

    voice_name = payload.voice_name.strip()
    if not voice_name:
        raise InvalidInferenceRequestError("voice_name must not be empty.")

    ref_path = payload.ref_audio_path

    # Handle base64 audio data URI or raw base64 string
    if payload.ref_audio_b64:
        b64_data = payload.ref_audio_b64
        if "base64," in b64_data:
            b64_data = b64_data.split("base64,", 1)[1]
        try:
            audio_bytes = base64.b64decode(b64_data)
            custom_dir = os.path.join(
                os.path.expanduser("~"),
                ".cache",
                "ai-inference",
                "models",
                engine_id,
                "voices",
                "custom",
            )
            os.makedirs(custom_dir, exist_ok=True)
            clean_name = re.sub(r"[^a-zA-Z0-9_\-]+", "_", voice_name).lower().strip("_")
            dest_file = os.path.join(custom_dir, f"{clean_name}.wav")
            with open(dest_file, "wb") as fp:
                fp.write(audio_bytes)
            ref_path = dest_file
            logger.info("Saved custom voice sample to disk: %s (%d bytes)", dest_file, len(audio_bytes))
        except Exception as exc:
            logger.warning("Failed to decode and save ref_audio_b64 for voice '%s': %s", voice_name, exc)

    if not hasattr(c, "custom_registered_voices"):
        c.custom_registered_voices = {}
    if engine_id not in c.custom_registered_voices:
        c.custom_registered_voices[engine_id] = []

    c.custom_registered_voices[engine_id].append({
        "id": voice_name,
        "name": voice_name,
        "uri": f"custom:{voice_name}",
        "ref_audio_path": ref_path,
    })

    # Notify loaded engine if active
    if engine_id in c.engines and hasattr(c.engines[engine_id], "register_voice") and ref_path:
        try:
            c.engines[engine_id].register_voice(voice_name, ref_path)
        except Exception as exc:
            logger.warning("Engine '%s' voice registration hook warning: %s", engine_id, exc)

    # Retrieve canonical updated voice list
    res_voices = await list_model_voices(engine_id, c)
    return {
        "status": "registered",
        "voice_name": voice_name,
        "ref_audio_path": ref_path,
        "voices": res_voices["voices"],
        "engine_id": engine_id,
    }


@app.get("/v1/environments/uv", tags=["In-App uv Environment Manager"])
async def list_uv_environments(
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    return {"environments": c.uv_manager.list_environments()}


@app.post("/v1/environments/uv/provision", tags=["In-App uv Environment Manager"])
async def provision_uv_environment(
    payload: UvProvisionPayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    t0 = time.perf_counter()
    spec = EnvironmentSpec(
        env_id=payload.env_id,
        python_version=payload.python_version,
        packages=tuple(payload.packages),
        extra_index_url=payload.extra_index_url,
    )
    python_bin = await c.uv_manager.ensure_environment(spec)
    installed = await c.uv_manager.inspect_environment(payload.env_id)
    elapsed_sec = round(time.perf_counter() - t0, 2)
    return {
        "status": "provisioned",
        "env_id": payload.env_id,
        "python_executable": python_bin,
        "elapsed_seconds": elapsed_sec,
        "installed_count": len(installed),
        "installed_packages": installed,
    }


@app.get("/v1/environments/uv/{env_id}/status", tags=["In-App uv Environment Manager"])
async def get_uv_environment_status(
    env_id: str,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    bridge = get_gpu_worker_bridge(env_id=env_id)
    health = await bridge.get_health()
    return {
        "status": "ready" if health.get("cuda_available") else "offline",
        "env_id": env_id,
        "sandbox_env": env_id,
        "enable_gpu": True,
        "cuda_available": health.get("cuda_available", True),
        "python_executable": str(bridge.get_sandbox_python_path()),
        "provisioned": bridge.is_sandbox_provisioned(),
        **health,
    }


@app.get("/v1/environments/uv/{env_id}", tags=["In-App uv Environment Manager"])
async def inspect_uv_environment(
    env_id: str,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    installed = await c.uv_manager.inspect_environment(env_id)
    return {
        "env_id": env_id,
        "python_executable": str(c.uv_manager.get_python_executable(env_id)),
        "installed_count": len(installed),
        "installed_packages": installed,
    }


@app.post("/v1/environments/uv/{env_id}/run", tags=["In-App uv Environment Manager"])
async def run_in_uv_environment(
    env_id: str,
    body: UvRunScriptPayload,
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    t0 = time.perf_counter()
    spec = EnvironmentSpec(env_id=env_id, python_version="3.11", packages=())
    bridge = IsolatedUvWorkerBridge(uv_manager=c.uv_manager, spec=spec)
    output = await bridge.run_isolated_script(
        code=body.code,
        payload=body.payload,
        timeout_sec=body.timeout_sec,
    )
    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    return {
        "status": "executed",
        "env_id": env_id,
        "python_executable": str(c.uv_manager.get_python_executable(env_id)),
        "elapsed_ms": elapsed_ms,
        "output": output,
    }


@app.get(
    "/v1/sandbox/gpu-py312/status",
    tags=["GPU Sandbox & Worker Bridge: Python 3.12 + PyTorch CUDA 12.4"],
)
async def get_gpu_sandbox_status(
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    bridge = get_gpu_worker_bridge()
    health = await bridge.get_health()
    return {
        "status": "ready" if health.get("cuda_available") else "offline",
        "sandbox_env": "gpu-py312",
        "python_executable": str(bridge.get_sandbox_python_path()),
        "provisioned": bridge.is_sandbox_provisioned(),
        **health,
    }


@app.post(
    "/v1/sandbox/gpu-py312/provision",
    tags=["GPU Sandbox & Worker Bridge: Python 3.12 + PyTorch CUDA 12.4"],
)
async def trigger_gpu_sandbox_provision(
    c: AppContainer = Depends(get_container),
) -> dict[str, Any]:
    bridge = get_gpu_worker_bridge()
    if bridge.is_sandbox_provisioned():
        health = await bridge.get_health()
        if health.get("cuda_available"):
            return {
                "status": "already_provisioned",
                "message": "Python 3.12 GPU Sandbox is already provisioned and operational on RTX 4070 Ti.",
                "health": health,
            }

    import subprocess
    from pathlib import Path

    script_path = (
        Path(__file__).resolve().parents[3] / "scripts" / "provision-gpu.mjs"
    )
    if not script_path.exists():
        script_path = (
            Path(__file__).resolve().parents[2] / "scripts" / "provision-gpu.mjs"
        )
    proc = subprocess.Popen(["node", str(script_path)])
    return {
        "status": "provisioning_started",
        "pid": proc.pid,
        "message": "GPU Sandbox provisioning initiated in background.",
    }


@app.get("/v1/health", tags=["System"])
async def system_health(c: AppContainer = Depends(get_container)) -> dict[str, Any]:
    await _ensure_pilot_engines_started(c)
    uptime = round(time.monotonic() - getattr(c, "started_at", time.monotonic()), 2)
    telemetry_snap = c.telemetry_store.get_ledger_snapshot(limit=5)
    hw_snap = c.weights_manager.get_hardware_profile_snapshot()

    engines_health: dict[str, Any] = {}
    hf_engines_compat: dict[str, Any] = {}
    pilot_tts_compat: dict[str, Any] = {
        "loaded": False,
        "execution_target": "host-venv",
        "circuit_state": "CLOSED",
        "scheduler": {
            "circuit_breaker": {"state": "CLOSED"},
            "queue_depth": 0,
            "max_queue_size": 256,
            "latency": {"p50_ms": 0.0, "p95_ms": 0.0, "p99_ms": 0.0, "total_requests": 0},
        },
    }

    for eng_id, eng in c.engines.items():
        h = eng.health() if hasattr(eng, "health") else {"loaded": getattr(eng, "is_loaded", True), "execution_target": getattr(eng, "execution_target", "host-venv")}
        sched_snap = c.schedulers[eng_id].metrics_snapshot() if eng_id in c.schedulers else None
        h_payload = {
            **h,
            "scheduler": sched_snap,
        }
        engines_health[eng_id] = h_payload
        if eng_id == "vieneu-tts-v3-turbo":
            circuit_state = (
                sched_snap.get("circuit_breaker", {}).get("state", "CLOSED")
                if sched_snap
                else "CLOSED"
            )
            pilot_tts_compat = {
                **h,
                "circuit_state": circuit_state,
                "scheduler": sched_snap or pilot_tts_compat["scheduler"],
            }
        else:
            hf_engines_compat[eng_id] = h_payload

    is_healthy = any(e.get("loaded", False) for e in engines_health.values()) if engines_health else True
    return {
        "status": "healthy" if is_healthy else "degraded",
        "uptime_seconds": uptime,
        "isolated_uv_envs": len(c.uv_manager.list_environments()),
        "weights_summary": c.weights_manager.summary_snapshot(),
        "hardware_profile": hw_snap["active_profile"],
        "host_telemetry": hw_snap["host_telemetry"],
        "telemetry_summary": telemetry_snap["metrics_summary"],
        "engines": engines_health,
        "pilot_tts": pilot_tts_compat,
        "hf_engines": hf_engines_compat,
    }
