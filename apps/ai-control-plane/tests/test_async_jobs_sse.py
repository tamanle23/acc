"""Enterprise Tests for Pattern 1 (Real-Time SSE Streaming) & Pattern 2 (Asynchronous Jobs with SSE)."""

from __future__ import annotations

import asyncio
import json
import pytest
import httpx
from httpx import ASGITransport

from api.main import app, _ensure_container_initialized
from infrastructure.job_manager import InferenceJobManager, JobState
from infrastructure.sqlite_telemetry_store import SqliteTelemetryStore


@pytest.mark.asyncio
async def test_job_manager_unit_lifecycle(tmp_path):
    """Test unit lifecycle of InferenceJobManager including SSE event emission, progress, and completion."""
    db_file = tmp_path / "test_jobs.db"
    store = SqliteTelemetryStore(db_path=db_file)

    async def fake_executor(job: JobState):
        job_manager.emit_progress(job.job_id, step=1, total_steps=2, percent=50.0, stage="step_1")
        await asyncio.sleep(0.05)
        job_manager.emit_progress(job.job_id, step=2, total_steps=2, percent=100.0, stage="step_2")
        return {"output_text": "Hello world from async job", "success": True}

    job_manager = InferenceJobManager(telemetry_store=store, execute_fn=fake_executor, max_workers=1)
    await job_manager.start()

    try:
        # 1. Submit job
        job = await job_manager.submit_job(
            engine_id="test-engine",
            pipeline_type="text-generation",
            inputs="Test prompt",
            parameters={"temperature": 0.5},
            priority=1,
            tags=["unit-test"],
        )
        assert job.status in ("queued", "running")
        job_id = job.job_id

        # 2. Subscribe to SSE events
        received_events = []
        async for sse_frame in job_manager.subscribe_events(job_id=job_id):
            received_events.append(sse_frame)
            if "event: completed" in sse_frame or "event: failed" in sse_frame or "event: cancelled" in sse_frame:
                break

        full_stream = "".join(received_events)
        assert "event: state" in full_stream or "event: queued" in full_stream
        assert "event: started" in full_stream
        assert "event: progress" in full_stream
        assert "event: completed" in full_stream
        assert "Hello world from async job" in full_stream

        # 3. Check persistent state
        persisted = job_manager.get_job(job_id)
        assert persisted is not None
        assert persisted["status"] == "completed"
        assert persisted["progress"]["percent"] == 100.0
        assert persisted["result"]["output_text"] == "Hello world from async job"

        # 4. Check replay via last_event_id
        replay_events = []
        async for sse_frame in job_manager.subscribe_events(job_id=job_id, last_event_id=1):
            replay_events.append(sse_frame)
        replay_stream = "".join(replay_events)
        assert len(replay_events) > 0
        assert "event: completed" in replay_stream

    finally:
        await job_manager.stop()
        store.close()


@pytest.mark.asyncio
async def test_job_manager_cancellation(tmp_path):
    """Test cooperative cancellation of a running job."""
    db_file = tmp_path / "test_cancel.db"
    store = SqliteTelemetryStore(db_path=db_file)

    async def slow_executor(job: JobState):
        for step in range(10):
            if job.cancel_event.is_set():
                raise asyncio.CancelledError("Cancelled by user")
            await asyncio.sleep(0.05)
        return {"done": True}

    job_manager = InferenceJobManager(telemetry_store=store, execute_fn=slow_executor, max_workers=1)
    await job_manager.start()

    try:
        job = await job_manager.submit_job(
            engine_id="slow-engine",
            pipeline_type="diffusion",
            inputs="slow generation",
        )
        await asyncio.sleep(0.02)
        # Cancel job
        cancelled = job_manager.cancel_job(job.job_id, reason="User clicked stop")
        assert cancelled is True

        # Check job status
        res = job_manager.get_job(job.job_id)
        assert res["status"] == "cancelled"
    finally:
        await job_manager.stop()
        store.close()


