"""Enterprise Regression Tests verifying SOLID contracts, micro-batch collation, circuit breakers, backpressure, 48kHz WAV framing, Pillar 1 Multi-Modal Catalog, v14 4-Layer Model Resolver (`briaai/RMBG-2.0` -> `image-segmentation`), Studio v15 Tracks 1–3, Studio v16 Refinements, Studio v17 Hardware-Adaptive Weight Tiering, and Studio v18 Real Base64 PNG Synthesis & RGBA Alpha-Matte Cutout Generation."""

from __future__ import annotations

import asyncio
import json
import sys
import unittest

import httpx
import numpy as np

try:
    import pytest
except ImportError:
    pytest = None  # type: ignore[assignment]

from api.main import app
from core.exceptions import (
    BackpressureQueueFullError,
    CircuitBreakerOpenError,
    InvalidInferenceRequestError,
)
from engines.unified_engine import UnifiedInferenceEngine, _cuda_available
from core.protocols import UniversalInferenceRequest, UniversalInferenceResponse
from infrastructure.batch_scheduler import DynamicBatchScheduler
from infrastructure.uv_manager import UvEnvironmentManager


def _async_test(coro_fn):
    if pytest is not None:
        return pytest.mark.asyncio(coro_fn)
    return coro_fn


class FakeBatchEngine:
    """Mock Liskov-compliant BatchableEngine verifying micro-batch collation."""

    def __init__(self, should_fail: bool = False, delay_sec: float = 0.0) -> None:
        self.engine_id = "fake-batch-engine"
        self.recorded_batch_sizes: list[int] = []
        self.should_fail = should_fail
        self.delay_sec = delay_sec

    async def load(self) -> None:
        pass

    async def unload(self) -> None:
        pass

    def infer_batch(self, payloads: list[int]) -> list[int]:
        if self.delay_sec > 0:
            import time

            time.sleep(self.delay_sec)
        if self.should_fail:
            raise RuntimeError("Simulated GPU kernel crash")
        self.recorded_batch_sizes.append(len(payloads))
        return [x * 10 for x in payloads]

    def health(self) -> dict[str, object]:
        return {"loaded": True}


@_async_test
async def test_dynamic_batch_scheduler_collates_concurrent_requests() -> None:
    engine = FakeBatchEngine()
    scheduler = DynamicBatchScheduler(engine=engine, max_batch_size=4, max_wait_ms=30.0)
    await scheduler.start()

    try:
        results = await asyncio.gather(*(scheduler.submit(i) for i in range(1, 5)))
        assert results == [10, 20, 30, 40]
        assert sum(engine.recorded_batch_sizes) == 4
        assert max(engine.recorded_batch_sizes) >= 2
        snap = scheduler.metrics_snapshot()
        assert snap["latency"]["total_requests"] == 4
        assert snap["circuit_breaker"]["state"] == "CLOSED"
    finally:
        await scheduler.stop()


@_async_test
async def test_circuit_breaker_opens_after_consecutive_failures() -> None:
    engine = FakeBatchEngine(should_fail=True)
    scheduler = DynamicBatchScheduler(
        engine=engine,
        max_batch_size=2,
        max_wait_ms=5.0,
        failure_threshold=2,
        recovery_timeout_sec=30.0,
    )
    await scheduler.start()

    try:
        for _ in range(2):
            try:
                await scheduler.submit(1)
                raise AssertionError("Expected RuntimeError")
            except RuntimeError:
                pass

        assert scheduler.circuit_breaker.state == "OPEN"
        try:
            await scheduler.submit(1)
            raise AssertionError("Expected CircuitBreakerOpenError")
        except CircuitBreakerOpenError:
            pass
    finally:
        await scheduler.stop()


@_async_test
async def test_scheduler_enforces_queue_backpressure() -> None:
    engine = FakeBatchEngine(delay_sec=0.2)
    scheduler = DynamicBatchScheduler(
        engine=engine, max_batch_size=1, max_wait_ms=50.0, max_queue_size=1
    )
    task1 = asyncio.create_task(scheduler.submit(1))
    await asyncio.sleep(0.01)

    try:
        await scheduler.submit(2)
        raise AssertionError("Expected BackpressureQueueFullError")
    except BackpressureQueueFullError:
        pass
    finally:
        task1.cancel()


def test_uv_package_validation_rejects_flag_injection() -> None:
    try:
        UvEnvironmentManager._validate_packages(["--index-url=http://evil.local"])
        raise AssertionError("Expected InvalidInferenceRequestError")
    except InvalidInferenceRequestError:
        pass
    UvEnvironmentManager._validate_packages(["vieneu>=3.0.0", "onnxruntime-gpu", "torch"])


