"""
Unit tests for Dynamic Zero-Code Hugging Face Hub Onboarding & JIT Model Resolver.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.main import app
from engines.catalog_registry import (
    _probe_live_hf_hub_metadata,
    infer_manifest_for_custom_hf,
)


def test_probe_live_hf_hub_metadata_mocked():
    """Verify live HF hub metadata probe extracts pipeline_tag and config architecture."""
    mock_response = {
        "id": "HuggingFaceTB/SmolLM-135M",
        "pipeline_tag": "text-generation",
        "config": {"architectures": ["LlamaForCausalLM"], "model_type": "llama"},
        "tags": ["text-generation", "smollm", "pytorch"],
        "downloads": 54200,
        "sha": "1234567890abcdef",
    }

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps(mock_response).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        res = _probe_live_hf_hub_metadata("HuggingFaceTB/SmolLM-135M")
        assert res is not None
        assert res["pipeline_tag"] == "text-generation"
        assert res["config"]["architectures"] == ["LlamaForCausalLM"]


def test_infer_manifest_for_custom_hf_synthesizes_valid_manifest():
    """Verify infer_manifest_for_custom_hf dynamically constructs a ModelCapabilityManifest."""
    mock_hub = {
        "id": "meta-llama/Llama-3.2-1B-Instruct",
        "pipeline_tag": "text-generation",
        "config": {"architectures": ["LlamaForCausalLM"], "model_type": "llama"},
        "tags": ["text-generation", "llama-3.2"],
        "downloads": 120000,
        "sha": "abcdef1234567890",
    }

    with patch("engines.catalog_registry._probe_live_hf_hub_metadata", return_value=mock_hub):
        manifest = infer_manifest_for_custom_hf(
            engine_id="llama-3.2-1b-instruct",
            model_id="meta-llama/Llama-3.2-1B-Instruct",
            probe_remote_hub=True,
        )

        assert manifest.engine_id == "llama-3.2-1b-instruct"
        assert manifest.model_id == "meta-llama/Llama-3.2-1B-Instruct"
        assert manifest.pipeline_type == "text-generation"
        assert manifest.task == "text-generation"
        assert manifest.resolution_source == "hf_hub_live_api"
        assert len(manifest.parameters_schema) > 0
        assert any(p.key == "temperature" for p in manifest.parameters_schema)
        assert len(manifest.resolved_input_slots) > 0


def test_infer_manifest_offline_ontology_fallback():
    """Verify fallback to ontology heuristic rules when network probe returns None."""
    with patch("engines.catalog_registry._probe_live_hf_hub_metadata", return_value=None):
        manifest = infer_manifest_for_custom_hf(
            engine_id="custom-sam2-instance",
            model_id="facebook/sam2-hiera-tiny",
            probe_remote_hub=True,
        )

        assert manifest.pipeline_type == "image-segmentation"
        assert manifest.resolution_source == "ontology_architecture_resolver"
        assert manifest.resolution_confidence >= 0.90


def test_discover_model_endpoint():
    """Verify POST /v1/models/discover endpoint onboards arbitrary Hugging Face models."""
    client = TestClient(app)
    mock_hub = {
        "id": "openai/whisper-tiny",
        "pipeline_tag": "automatic-speech-recognition",
        "config": {"architectures": ["WhisperForConditionalGeneration"], "model_type": "whisper"},
        "tags": ["audio", "speech", "asr"],
        "downloads": 99999,
        "sha": "fedcba0987654321",
    }

    with patch("engines.catalog_registry._probe_live_hf_hub_metadata", return_value=mock_hub):
        res = client.post(
            "/v1/models/discover",
            json={"model_id": "openai/whisper-tiny", "auto_load": False},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "discovered"
        assert data["engine_id"] == "whisper-tiny"
        assert data["manifest"]["pipeline_type"] == "automatic-speech-recognition"
        assert data["resolution_source"] == "hf_hub_live_api"
