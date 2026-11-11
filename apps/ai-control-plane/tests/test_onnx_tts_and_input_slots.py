"""Comprehensive Unit and Integration Test Suite for ONNX TTS & Declarative Input Slots.

Verifies:
1. Kokoro-82M & Vienue-TTS input slots descriptors in catalog registry.
2. validate_and_clamp_request contract: required slot validation, numeric slider clamping, select fallback.
3. Strict local cache policy: missing weights fast-fails with typed ModelWeightsNotFoundError & HTTP 404 RFC 7807 problem details (zero background downloads, zero unhandled 500s).
4. Kokoro-82M ONNX inference execution when weights are present producing 24kHz PCM WAV.
5. Dynamic voice discovery endpoints (GET /v1/models/{engine_id}/voices).
6. Custom voice cloning/registration (POST /v1/models/{engine_id}/voices/register).
7. UniversalInferenceRequest slots helper methods and text normalizations.
"""

from __future__ import annotations

import base64
import os
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from api.main import app
from core.exceptions import InvalidInferenceRequestError, ModelWeightsNotFoundError
from core.protocols import UniversalInferenceRequest
from engines.catalog_registry import (
    InputSlotDescriptor,
    ModelCapabilityManifest,
    ParameterSchemaField,
    PRECONFIGURED_MODEL_CATALOG,
)
from engines.validation import validate_and_clamp_request
from workers.gpu_worker import GPUWorkerServer


def test_kokoro_and_vieneu_manifest_descriptors():
    """Verify Kokoro-82M and Vienue manifests have explicit input_slots."""
    kokoro = PRECONFIGURED_MODEL_CATALOG.get("kokoro-82m-tts")
    assert kokoro is not None
    assert len(kokoro.resolved_input_slots) >= 2

    slots_by_id = {s.slot_id: s for s in kokoro.resolved_input_slots}
    assert "prompt" in slots_by_id
    assert slots_by_id["prompt"].required is True
    assert slots_by_id["prompt"].role == "prompt"
    assert slots_by_id["prompt"].data_type == "text"

    assert "ref_audio" in slots_by_id
    assert slots_by_id["ref_audio"].required is False
    assert slots_by_id["ref_audio"].role == "reference_media"

    # Verify JSON serialization includes input_slots
    k_dict = kokoro.to_dict()
    assert "input_slots" in k_dict
    assert isinstance(k_dict["input_slots"], list)
    assert any(s["slot_id"] == "prompt" for s in k_dict["input_slots"])
    assert any(s["slot_id"] == "ref_audio" for s in k_dict["input_slots"])

    vieneu = PRECONFIGURED_MODEL_CATALOG.get("vieneu-tts-v3-turbo")
    assert vieneu is not None
    v_slots = {s.slot_id: s for s in vieneu.resolved_input_slots}
    assert "prompt" in v_slots
    assert "ref_audio" in v_slots


def test_validate_and_clamp_request_contract():
    """Verify validate_and_clamp_request handles required slots, clamping, and fallbacks."""
    manifest = PRECONFIGURED_MODEL_CATALOG.get("kokoro-82m-tts")
    assert manifest is not None

    # 1. Missing required slot raises InvalidInferenceRequestError
    empty_req = UniversalInferenceRequest(inputs="")
    with pytest.raises(InvalidInferenceRequestError) as exc_info:
        validate_and_clamp_request(manifest, empty_req)
    assert "Missing required input slot" in str(exc_info.value)

    # 2. Out-of-bounds slider parameter gets clamped (schema: min=0.5, max=2.0)
    req_out_of_bounds = UniversalInferenceRequest(
        slots={"prompt": "Hello world from Kokoro"},
        parameters={"speed": 99.0},  # Max allowed is 2.0
    )
    clamped_req = validate_and_clamp_request(manifest, req_out_of_bounds)
    assert clamped_req.parameters["speed"] == 2.0

    req_too_low = UniversalInferenceRequest(
        slots={"prompt": "Hello world from Kokoro"},
        parameters={"speed": 0.01},  # Min allowed is 0.5
    )
    clamped_low = validate_and_clamp_request(manifest, req_too_low)
    assert clamped_low.parameters["speed"] == 0.5

    # 3. Invalid select option falls back to default schema voice ("Mai Anh")
    req_invalid_voice = UniversalInferenceRequest(
        slots={"prompt": "Hello world", "voice": "non_existent_voice_preset"},
        parameters={"voice": "non_existent_voice_preset"},
    )
    fallback_req = validate_and_clamp_request(manifest, req_invalid_voice)
    assert fallback_req.parameters["voice"] == "af_bella"
    assert fallback_req.slots["voice"] == "af_bella"