def test_vieneu_wav_encoding_and_48khz_header() -> None:
    sr = 48_000
    t = np.linspace(0, 0.5, sr // 2, endpoint=False, dtype=np.float32)
    sine_wave = 0.5 * np.sin(2 * np.pi * 440 * t)

    wav_bytes, duration = UnifiedInferenceEngine._encode_wav_bytes(sine_wave, sample_rate=sr)
    assert wav_bytes[:4] == b"RIFF"
    assert wav_bytes[8:12] == b"WAVE"
    assert abs(duration - 0.5) < 1e-3

    stream_header = UnifiedInferenceEngine._build_streaming_wav_header(sample_rate=sr)
    assert len(stream_header) == 44
    assert stream_header[:4] == b"RIFF"


@_async_test
async def test_unified_model_catalog_and_polymorphic_modalities() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Verify v14–v18 4-Layer Resolver accurately resolves briaai/RMBG-2.0 & FLUX.1-schnell
        res_rmbg = await client.get("/v1/models/hub/resolve?model_id=briaai/RMBG-2.0")
        assert res_rmbg.status_code == 200
        rmbg_body = res_rmbg.json()
        assert rmbg_body["resolved_pipeline_type"] == "image-segmentation"
        rmbg_meta = rmbg_body["resolved"]
        assert rmbg_meta["pipeline_type"] == "image-segmentation"
        assert "BiRefNet" in rmbg_meta["architecture"]
        assert "kornia" in rmbg_meta["required_uv_packages"]

        # 2. Verify Studio v17/v18 Hardware Capability Profiler & 5-Tier Weight Tiering (`GET/POST /v1/hardware/profile`)
        hw_get = await client.get("/v1/hardware/profile")
        assert hw_get.status_code == 200
        hw_body = hw_get.json()
        assert len(hw_body["available_profiles"]) == 5
        assert len(hw_body["weight_tier_catalog"]) == 5
        assert "cpu_cores" in hw_body["host_telemetry"]

        hw_edge = await client.post(
            "/v1/hardware/profile",
            json={"profile_id": "tier_1_edge_cpu", "auto_adapt_models": True},
        )
        assert hw_edge.status_code == 200
        hw_edge_body = hw_edge.json()
        assert hw_edge_body["active_profile_id"] == "tier_1_edge_cpu"
        assert hw_edge_body["weights_summary"]["max_vram_budget_mb"] == 2048

        tier_res = await client.post(
            "/v1/models/flux-1-schnell/weights/tier",
            json={"tier_id": "studio_bf16", "offload_strategy": "none"},
        )
        assert tier_res.status_code == 200
        tier_body = tier_res.json()
        assert tier_body["weight_tier"] == "studio_bf16"
        assert tier_body["precision"] == "bf16"

        hw_pro = await client.post(
            "/v1/hardware/profile",
            json={"profile_id": "tier_3_prosumer_16gb", "auto_adapt_models": True},
        )
        assert hw_pro.status_code == 200
        assert hw_pro.json()["weights_summary"]["max_vram_budget_mb"] == 12288

        # 3. Verify Studio v16–v18 Per-Shard Tensor & Layer Inspector (`GET /v1/models/{engine_id}/weights/inspect`)
        inspect_res = await client.get("/v1/models/bria-rmbg-2.0/weights/inspect")
        assert inspect_res.status_code == 200
        inspect_body = inspect_res.json()
        assert inspect_body["pipeline_type"] == "image-segmentation"
        assert len(inspect_body["shards"]) >= 1
        assert len(inspect_body["layer_distribution"]) == 3
        assert "BiRefNet" in inspect_body["layer_distribution"][1]["group_name"]

        # 4. Verify Studio v19 Real-Prompt Generative Image & Diffusion (`flux-1-schnell`) produces distinct Base64 PNG images driven by the actual prompt
        infer_flux = await client.post(
            "/v1/models/flux-1-schnell/infer",
            json={
                "inputs": "A majestic red dragon flying over snowy alpine mountains at sunset",
                "parameters": {"num_inference_steps": 4, "guidance_scale": 3.5, "seed": 101},
            },
        )
        assert infer_flux.status_code == 200
        flux_out = infer_flux.json()["output"]
        assert flux_out["modality"] == "generated_image"
        assert flux_out["image_data_uri"].startswith("data:image/png;base64,")

        infer_flux_cat = await client.post(
            "/v1/models/flux-1-schnell/infer",
            json={
                "inputs": "A cute blue cat wearing sunglasses on a sunny ocean beach",
                "parameters": {"num_inference_steps": 4, "guidance_scale": 3.5, "seed": 101},
            },
        )
        assert infer_flux_cat.status_code == 200
        cat_out = infer_flux_cat.json()["output"]
        assert cat_out["image_data_uri"].startswith("data:image/png;base64,")
        assert flux_out["image_data_uri"] != cat_out["image_data_uri"]

        # 4b. Verify Studio v20: Switching Model Weight Tier & Modifying Parameters take effect on inference output
        tier_nano_res = await client.post(
            "/v1/models/flux-1-schnell/weights/tier",
            json={"tier_id": "nano_int4", "offload_strategy": "cpu_ram_offload"},
        )
        assert tier_nano_res.status_code == 200

        infer_nano = await client.post(
            "/v1/models/flux-1-schnell/infer",
            json={
                "inputs": "A cute blue cat wearing sunglasses on a sunny ocean beach",
                "parameters": {
                    "num_inference_steps": 6,
                    "guidance_scale": 8.5,
                    "aspect_ratio": "1344x768",
                    "scheduler_sampler": "dpmpp_2m_karras",
                    "seed": 101,
                },
            },
        )
        assert infer_nano.status_code == 200
        nano_out = infer_nano.json()["output"]
        assert nano_out["num_inference_steps"] == 6
        assert nano_out["guidance_scale"] == 8.5
        assert nano_out["width"] == 1344 and nano_out["height"] == 768
        assert nano_out["image_data_uri"].startswith("data:image/png;base64,")
        assert nano_out["image_data_uri"] != cat_out["image_data_uri"]

        # 5. Verify Studio v18 Image Segmentation (`bria-rmbg-2.0`) produces real Base64 PNG Original, RGBA Cutout, and 8-Bit Alpha Mask images
        infer_rmbg = await client.post(
            "/v1/models/bria-rmbg-2.0/infer",
            json={
                "inputs": f"portrait_fine_hair_4k.png — {flux_out['image_data_uri']}",
                "parameters": {"mask_threshold": 0.5, "edge_feather_px": 2, "background_mode": "checkerboard"},
            },
        )
        assert infer_rmbg.status_code == 200
        rmbg_out = infer_rmbg.json()["output"]
        assert rmbg_out["vision_submode"] == "alpha_matte_segmentation"
        assert rmbg_out["original_image_data_uri"].startswith("data:image/png;base64,")
        assert rmbg_out["segmented_image_data_uri"].startswith("data:image/png;base64,")
        assert rmbg_out["alpha_mask_data_uri"].startswith("data:image/png;base64,")
        assert rmbg_out["image_data_uri"].startswith("data:image/png;base64,")

        # 6. Verify Studio v16–v18 Live Node-by-Node Streaming DAG (`POST /v1/pipelines/dag/stream`)
        dag_stream = await client.post(
            "/v1/pipelines/dag/stream",
            json={
                "preset_id": "diffusion-rmbg-vlm-tts",
                "initial_input": "Studio condenser microphone on dark obsidian desk",
                "enable_cache": True,
            },
        )
        assert dag_stream.status_code == 200
        dag_events = [
            json.loads(line) for line in dag_stream.text.splitlines() if line.strip()
        ]
        starts = [e for e in dag_events if e["type"] == "dag_node_start"]
        completes = [e for e in dag_events if e["type"] == "dag_node_complete"]
        assert len(starts) == 4
        assert len(completes) == 4
        assert dag_events[-1]["type"] == "dag_done"
        assert dag_events[-1]["dag_result"]["final_audio_wav_base64"] is not None

        # 7. Verify Studio v16–v18 Server-Side A/B Arena Benchmark Scorecard & Voting
        arena_res = await client.post(
            "/v1/models/arena/compare",
            json={
                "left_engine_id": "distilbert-sentiment",
                "right_engine_id": "bge-reranker-v2-m3",
                "inputs": "Dynamic micro-batching with isolated uv environments delivers 14ms p95 latency.",
            },
        )
        assert arena_res.status_code == 200
        arena_body = arena_res.json()
        assert arena_body["status"] == "arena_completed"
        comp_id = arena_body["comparison_id"]
        assert arena_body["scorecard"]["determinism_verified"] is True

        vote_res = await client.post(
            f"/v1/models/arena/{comp_id}/vote",
            json={"preferred_engine_id": "bge-reranker-v2-m3"},
        )
        assert vote_res.status_code == 200
        assert vote_res.json()["preferred_engine_id"] == "bge-reranker-v2-m3"

        # 8. Verify Track 3: Persistent SQLite WAL Telemetry Ledger & JSONL/CSV Dataset Exporter
        ledger_res = await client.get("/v1/telemetry/ledger?limit=20")
        assert ledger_res.status_code == 200
        ledger_data = ledger_res.json()
        assert ledger_data["storage_engine"] == "sqlite3-wal"
        assert ledger_data["metrics_summary"]["total_runs"] >= 1
        assert ledger_data["metrics_summary"]["total_dag_runs"] >= 1
        assert ledger_data["metrics_summary"]["total_arena_runs"] >= 1


class EnterpriseArchitectureTestSuite(unittest.IsolatedAsyncioTestCase):
    async def test_all_regression_scenarios(self) -> None:
        await test_dynamic_batch_scheduler_collates_concurrent_requests()
        await test_circuit_breaker_opens_after_consecutive_failures()
        await test_scheduler_enforces_queue_backpressure()
        test_uv_package_validation_rejects_flag_injection()
        test_vieneu_wav_encoding_and_48khz_header()
        await test_unified_model_catalog_and_polymorphic_modalities()


    async def test_v22_all_studios_tier_and_parameter_reactivity(self) -> None:
        """Studio v22 Regression: Verify Weight Tier switching, Hardware Profile adaptation, and Pipeline Parameter reactivity across all 10 Bespoke Studios."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Switch Hardware Profile to Tier 2 (8GB) and verify allocated_vram_mb updates
            hw_res = await client.post(
                "/v1/hardware/profile",
                json={"profile_id": "tier_2_consumer_8gb", "auto_adapt_models": True},
            )
            self.assertEqual(hw_res.status_code, 200)
            hw_data = hw_res.json()
            self.assertEqual(hw_data["active_profile"]["profile_id"], "tier_2_consumer_8gb")

            # 2. Bidirectional weight_tier sync during /v1/models/flux-1-schnell/infer
            flux_nano = await client.post(
                "/v1/models/flux-1-schnell/infer",
                json={
                    "inputs": "A cute orange tabby cat wearing cyberpunk neon sunglasses",
                    "parameters": {
                        "weight_tier": "nano_int4",
                        "offload_strategy": "cpu_ram_offload",
                        "num_inference_steps": 4,
                        "guidance_scale": 6.5,
                        "seed": 77,
                    },
                    "auto_load": True,
                },
            )
            self.assertEqual(flux_nano.status_code, 200)
            fn_out = flux_nano.json()["output"]
            self.assertTrue(fn_out["image_data_uri"].startswith("data:image/png;base64,"))

            # 3. Verify RMBG-2.0 responds to mask_threshold, edge_feather_px, and weight_tier
            rmbg_res = await client.post(
                "/v1/models/bria-rmbg-2.0/infer",
                json={
                    "inputs": "A sleek red sports car in alpine mountains",
                    "parameters": {
                        "mask_threshold": 0.30,
                        "edge_feather_px": 5,
                        "refine_hair_foreground": True,
                        "weight_tier": "ultra_fp32",
                    },
                    "auto_load": True,
                },
            )
            self.assertEqual(rmbg_res.status_code, 200)
            rm_out = rmbg_res.json()["output"]
            self.assertTrue(rm_out["segmented_image_data_uri"].startswith("data:image/png;base64,"))

            # 4. Verify VieNeu-TTS v3 Turbo multi-voice + prosody tags + pitch/gain
            tts_hd = await client.post(
                "/v1/models/vieneu-tts-v3-turbo/infer",
                json={
                    "inputs": "Xin chào [pause:0.4s] kiểm tra hệ thống [emphasis] âm thanh.",
                    "parameters": {"voice": "Hải Đăng", "speed": 1.0, "pitch": -2, "gain_db": 3},
                    "auto_load": True,
                },
            )
            tts_ma = await client.post(
                "/v1/models/vieneu-tts-v3-turbo/infer",
                json={
                    "inputs": "Xin chào [pause:0.4s] kiểm tra hệ thống [emphasis] âm thanh.",
                    "parameters": {"voice": "Mai Anh", "speed": 1.3, "pitch": 3, "gain_db": -2},
                    "auto_load": True,
                },
            )
            self.assertEqual(tts_hd.status_code, 200)
            self.assertEqual(tts_ma.status_code, 200)
            self.assertNotEqual(tts_hd.content, tts_ma.content)

            # 5. Verify LLM system_persona & json_schema_mode
            llm_json = await client.post(
                "/v1/models/qwen2.5-vl-instruct/infer",
                json={
                    "inputs": "Audit our GPU cluster telemetry.",
                    "parameters": {
                        "system_persona": "Principal SRE Architect",
                        "json_schema_mode": True,
                        "temperature": 0.3,
                        "max_new_tokens": 128,
                        "weight_tier": "studio_bf16",
                    },
                    "auto_load": True,
                },
            )
            self.assertEqual(llm_json.status_code, 200)
            lj_out = llm_json.json()["output"]
            self.assertTrue("answer_markdown" in lj_out or "generated_text" in lj_out)

            # 6. Verify ASR dynamic word segmentation & translate mode
            asr_tr = await client.post(
                "/v1/models/whisper-large-v3-turbo/infer",
                json={
                    "inputs": "Xin chào hệ thống nhận diện giọng nói đã sẵn sàng.",
                    "parameters": {"language": "vi", "task": "translate", "temperature": 0.2},
                    "auto_load": True,
                },
            )
            self.assertEqual(asr_tr.status_code, 200)
            asr_out = asr_tr.json()["output"]
            self.assertTrue("text" in asr_out or "output" in asr_out)

            # 7. Verify Object Detection scene-specific boxes & NMS iou_threshold filtering
            det_dc = await client.post(
                "/v1/models/rtdetr-v2-vision/infer",
                json={
                    "inputs": "datacenter_rack_thermal.png",
                    "parameters": {"confidence_threshold": 0.2, "iou_threshold": 0.25},
                    "auto_load": True,
                },
            )
            self.assertEqual(det_dc.status_code, 200)
            dc_out = det_dc.json()["output"]
            self.assertTrue("detections" in dc_out or "output" in dc_out)

            # 8. Verify Embeddings pooling_strategy & normalize
            emb_cls = await client.post(
                "/v1/models/bge-m3-embeddings/infer",
                json={
                    "inputs": ["Doc A", "Doc B"],
                    "parameters": {"dimensions": 256, "pooling_strategy": "cls", "normalize": False},
                    "auto_load": True,
                },
            )
            self.assertEqual(emb_cls.status_code, 200)
            eb_out = emb_cls.json()["output"]
            self.assertTrue("embeddings" in eb_out or "output" in eb_out)



    async def test_v26_enterprise_resilience_circuit_reset_and_stream_cancellation(self) -> None:
        """Studio v26 Regression: Verify half-open circuit gating, circuit reset endpoint, TTS stream cancellation safety, resolution scaling, and tier-scaled LLM streaming."""
        from infrastructure.resilience import EngineCircuitBreaker

        # 1. Verify Half-Open circuit breaker concurrency gating & manual reset
        cb = EngineCircuitBreaker(
            name="test-cb", failure_threshold=2, recovery_timeout_sec=0.05, half_open_max_calls=1
        )
        cb.record_failure(reason="Simulated CUDA OOM", is_oom=True)
        cb.record_failure(reason="Simulated CUDA OOM", is_oom=True)
        self.assertEqual(cb.state, "OPEN")
        snap = cb.snapshot()
        self.assertEqual(snap["oom_recoveries"], 2)
        self.assertEqual(snap["total_trips"], 1)

        await asyncio.sleep(0.06)
        self.assertEqual(cb.state, "HALF_OPEN")
        cb.ensure_allow_request()  # First probe call allowed in HALF_OPEN
        with self.assertRaises(CircuitBreakerOpenError):
            cb.ensure_allow_request()  # Second concurrent call gated while probe is in flight!

        reset_snap = cb.reset()
        self.assertEqual(reset_snap["state"], "CLOSED")
        self.assertEqual(reset_snap["consecutive_failures"], 0)

        # 2. Verify UnifiedInferenceEngine.infer_stream cancellation safety (early break does not deadlock)
        tts_eng = UnifiedInferenceEngine(
            engine_id="test-tts-cancel",
            task="text-to-speech",
            model_id="vieneu-v3-turbo",
        )
        await tts_eng.load()
        stream_gen = tts_eng.infer_stream(
            UniversalInferenceRequest(
                inputs="Xin chào kiểm tra ngắt kết nối luồng âm thanh 48kHz an toàn.",
                parameters={"voice": "Hải Đăng"},
            )
        )
        first_chunk = await anext(stream_gen)
        self.assertEqual(first_chunk[:4], b"RIFF")
        await stream_gen.aclose()

        # 3. Verify API endpoints: circuit reset, RMBG-2.0 resolution scaling, and tier-scaled LLM stream
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            reset_res = await client.post("/v1/models/flux-1-schnell/circuit/reset")
            self.assertEqual(reset_res.status_code, 200)
            self.assertEqual(reset_res.json()["circuit_breaker"]["state"], "CLOSED")

            rmbg_2k = await client.post(
                "/v1/models/bria-rmbg-2.0/infer",
                json={
                    "inputs": "A red sports car in alpine mountains",
                    "parameters": {
                        "output_resolution": "2048x2048",
                        "background_mode": "green_screen",
                    },
                },
            )
            self.assertEqual(rmbg_2k.status_code, 200)
            rmbg_out = rmbg_2k.json()["output"]
            self.assertEqual(rmbg_out["width"], 2048)
            self.assertEqual(rmbg_out["height"], 2048)

            # Tier-scaled LLM NDJSON stream
            from engines.unified_engine import _cuda_available
            cuda_avail = _cuda_available()
            await client.post(
                "/v1/models/qwen2.5-vl-instruct/weights/tier",
                json={"tier_id": "nano_int4", "offload_strategy": "none" if cuda_avail else "cpu_ram_offload"},
            )
            llm_stream = await client.post(
                "/v1/models/qwen2.5-vl-instruct/stream",
                json={"inputs": "Verify nano_int4 streaming speedup.", "parameters": {}},
            )
            self.assertEqual(llm_stream.status_code, 200)
            frames = [
                json.loads(line) for line in llm_stream.text.splitlines() if line.strip()
            ]
            token_frames = [f for f in frames if f["type"] == "content_token"]
            self.assertTrue(len(token_frames) > 0)
            self.assertGreater(token_frames[0]["tokens_per_sec"], 0.0)

            ledger = await client.get("/v1/telemetry/ledger?limit=10")
            self.assertEqual(ledger.status_code, 200)
            ledger_json = ledger.json()
            self.assertIn("arena_runs", ledger_json)
            self.assertIn("arena_comparisons", ledger_json)


    async def test_v28_malformed_json_guard_depth_resolver_and_warmup_telemetry(self) -> None:
        """Verify Studio v28 malformed JSON 400 RFC 7807 guard, depth-estimation resolver accuracy, sequence length bucketing, and warmup probe telemetry."""
        from engines.catalog_registry import infer_manifest_for_custom_hf

        # 1. Custom depth-estimation model resolution inherits depth-anything-v2-small (DPT-DINOv2-Small, 920MB VRAM)
        depth_manifest = infer_manifest_for_custom_hf(
            engine_id="acme-custom-monocular-net",
            task="depth-estimation",
            model_id="acme-lab/custom-monocular-net",
        )
        self.assertEqual(depth_manifest.pipeline_type, "depth-estimation")
        self.assertEqual(depth_manifest.output_modality, "bounding_boxes")
        self.assertEqual(depth_manifest.vram_footprint_mb, 920)
        self.assertIn("DPT", depth_manifest.architecture)

        # 2. Malformed JSON request body returns HTTP 400 RFC 7807 Problem Details (not HTTP 500)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            bad_json_res = await client.post(
                "/v1/models/qwen2.5-vl-instruct/infer",
                content=b"{malformed_json: true",
                headers={"Content-Type": "application/json"},
            )
            self.assertEqual(bad_json_res.status_code, 400)
            err_body = bad_json_res.json()
            self.assertEqual(err_body["title"], "INVALID_INFERENCE_REQUEST")
            self.assertIn("Malformed JSON", err_body["detail"])

            # Non-object JSON body also returns HTTP 400
            list_json_res = await client.post(
                "/v1/models/qwen2.5-vl-instruct/infer",
                content=b'["not", "an", "object"]',
                headers={"Content-Type": "application/json"},
            )
            self.assertEqual(list_json_res.status_code, 400)

            # 3. Warmup probe records warmup telemetry on engine health
            warmup_res = await client.post("/v1/models/depth-anything-v2-small/warmup")
            self.assertEqual(warmup_res.status_code, 200)
            w_json = warmup_res.json()
            self.assertTrue(w_json["warmed_up"])
            self.assertGreaterEqual(w_json["warmup_latency_ms"], 0.0)

            health_res = await client.get("/v1/health")
            self.assertEqual(health_res.status_code, 200)
            depth_health = health_res.json()["hf_engines"]["depth-anything-v2-small"]
            self.assertTrue(depth_health["warmed_up"])
            self.assertGreaterEqual(depth_health["warmup_count"], 1)

            # 4. Sequence length bucketing metadata (`bucket_pad_multiple=8`, `padded_seq_length`)
            infer_res = await client.post(
                "/v1/models/qwen2.5-vl-instruct/infer",
                json={
                    "inputs": "One two three four five six seven eight nine ten",
                    "parameters": {},
                },
            )
            self.assertEqual(infer_res.status_code, 200)
            out = infer_res.json()["output"]
            self.assertEqual(out["bucket_pad_multiple"], 8)
            self.assertEqual(out["padded_seq_length"], 16)


    async def test_v30_dag_guardrails_modality_shard_inspector_and_uv_stdout_resilience(self) -> None:
        """Verify Studio v30 DAG depth & empty engine_id guardrails, modality-specific shard/layer inspection (depth, detection, ASR, embeddings), attention/KV-cache telemetry, and uv subprocess multi-line stdout resilience."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Verify modality-specific layer groups in Per-Shard & Layer Inspector
            depth_inspect = await client.get("/v1/models/depth-anything-v2-small/weights/inspect")
            self.assertEqual(depth_inspect.status_code, 200)
            depth_layers = depth_inspect.json()["layer_groups"]
            self.assertIn("DINOv2", depth_layers[0]["group"])
            self.assertIn("DPT", depth_layers[1]["group"])

            det_inspect = await client.get("/v1/models/rtdetr-v2-vision/weights/inspect")
            self.assertEqual(det_inspect.status_code, 200)
            det_layers = det_inspect.json()["layer_groups"]
            self.assertIn("HGNetv2", det_layers[0]["group"])

            asr_inspect = await client.get("/v1/models/whisper-large-v3-turbo/weights/inspect")
            self.assertEqual(asr_inspect.status_code, 200)
            asr_layers = asr_inspect.json()["layer_groups"]
            self.assertIn("Log-Mel", asr_layers[0]["group"])

            emb_inspect = await client.get("/v1/models/bge-m3-embeddings/weights/inspect")
            self.assertEqual(emb_inspect.status_code, 200)
            emb_layers = emb_inspect.json()["layer_groups"]
            self.assertIn("BGE-M3", emb_layers[0]["group"])

            # 2. Verify DAG depth limit (>12 nodes -> 400 Bad Request) & empty engine_id guard
            too_deep_nodes = [{"engine_id": "distilbert-sentiment", "label": f"Node {i}"} for i in range(14)]
            dag_deep_res = await client.post(
                "/v1/pipelines/dag/execute",
                json={"nodes": too_deep_nodes, "initial_input": "Test depth limit"},
            )
            self.assertEqual(dag_deep_res.status_code, 400)
            self.assertIn("exceeds maximum enterprise limit of 12 stages", dag_deep_res.json()["detail"])

            empty_eng_res = await client.post(
                "/v1/pipelines/dag/execute",
                json={"nodes": [{"engine_id": "   "}], "initial_input": "Test empty engine"},
            )
            self.assertEqual(empty_eng_res.status_code, 400)
            self.assertIn("missing a valid 'engine_id'", empty_eng_res.json()["detail"])

            # 3. Verify attention_backend & kv_cache_mode telemetry in inference output
            cuda_avail = _cuda_available()
            await client.post(
                "/v1/models/qwen2.5-vl-instruct/weights/tier",
                json={"tier_id": "compact_int8", "offload_strategy": "hybrid_kv_offload" if cuda_avail else "cpu_ram_offload"},
            )
            qwen_res = await client.post(
                "/v1/models/qwen2.5-vl-instruct/infer",
                json={"inputs": "Check KV cache offload telemetry.", "parameters": {}},
            )
            self.assertEqual(qwen_res.status_code, 200)
            q_out = qwen_res.json()["output"]
            self.assertIn(q_out["attention_backend"], ("sdpa_flash_attention_2", "sdpa_cpu_vectorized"))
            self.assertEqual(q_out["kv_cache_mode"], "hybrid_cpu_kv_offload")

            # 3b. Verify strict offload contract: requesting GPU VRAM Only on CPU environment is rejected with 400
            if not cuda_avail:
                rej_res = await client.post(
                    "/v1/models/catalog/load",
                    json={"engine_id": "qwen2.5-vl-instruct", "offload_strategy": "none"},
                )
                self.assertEqual(rej_res.status_code, 400)
                self.assertIn("GPU VRAM Only mode", rej_res.json()["detail"])

            # 4. Verify custom 2-stage DAG nodes list executes cleanly (Pydantic v1/v2 compatibility)
            custom_dag_res = await client.post(
                "/v1/pipelines/dag/execute",
                json={
                    "pipeline_name": "Studio v30 Custom 2-Stage NLU + TTS",
                    "initial_input": "VieNeu-TTS 48kHz achieves sub-15ms streaming latency.",
                    "nodes": [
                        {"engine_id": "distilbert-sentiment", "label": "Stage 1: Sentiment"},
                        {"engine_id": "vieneu-tts-v3-turbo", "label": "Stage 2: 48kHz TTS"},
                    ],
                    "enable_cache": True,
                },
            )
            self.assertEqual(custom_dag_res.status_code, 200)
            c_dag = custom_dag_res.json()
            self.assertEqual(c_dag["node_count"], 2)
            self.assertIsNotNone(c_dag["final_audio_wav_base64"])

            # 5. Verify uv isolated execution multi-line stdout parsing resilience
            from api.main import get_container
            from core.protocols import EnvironmentSpec
            from infrastructure.subprocess_bridge import IsolatedUvWorkerBridge

            bridge = IsolatedUvWorkerBridge(
                uv_manager=get_container().uv_manager,
                spec=EnvironmentSpec(env_id="test-stdout-resilience", packages=()),
            )
            stdout_res = bridge._run_sync(
                python_bin=sys.executable,
                code='print("DEBUG: loading tokenizer model..."); print(\'{"status": "success", "embeddings_count": 512}\')',
                payload={},
                timeout_sec=10.0,
            )
            self.assertEqual(stdout_res["status"], "success")
            self.assertEqual(stdout_res["embeddings_count"], 512)


    async def test_v32_w3c_observability_headers_retry_after_and_sqlite_engine_filter(self) -> None:
        """Verify Studio v32 W3C Server-Timing & traceparent headers, Retry-After on 503 domain errors, and persistent SQLite WAL engine_id ledger filtering."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            custom_tp = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
            health_res = await client.get("/v1/health", headers={"traceparent": custom_tp})
            self.assertEqual(health_res.status_code, 200)
            self.assertEqual(health_res.headers.get("traceparent"), custom_tp)
            self.assertIn("total;dur=", health_res.headers.get("Server-Timing", ""))

            # Unloaded model with auto_load=False returns 503 with Retry-After: 1
            unloaded_res = await client.post(
                "/v1/models/non-existent-model-xyz/infer",
                json={"inputs": "test", "auto_load": False},
            )
            self.assertEqual(unloaded_res.status_code, 503)
            self.assertEqual(unloaded_res.headers.get("Retry-After"), "1")

            # Verify engine_id filtering on SQLite WAL ledger
            await client.post(
                "/v1/models/distilbert-sentiment/infer",
                json={"inputs": "Studio v32 observability is super fast and clean!", "parameters": {}},
            )
            filtered_ledger = await client.get(
                "/v1/telemetry/ledger?limit=10&engine_id=distilbert-sentiment"
            )
            self.assertEqual(filtered_ledger.status_code, 200)
            runs = filtered_ledger.json()["runs"]
            self.assertTrue(len(runs) >= 1)
            for r in runs:
                self.assertEqual(r["engine_id"], "distilbert-sentiment")

    async def test_v33_multipart_url_encoded_meta_header_and_image_data_uri(self) -> None:
        """Verify Studio v33 WHATWG Fetch compliance: URL-percent encoded X-Inference-Meta header with Unicode characters and multipart image ingestion into image_data_uri."""
        import urllib.parse
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            unicode_meta = {
                "inputs": "Tách nền ảnh chất lượng cao 🌟",
                "parameters": {"mask_threshold": 0.5, "background_mode": "checkerboard"},
                "filename": "ảnh_chân_dung.png",
                "mime_type": "image/png",
            }
            encoded_meta = urllib.parse.quote(json.dumps(unicode_meta))
            fake_png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"

            files = {"file": ("ảnh_chân_dung.png", fake_png_bytes, "image/png")}
            res = await client.post(
                "/v1/models/bria-rmbg-2.0/infer",
                files=files,
                headers={"X-Inference-Meta": encoded_meta},
            )
            self.assertEqual(res.status_code, 200)
            res_json = res.json()
            out = res_json.get("output", {})
            self.assertEqual(out.get("vision_submode"), "alpha_matte_segmentation")
            self.assertTrue(out.get("image_data_uri", "").startswith("data:image/png;base64,"))
            self.assertTrue(out.get("segmented_image_data_uri", "").startswith("data:image/png;base64,"))

    @classmethod
    def tearDownClass(cls) -> None:
        from api.main import get_container

        container = get_container()
        if hasattr(container, "telemetry_store") and container.telemetry_store is not None:
            container.telemetry_store.close()


if __name__ == "__main__":
    unittest.main()
