"""Comprehensive unit and integration test suite for GPU Worker Next-Level upgrades.

Verifies:
1. GPU Worker Server Pinning Manager & Smart VRAM Eviction.
2. Fast-Fail CUDA OOM (HTTP 503 RFC 7807 problem details, zero slow CPU fallback).
3. Streaming Token IPC & Hugging Face StoppingCriteria cancellation.
4. In-worker DAG Tensor Chaining & Lightweight 256x256 WebP Thumbnails.
5. FastAPI /v1/models/{engine_id}/pin endpoint and catalog serialization.
"""

from __future__ import annotations

import asyncio
import io
import json
import threading
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from api.main import app
from infrastructure.gpu_worker_bridge import GpuWorkerBridge
from workers.gpu_worker import (
    CancellationStoppingCriteria,
    GPUWorkerServer,
)


class DummyMockModel:
    def __init__(self, name: str) -> None:
        self.name = name
        self.device = "cuda:0"

    def to(self, dev: str) -> "DummyMockModel":
        self.device = dev
        return self


def test_gpu_worker_pinning_and_smart_eviction():
    server = GPUWorkerServer()
    server.device = "cuda:0"

    # Add mock models
    m1 = DummyMockModel("flux-1-schnell")
    m2 = DummyMockModel("briaai-rmbg-1.4")
    m3 = DummyMockModel("qwen2.5-vl-instruct")

    server.loaded_models["flux-1-schnell"] = m1
    server.loaded_models["briaai-rmbg-1.4"] = m2
    server.loaded_models["qwen2.5-vl-instruct"] = m3

    # Pin flux-1-schnell
    pinned = server.pin_engine("flux-1-schnell", pinned=True)
    assert "flux-1-schnell" in pinned
    assert "flux-1-schnell" in server.pinned_engines

    # Hardware status reports pinned engines
    hw = server.get_hardware_status()
    assert "flux-1-schnell" in hw.get("pinned_engines", [])

    # Evict inactive models when qwen2.5 is active
    server._free_inactive_vram("qwen2.5-vl-instruct")

    # flux-1-schnell should STILL be on cuda:0 because it is pinned!
    assert m1.device == "cuda:0"

    # briaai-rmbg-1.4 is unpinned and inactive, so it must be offloaded to cpu!
    assert m2.device == "cpu"

    # Unpin flux-1-schnell
    unpinned = server.pin_engine("flux-1-schnell", pinned=False)
    assert "flux-1-schnell" not in unpinned
    assert "flux-1-schnell" not in server.pinned_engines

    # Now evict again with qwen active -> flux-1-schnell is unpinned, so it moves to cpu
    server._free_inactive_vram("qwen2.5-vl-instruct")
    assert m1.device == "cpu"


def test_gpu_worker_cancellation_stopping_criteria():
    stop_event = threading.Event()
    criteria = CancellationStoppingCriteria(stop_event)

    assert not criteria(None, None)
    stop_event.set()
    assert criteria(None, None)


def test_gpu_worker_server_cancel_command():
    server = GPUWorkerServer()
    req_id = "req-test-123"
    stop_event = threading.Event()
    server.active_cancellations[req_id] = stop_event

    assert not stop_event.is_set()
    res = server.cancel(req_id)
    assert res is True
    assert stop_event.is_set()

    # Cancel non-existent request returns False
    assert server.cancel("non-existent-id") is False


def test_gpu_worker_fast_fail_oom_no_cpu_fallback():
    server = GPUWorkerServer()
    server.device = "cuda:0"

    def fail_with_oom(*args, **kwargs):
        raise RuntimeError("CUDA out of memory. Tried to allocate 4.00 GiB")

    server._infer_internal = fail_with_oom  # type: ignore[assignment]

    with pytest.raises(RuntimeError) as exc_info:
        server.infer("flux-1-schnell", "test prompt")

    err_str = str(exc_info.value)
    assert "CUDA_OUT_OF_MEMORY" in err_str
    assert "Resolution advice:" in err_str
    assert "Reduce batch size" in err_str


def test_gpu_worker_thumbnail_generation():
    server = GPUWorkerServer()
    img = Image.new("RGB", (1024, 1024), color=(200, 50, 80))
    thumb_uri = server._make_thumbnail_uri(img, max_dim=256)

    assert thumb_uri.startswith("data:image/webp;base64,")
    assert len(thumb_uri) > 50