@pytest.mark.asyncio
async def test_api_jobs_endpoints_and_sse_stream():
    """Test FastAPI /v1/jobs API routes: submission, inspection, events SSE stream, listing, and cancellation."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Submit job via POST /v1/jobs
        submit_res = await client.post(
            "/v1/jobs",
            json={
                "engine_id": "distilbert-sentiment",
                "pipeline_type": "text-classification",
                "inputs": "The product works extraordinarily well!",
                "parameters": {},
                "priority": 1,
            },
        )
        assert submit_res.status_code == 202
        data = submit_res.json()
        assert "job_id" in data
        job_id = data["job_id"]
        assert data["status"] in ("queued", "running")
        assert data["events_url"] == f"/v1/jobs/{job_id}/events"

        # 2. Inspect job via GET /v1/jobs/{id}
        inspect_res = await client.get(f"/v1/jobs/{job_id}")
        assert inspect_res.status_code == 200
        inspect_data = inspect_res.json()
        assert inspect_data["job_id"] == job_id

        # 3. Stream SSE events via GET /v1/jobs/{id}/events
        events = []
        async with client.stream("GET", f"/v1/jobs/{job_id}/events") as stream:
            assert stream.status_code == 200
            assert "text/event-stream" in stream.headers.get("content-type", "")
            async for chunk in stream.aiter_text():
                events.append(chunk)
                if "event: completed" in chunk or "event: failed" in chunk:
                    break

        all_text = "".join(events)
        assert "id: " in all_text

        # 4. List jobs via GET /v1/jobs
        list_res = await client.get("/v1/jobs?limit=10")
        assert list_res.status_code == 200
        list_data = list_res.json()
        assert "jobs" in list_data
        assert any(j["job_id"] == job_id for j in list_data["jobs"])

        # 5. Test cancel on a fresh job
        job2_res = await client.post(
            "/v1/jobs",
            json={
                "engine_id": "distilbert-sentiment",
                "pipeline_type": "text-classification",
                "inputs": "Cancel me please",
            },
        )
        job2_id = job2_res.json()["job_id"]
        cancel_res = await client.delete(f"/v1/jobs/{job2_id}")
        assert cancel_res.status_code == 200
        assert cancel_res.json()["status"] in ("cancelled", "completed")


@pytest.mark.asyncio
async def test_api_polymorphic_stream_sse_mode():
    """Test Pattern 1: POST /v1/models/{engine_id}/stream with Accept: text/event-stream emits SSE frames."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        stream_chunks = []
        async with client.stream(
            "POST",
            "/v1/models/distilbert-sentiment/stream",
            headers={"Accept": "text/event-stream"},
            json={
                "inputs": "Great performance with instant streaming!",
                "parameters": {"format": "sse"},
            },
        ) as stream:
            assert stream.status_code == 200
            assert "text/event-stream" in stream.headers.get("content-type", "")
            async for chunk in stream.aiter_text():
                stream_chunks.append(chunk)

        full_stream = "".join(stream_chunks)
        assert "event: " in full_stream
        assert "data: " in full_stream


@pytest.mark.asyncio
async def test_api_jobs_tts_execution():
    """Verify submitting a TTS job via POST /v1/jobs produces audio_wav_base64 without attribute errors."""
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Submit TTS job
        res = await client.post(
            "/v1/jobs",
            json={
                "engine_id": "vieneu-tts-v3-turbo",
                "pipeline_type": "text-to-speech",
                "inputs": "Xin chào đây là bài kiểm tra tổng hợp giọng nói không lỗi.",
                "parameters": {"voice": "Hải Đăng", "speed": 1.0},
            },
        )
        assert res.status_code == 202
        job_id = res.json()["job_id"]

        # Connect to SSE stream and wait for completed event
        events = []
        async with client.stream("GET", f"/v1/jobs/{job_id}/events") as stream:
            assert stream.status_code == 200
            async for chunk in stream.aiter_text():
                events.append(chunk)
                if "event: completed" in chunk or "event: failed" in chunk:
                    break

        all_text = "".join(events)
        assert "event: completed" in all_text

        # Verify job snapshot has full audio payload
        get_res = await client.get(f"/v1/jobs/{job_id}")
        assert get_res.status_code == 200
        job_data = get_res.json()
        assert job_data["status"] == "completed"
        result = job_data["result"]
        assert "audio_wav_base64" in result
        assert len(result["audio_wav_base64"]) > 100
        assert result["sample_rate"] == 48000
        assert result["duration_seconds"] > 0

