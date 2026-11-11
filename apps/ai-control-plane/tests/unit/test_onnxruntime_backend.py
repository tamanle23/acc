"""Unit tests for OnnxRuntimeBackend and execution provider negotiation."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch
import pytest

from core.execution_target import ExecutionTarget
from engines.backends import (
    InferenceBackend,
    InferenceBackendFactory,
    OnnxRuntimeBackend,
)
from engines.catalog_registry import ModelCapabilityManifest


def test_onnxruntime_backend_conforms_to_protocol():
    """Verify OnnxRuntimeBackend satisfies the formal InferenceBackend Protocol."""
    backend = OnnxRuntimeBackend()
    assert isinstance(backend, InferenceBackend)
    assert backend.target.is_host
    assert not backend.is_loaded
    assert backend.device_str == "cpu"


def test_provider_negotiation_priority_and_fallback():
    """Verify provider negotiation prioritizes available hardware accelerators and falls back safely to CPU."""
    # When host has only CPU
    with patch("onnxruntime.get_available_providers", return_value=["CPUExecutionProvider"]):
        providers = OnnxRuntimeBackend.negotiate_providers()
        assert providers == ["CPUExecutionProvider"]

        # Requesting unavailable DirectML or CUDA safely falls back to CPU
        providers_dml = OnnxRuntimeBackend.negotiate_providers(preferred="DirectMLExecutionProvider")
        assert providers_dml == ["CPUExecutionProvider"]

    # When host has DirectML available
    with patch("onnxruntime.get_available_providers", return_value=["DirectMLExecutionProvider", "CPUExecutionProvider"]):
        providers = OnnxRuntimeBackend.negotiate_providers(preferred="DirectMLExecutionProvider")
        assert providers[0] == "DirectMLExecutionProvider"
        assert "CPUExecutionProvider" in providers

    # When host has CUDA available
    with patch("onnxruntime.get_available_providers", return_value=["CUDAExecutionProvider", "CPUExecutionProvider"]):
        providers = OnnxRuntimeBackend.negotiate_providers()
        assert providers[0] == "CUDAExecutionProvider"


@pytest.mark.asyncio
async def test_onnxruntime_backend_load_and_infer_mocked():
    """Verify OnnxRuntimeBackend session loading, shape introspection, and inference execution."""
    backend = OnnxRuntimeBackend()

    mock_input = MagicMock()
    mock_input.name = "input_ids"
    mock_input.type = "tensor(int64)"

    mock_output = MagicMock()
    mock_output.name = "logits"

    mock_session = MagicMock()
    mock_session.get_inputs.return_value = [mock_input]
    mock_session.get_outputs.return_value = [mock_output]
    mock_session.run.return_value = [[[0.1, 0.9]]]

    with patch("os.path.exists", return_value=True), \
         patch("onnxruntime.InferenceSession", return_value=mock_session):

        load_res = await backend.load(
            engine_id="test-onnx-model",
            model_id="/fake/path/model.onnx",
            task="text-classification",
            vram_mb=512,
        )

        assert backend.is_loaded
        assert load_res["status"] == "loaded"
        assert load_res["inputs"] == ["input_ids"]
        assert load_res["outputs"] == ["logits"]

        # Run single inference
        res, modality = backend.infer_single(
            engine_id="test-onnx-model",
            model_id="/fake/path/model.onnx",
            task="text-classification",
            inputs=[101, 2054, 102],
            parameters={},
        )

        assert modality == "classification"
        assert "logits" in res["output"]
        assert mock_session.run.called

        # Run stream inference
        chunks = []
        async for chunk in backend.infer_stream(
            engine_id="test-onnx-model",
            model_id="/fake/path/model.onnx",
            task="text-classification",
            inputs=[101, 2054, 102],
            parameters={},
        ):
            chunks.append(chunk)

        assert len(chunks) == 1
        decoded = json.loads(chunks[0].decode("utf-8"))
        assert "output" in decoded

        # Unload
        await backend.unload("test-onnx-model")
        assert not backend.is_loaded


def test_factory_routes_onnxruntime_manifest():
    """Verify InferenceBackendFactory resolves OnnxRuntimeBackend when manifest specifies runtime_backend='onnxruntime'."""
    manifest = ModelCapabilityManifest(
        engine_id="kokoro-onnx-test",
        display_name="Kokoro ONNX Test",
        family="tts",
        task="text-to-speech",
        pipeline_category="audio_speech",
        pipeline_type="text-to-speech",
        model_id="hexgrad/Kokoro-82M",
        input_modality="text",
        output_modality="pcm_audio",
        transport_protocol="ReadableStream",
        runtime_backend="onnxruntime",
        preferred_execution_provider="DirectMLExecutionProvider",
    )

    backend = InferenceBackendFactory.create_backend(ExecutionTarget.host(), manifest=manifest)
    assert isinstance(backend, OnnxRuntimeBackend)