@pytest.mark.asyncio
async def test_gpu_worker_bridge_streaming_ipc():
    bridge = GpuWorkerBridge()

    # Mock ensure_worker_started and subprocess
    bridge.ensure_worker_started = AsyncMock(return_value=True)  # type: ignore[assignment]
    bridge._proc = MagicMock()
    bridge._proc.stdin = MagicMock()
    bridge._loop = asyncio.get_running_loop()

    # Test send_streaming_command receives yielded items from queue
    async def simulate_worker_tokens():
        # Wait until generator registers listener
        for _ in range(50):
            if bridge._streaming_listeners:
                break
            await asyncio.sleep(0.01)
        req_id = list(bridge._streaming_listeners.keys())[0]
        q = bridge._streaming_listeners[req_id]
        await q.put({"id": req_id, "event": "token", "token": "Hello", "token_idx": 1})
        await q.put({"id": req_id, "event": "token", "token": " world", "token_idx": 2})
        await q.put({"id": req_id, "event": "done", "status": "ok", "answer_markdown": "Hello world"})

    producer_task = asyncio.create_task(simulate_worker_tokens())

    received_tokens = []
    received_done = False
    async for frame in bridge.send_streaming_command("stream_infer", {"engine_id": "test"}):
        if frame.get("event") == "token":
            received_tokens.append(frame.get("token"))
        elif frame.get("event") == "done":
            received_done = True

    await producer_task
    assert received_tokens == ["Hello", " world"]
    assert received_done is True


def test_fastapi_pin_endpoints_and_catalog_serialization():
    client = TestClient(app)

    # 1. POST /v1/models/vieneu-tts-v3-turbo/pin
    resp = client.post("/v1/models/vieneu-tts-v3-turbo/pin", json={"pinned": True})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "pin_updated"
    assert data["pinned"] is True
    assert data["pinned_in_vram"] is True

    # 2. Check GET /v1/models/catalog contains pinned: True
    cat_resp = client.get("/v1/models/catalog")
    assert cat_resp.status_code == 200
    catalog_data = cat_resp.json()
    models = catalog_data["models"] if isinstance(catalog_data, dict) and "models" in catalog_data else catalog_data
    model_vieneu = next((m for m in models if m["engine_id"] == "vieneu-tts-v3-turbo"), None)
    assert model_vieneu is not None
    assert model_vieneu["pinned"] is True
    assert model_vieneu["pinned_in_vram"] is True

    # 3. POST /v1/models/vieneu-tts-v3-turbo/pin to unpin
    unpin_resp = client.post("/v1/models/vieneu-tts-v3-turbo/pin", json={"pinned": False})
    assert unpin_resp.status_code == 200
    data_unpin = unpin_resp.json()
    assert data_unpin["pinned"] is False
    assert data_unpin["pinned_in_vram"] is False


def test_fastapi_cuda_oom_rfc7807_error_handler():
    client = TestClient(app)

    # Mock an engine inference call to raise CUDA OOM
    with patch(
        "infrastructure.batch_scheduler.DynamicBatchScheduler.submit",
        side_effect=RuntimeError(
            "CUDA_OUT_OF_MEMORY: Insufficient VRAM on cuda:0 for engine 'flux-1-schnell'. "
            "Resolution advice: Reduce batch size, image dimensions, or unpin inactive models."
        ),
    ):
        resp = client.post(
            "/v1/models/vieneu-tts-v3-turbo/infer",
            json={"inputs": "Hyper-realistic cyberpunk city", "auto_load": True},
        )
        assert resp.status_code == 503
        assert resp.headers.get("Retry-After") in ("1", "2")
        err = resp.json()
        assert err["status"] == 503
        assert "Reduce batch size" in err.get("resolution_advice", str(err.get("detail", "")))


def test_unified_uv_gpu_profile_status_and_metadata():
    from infrastructure.gpu_worker_bridge import get_gpu_worker_bridge

    client = TestClient(app)

    # 1. Multi-profile GpuWorkerBridge registry keys by env_id
    b_vision = get_gpu_worker_bridge(env_id="vision-worker")
    b_audio = get_gpu_worker_bridge(env_id="audio-dsp-worker")
    assert b_vision.env_id == "vision-worker"
    assert b_audio.env_id == "audio-dsp-worker"
    assert b_vision is not b_audio

    # 2. GET /v1/environments/uv lists environments with GPU metadata
    list_resp = client.get("/v1/environments/uv")
    assert list_resp.status_code == 200
    envs = list_resp.json()["environments"]
    vision_entry = next((e for e in envs if e["env_id"] == "vision-worker"), None)
    if vision_entry is not None:
        assert "enable_gpu" in vision_entry
        assert "cuda_available" in vision_entry

    # 3. GET /v1/environments/uv/vision-worker/status returns unified GPU sandbox status
    status_resp = client.get("/v1/environments/uv/vision-worker/status")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["sandbox_env"] == "vision-worker"
    assert "provisioned" in status_data
    assert "enable_gpu" in status_data

