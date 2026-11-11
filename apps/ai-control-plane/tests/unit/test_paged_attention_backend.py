"""Unit tests for PagedAttentionBackend and in-process PagedKVCacheManager."""

from __future__ import annotations

import json
import pytest

from core.exceptions import InferenceBackendError
from core.execution_target import ExecutionTarget
from engines.backends import (
    InferenceBackend,
    InferenceBackendFactory,
    PagedAttentionBackend,
)
from engines.catalog_registry import ModelCapabilityManifest
from engines.paged_cache import PagedKVCacheManager


def test_paged_kv_cache_manager_prefix_caching_and_zero_fragmentation():
    """Verify PagedKVCacheManager allocates non-contiguous blocks and reuses shared prefixes."""
    mgr = PagedKVCacheManager(total_blocks=16, block_size=16)

    # Prompt 1: 32 tokens (needs 2 blocks)
    p1 = list(range(32))
    b1, hits1 = mgr.allocate_for_request("req_1", p1)
    assert b1 == [0, 1]
    assert hits1 == 0
    assert mgr.allocated_blocks_count == 2
    assert mgr.free_blocks_count == 14

    # Prompt 2: shares first 16 tokens with p1, but diverges on the second 16 tokens
    p2 = list(range(16)) + [999] * 16
    b2, hits2 = mgr.allocate_for_request("req_2", p2)
    # First block (0) must be shared (prefix hit)
    assert b2[0] == 0
    assert hits2 == 1
    # Second block must be a newly allocated physical block
    assert b2[1] == 2
    assert mgr.allocated_blocks_count == 3

    # Free request 1: block 0 should remain allocated because request 2 is referencing it
    mgr.free_request("req_1")
    assert mgr.allocated_blocks_count == 2  # blocks 0 and 2 are still in use by req_2

    # Free request 2: now all blocks should be returned to the free pool
    mgr.free_request("req_2")
    assert mgr.allocated_blocks_count == 0
    assert mgr.free_blocks_count == 16

    # Verify zero external fragmentation
    telemetry = mgr.get_telemetry()
    assert telemetry["external_fragmentation_percent"] == 0.0


def test_paged_kv_cache_saturation_error():
    """Verify PagedKVCacheManager raises InferenceBackendError when physical blocks are exhausted."""
    mgr = PagedKVCacheManager(total_blocks=2, block_size=16)

    # 48 tokens requires 3 blocks, but only 2 exist
    with pytest.raises(InferenceBackendError) as exc_info:
        mgr.allocate_for_request("heavy_req", list(range(48)))

    assert exc_info.value.error_code == "KV_CACHE_OUT_OF_MEMORY"
    # Pool remains clean after rollback
    assert mgr.allocated_blocks_count == 0


def test_paged_attention_backend_conforms_to_protocol():
    """Verify PagedAttentionBackend satisfies the InferenceBackend protocol."""
    backend = PagedAttentionBackend(total_blocks=64, block_size=16)
    assert isinstance(backend, InferenceBackend)
    assert backend.target.is_host
    assert not backend.is_loaded
    assert backend.device_str == "cpu"


@pytest.mark.asyncio
async def test_paged_attention_backend_lifecycle_and_inference():
    """Verify PagedAttentionBackend loading, inference, streaming, and telemetry."""
    backend = PagedAttentionBackend(total_blocks=64, block_size=16)

    load_res = await backend.load(
        engine_id="test-paged-engine",
        model_id="meta-llama/Llama-3.3-70B-Instruct",
        task="text-generation",
        vram_mb=8192,
    )

    assert backend.is_loaded
    assert load_res["status"] == "loaded"
    assert load_res["runtime"] == "paged_attention"

    # Single inference
    res, modality = backend.infer_single(
        engine_id="test-paged-engine",
        model_id="meta-llama/Llama-3.3-70B-Instruct",
        task="text-generation",
        inputs="Write an executive summary of PagedAttention:",
        parameters={"max_tokens": 16},
    )

    assert modality == "text"
    assert "tokens_generated" in res
    assert res["tokens_generated"] == 16
    assert "telemetry" in res
    assert res["telemetry"]["external_fragmentation_percent"] == 0.0

    # Stream inference
    chunks = []
    async for chunk in backend.infer_stream(
        engine_id="test-paged-engine",
        model_id="meta-llama/Llama-3.3-70B-Instruct",
        task="text-generation",
        inputs="Continuous streaming test:",
        parameters={"max_tokens": 5},
    ):
        chunks.append(chunk)

    assert len(chunks) == 5
    first_chunk = json.loads(chunks[0].decode("utf-8"))
    assert first_chunk["type"] == "token"
    assert "block_id" in first_chunk
    assert "step" in first_chunk

    # Unload
    await backend.unload("test-paged-engine")
    assert not backend.is_loaded


def test_factory_routes_paged_attention_manifest():
    """Verify InferenceBackendFactory resolves PagedAttentionBackend when manifest specifies runtime_backend='paged_attention'."""
    manifest = ModelCapabilityManifest(
        engine_id="llama-paged-test",
        display_name="Llama Paged Test",
        family="llm",
        task="text-generation",
        pipeline_category="generative_multimodal",
        pipeline_type="text-generation",
        model_id="meta-llama/Llama-3.3-70B-Instruct",
        input_modality="text",
        output_modality="token_stream",
        transport_protocol="application/x-ndjson",
        runtime_backend="paged_attention",
        remote_endpoint_url="http://localhost:8000/v1",
    )

    backend = InferenceBackendFactory.create_backend(ExecutionTarget.host(), manifest=manifest)
    assert isinstance(backend, PagedAttentionBackend)
