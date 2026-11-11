"""Unit tests for LlamaCppBackend, pure-Python GGUF parser, and n_gpu_layers calculation."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch
import pytest

from core.exceptions import InferenceBackendError
from core.execution_target import ExecutionTarget
from engines.backends import (
    InferenceBackend,
    InferenceBackendFactory,
    LlamaCppBackend,
)
from engines.catalog_registry import ModelCapabilityManifest
from engines.gguf_parser import create_synthetic_gguf_bytes, read_gguf_metadata


def test_gguf_binary_metadata_parser():
    """Verify pure-Python GGUF parser extracts architecture, context, and layers."""
    synthetic_bytes = create_synthetic_gguf_bytes(
        arch="qwen2.5",
        block_count=28,
        context_length=8192,
        file_type=12,  # Q4_K
        tensor_count=291,
    )

    meta = read_gguf_metadata(synthetic_bytes)
    assert meta.architecture == "qwen2.5"
    assert meta.context_length == 8192
    assert meta.block_count == 28
    assert meta.quantization_type == "Q4_K"
    assert meta.tensor_count == 291

    # Verify optimal layer calculation
    # Low VRAM (e.g. 512 MB overhead): 0 layers
    assert meta.calculate_optimal_gpu_layers(512) == 0
    # High VRAM (8192 MB): all 28 layers
    assert meta.calculate_optimal_gpu_layers(8192) == 28


def test_llamacpp_backend_conforms_to_protocol():
    """Verify LlamaCppBackend satisfies the InferenceBackend protocol."""
    backend = LlamaCppBackend()
    assert isinstance(backend, InferenceBackend)
    assert backend.target.is_host
    assert not backend.is_loaded
    assert backend.device_str == "cpu"


@pytest.mark.asyncio
async def test_llamacpp_backend_load_with_synthetic_gguf(tmp_path):
    """Verify LlamaCppBackend loads GGUF metadata and adapts n_gpu_layers."""
    gguf_file = tmp_path / "test_model.gguf"
    gguf_file.write_bytes(
        create_synthetic_gguf_bytes(
            arch="llama",
            block_count=32,
            context_length=4096,
            file_type=8,  # Q8_0
        )
    )

    backend = LlamaCppBackend()
    load_res = await backend.load(
        engine_id="test-gguf-engine",
        model_id=str(gguf_file),
        task="text-generation",
        vram_mb=6144,
    )

    assert backend.is_loaded
    assert load_res["status"] == "loaded"
    assert load_res["runtime"] == "llama_cpp"
    assert backend.n_gpu_layers > 0
    assert backend.metadata is not None
    assert backend.metadata.block_count == 32

    # Dynamic VRAM reallocation
    backend.sync_vram_allocation(target_vram_mb=256)
    assert backend.n_gpu_layers == 0  # Drops to 0 when VRAM is starved

    backend.sync_vram_allocation(target_vram_mb=12288)
    assert backend.n_gpu_layers == 32  # Offloads all layers on high VRAM

    await backend.unload("test-gguf-engine")
    assert not backend.is_loaded


@pytest.mark.asyncio
async def test_llamacpp_backend_infer_mocked():
    """Verify LlamaCppBackend completion and token streaming when llama_cpp is mocked."""
    backend = LlamaCppBackend()
    mock_llama = MagicMock()
    mock_llama.create_completion.side_effect = [
        # Single inference
        {"choices": [{"text": " Antigravity AI Control Plane"}], "usage": {"total_tokens": 6}},
        # Streaming inference
        [
            {"choices": [{"text": "Antigravity "}]},
            {"choices": [{"text": "AI "}]},
            {"choices": [{"text": "Control "}]},
            {"choices": [{"text": "Plane"}]},
        ],
    ]

    backend._llama = mock_llama
    backend._loaded = True

    # 1. Single inference
    res, modality = backend.infer_single(
        engine_id="mock-llama",
        model_id="/fake/model.gguf",
        task="text-generation",
        inputs="Describe system:",
        parameters={"max_tokens": 16, "temperature": 0.5},
    )

    assert modality == "text"
    assert "Antigravity AI Control Plane" in res["output"]

    # 2. Stream inference
    chunks = []
    async for chunk in backend.infer_stream(
        engine_id="mock-llama",
        model_id="/fake/model.gguf",
        task="text-generation",
        inputs="Describe system:",
        parameters={"max_tokens": 16, "temperature": 0.5},
    ):
        chunks.append(chunk)

    assert len(chunks) == 4
    first_token_data = json.loads(chunks[0].decode("utf-8"))
    assert first_token_data["token"] == "Antigravity "
    assert "ttft_ms" in first_token_data
    assert "tps" in first_token_data


def test_factory_routes_llamacpp_manifest():
    """Verify InferenceBackendFactory resolves LlamaCppBackend when manifest specifies runtime_backend='llama_cpp'."""
    manifest = ModelCapabilityManifest(
        engine_id="qwen-gguf-test",
        display_name="Qwen GGUF Test",
        family="llm",
        task="text-generation",
        pipeline_category="generative_multimodal",
        pipeline_type="text-generation",
        model_id="Qwen/Qwen2.5-Coder-7B-Instruct-GGUF",
        input_modality="text",
        output_modality="token_stream",
        transport_protocol="text/event-stream",
        runtime_backend="llama_cpp",
    )

    backend = InferenceBackendFactory.create_backend(ExecutionTarget.host(), manifest=manifest)
    assert isinstance(backend, LlamaCppBackend)