def test_kokoro_strict_local_cache_raises_404_problem_details():
    """Verify that requesting Kokoro without local weights returns HTTP 404 with RFC 7807 problem details."""
    from unittest.mock import patch, MagicMock
    from engines.backends import SandboxedWorkerBackend

    # 1. Verify SandboxedWorkerBackend fast-fails with typed ModelWeightsNotFoundError
    mock_bridge = MagicMock()
    mock_bridge.is_engine_loaded.return_value = False
    mock_bridge.load_model_sync.return_value = {
        "status": "error",
        "error_type": "MODEL_WEIGHTS_NOT_FOUND",
        "error": "Kokoro ONNX model weights for 'kokoro-82m-tts' are missing from local cache. Expected 'kokoro-v1_0.onnx'.",
        "missing_files": ["kokoro-v1_0.onnx"],
    }
    backend = SandboxedWorkerBackend(env_id="test-sandbox", bridge=mock_bridge)
    with pytest.raises(ModelWeightsNotFoundError) as exc_info:
        backend.infer_single("kokoro-82m-tts", "hexgrad/Kokoro-82M", "text-to-speech", "Hello", {})
    assert exc_info.value.error_code == "MODEL_WEIGHTS_NOT_FOUND"
    assert "kokoro-v1_0.onnx" in exc_info.value.missing_files

    # 2. Verify FastAPI translates ModelWeightsNotFoundError to HTTP 404 RFC 7807 Problem Details
    client = TestClient(app)
    with patch("api.main._load_engine_by_manifest", side_effect=ModelWeightsNotFoundError("Weights missing", engine_id="kokoro-82m-tts", missing_files=["kokoro-v1_0.onnx"])):
        response = client.post(
            "/v1/models/kokoro-82m-tts/infer",
            json={
                "inputs": "Testing Kokoro fast fail when weights are absent",
                "slots": {"prompt": "Testing Kokoro fast fail when weights are absent"},
            },
        )
        assert response.status_code == 404
        body = response.json()
        assert body.get("error_code") == "MODEL_WEIGHTS_NOT_FOUND"
        assert body.get("error_type") == "MODEL_WEIGHTS_NOT_FOUND"
        assert body.get("engine_id") == "kokoro-82m-tts"
        assert "missing_files" in body
        assert any("kokoro" in f for f in body["missing_files"])
        assert "resolution_advice" in body


def test_kokoro_gpu_worker_mock_onnx_inference():
    """Verify GPUWorkerServer ONNX TTS execution when model session is loaded."""
    server = GPUWorkerServer()
    server.device = "cpu"

    # Create mock ONNX session
    mock_session = MagicMock()
    mock_session.get_inputs.return_value = [
        MagicMock(name="input_ids"),
        MagicMock(name="style"),
        MagicMock(name="speed"),
    ]

    server.loaded_models["kokoro-82m-tts"] = {
        "type": "kokoro_onnx",
        "session": mock_session,
    }
    server.model_configs["kokoro-82m-tts"] = {
        "task": "text-to-speech",
        "model_id": "hexgrad/Kokoro-82M",
    }

    # Infer
    result = server.infer(
        "kokoro-82m-tts",
        inputs="Testing ONNX TTS synthesis directly on GPUWorkerServer",
        parameters={"speed": 1.0, "voice": "Mai Anh"},
    )

    assert "audio_wav_base64" in result
    assert result["audio_format"] == "wav"
    assert result["sample_rate"] == 24000
    assert result["duration_seconds"] > 0

    # Verify WAV header
    wav_bytes = base64.b64decode(result["audio_wav_base64"])
    assert wav_bytes[:4] == b"RIFF"
    assert wav_bytes[8:12] == b"WAVE"


def test_dynamic_voice_discovery_endpoints():
    """Verify GET /v1/models/{engine_id}/voices returns preset voices."""
    client = TestClient(app)

    # 1. Kokoro voices
    res_kokoro = client.get("/v1/models/kokoro-82m-tts/voices")
    assert res_kokoro.status_code == 200
    k_data = res_kokoro.json()
    assert "voices" in k_data
    voices = k_data["voices"]
    assert isinstance(voices, list)
    assert any("Mai Anh" in str(v) or "Bella" in str(v) for v in voices)
    assert len(voices) >= 11

    # 2. Vienue voices
    res_vieneu = client.get("/v1/models/vieneu-tts-v3-turbo/voices")
    assert res_vieneu.status_code == 200
    v_data = res_vieneu.json()
    assert "voices" in v_data
    v_voices = v_data["voices"]
    assert any("Hải Đăng" in str(v) or "v3" in str(v) for v in v_voices)
    assert len(v_voices) >= 25


def test_custom_voice_registration_endpoint():
    """Verify POST /v1/models/{engine_id}/voices registers new cloned voices."""
    client = TestClient(app)

    res = client.post(
        "/v1/models/kokoro-82m-tts/voices/register",
        json={"voice_name": "custom_cloned_voice_1", "ref_audio_path": "/path/to/sample.wav"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "registered"
    assert data["voice_name"] == "custom_cloned_voice_1"
    assert any(
        (v["id"] if isinstance(v, dict) else v) == "custom_cloned_voice_1"
        for v in data["voices"]
    )

    # Check that voice is now listed
    res_list = client.get("/v1/models/kokoro-82m-tts/voices")
    assert res_list.status_code == 200
    listed_voices = res_list.json()["voices"]
    assert any(
        (v["id"] if isinstance(v, dict) else v) == "custom_cloned_voice_1"
        for v in listed_voices
    )


def test_universal_inference_request_slots_methods():
    """Verify UniversalInferenceRequest slots accessors and normalizations."""
    # From slots dictionary
    req = UniversalInferenceRequest(
        slots={"prompt": "Synthesize this speech", "voice": "Mai Anh"},
    )
    assert req.as_text() == "Synthesize this speech"
    assert req.get_slot("voice") == "Mai Anh"
    assert req.get_slot("non_existent", "default_val") == "default_val"

    # From raw inputs string
    req_raw = UniversalInferenceRequest(
        inputs="Raw text input prompt",
    )
    assert req_raw.as_text() == "Raw text input prompt"
    assert req_raw.get_slot("prompt") == "Raw text input prompt"

def test_kokoro_real_onnx_neural_synthesis():
    """Verify real KokoroOnnxEngine executes speech synthesis with actual audio waveform."""
    import os
    import numpy as np
    from engines.kokoro_engine import KokoroOnnxEngine

    cache_dir = os.path.expanduser("~/.acc/.weights_cache/kokoro-82m-tts")
    model_path = os.path.join(cache_dir, "kokoro-v1_0.onnx")
    voices_dir = os.path.join(cache_dir, "voices")

    if not os.path.isfile(model_path):
        pytest.skip(f"Kokoro weights not found at {model_path}")

    engine = KokoroOnnxEngine(model_path, voices_dir, providers=["CPUExecutionProvider"])
    assert engine.sample_rate == 24000

    audio = engine.infer("Kokoro real neural speech synthesis verified.", voice="af_bella", speed=1.0)
    assert isinstance(audio, np.ndarray)
    assert audio.dtype == np.float32
    assert len(audio) > 1000
    # Standard deviation of real human speech must be non-zero (not silence or flat line)
    assert audio.std() > 0.02

    # Verify multi-sentence scaling
    single_audio = engine.infer("First sentence.", voice="am_adam", speed=1.0)
    multi_audio = engine.infer("First sentence. Second sentence here!", voice="am_adam", speed=1.0)
    assert len(multi_audio) > len(single_audio)
    assert multi_audio.std() > 0.02
