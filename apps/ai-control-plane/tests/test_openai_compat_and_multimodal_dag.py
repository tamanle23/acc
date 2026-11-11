"""Integration Test Suite for OpenAI Compatible Gateway, Multipart Auto-Mapping, and RTF Telemetry.

Verifies:
1. POST /v1/audio/speech generates WAV audio bytes via Kokoro/VieNeu TTS.
2. POST /v1/audio/transcriptions accepts multipart audio files and produces text.
3. POST /v1/chat/completions returns standard OpenAI response with choices and usage.
4. POST /v1/images/generations returns standard OpenAI image array with data URIs.
5. Multipart auto-data URI mapping transforms raw binary uploads to base64 data URIs.
6. RTF (Real-Time Factor) is calculated and attached to responses and headers.
"""

from __future__ import annotations

import base64
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest
from fastapi.testclient import TestClient

from api.main import app, get_container
from core.protocols import UniversalInferenceRequest, UniversalInferenceResponse
from engines.audio_utils import compute_rtf, encode_wav_bytes


@pytest.fixture
def client():
    return TestClient(app)


def test_rtf_computation_helper():
    """Verify compute_rtf calculates Real-Time Factor accurately."""
    # 0.5s latency to generate 2.0s of audio -> RTF = 0.25 (4x faster than real-time)
    assert compute_rtf(0.5, 2.0) == 0.25
    # 3.0s latency to generate 1.0s of audio -> RTF = 3.0 (3x slower than real-time)
    assert compute_rtf(3.0, 1.0) == 3.0
    # Zero duration edge case
    assert compute_rtf(1.0, 0.0) == 0.0


def test_openai_speech_endpoint(client):
    """Verify POST /v1/audio/speech returns WAV audio bytes conforming to OpenAI format."""
    mock_audio = np.zeros(24000, dtype=np.float32)
    wav_bytes, dur = encode_wav_bytes(mock_audio, sample_rate=24000)

    mock_resp = UniversalInferenceResponse(
        engine_id="kokoro-82m-tts",
        model_id="hexgrad/Kokoro-82M",
        pipeline_type="text-to-speech",
        modality="pcm_audio",
        output={
            "modality": "pcm_audio",
            "wav_bytes": wav_bytes,
            "raw_bytes": wav_bytes,
            "sample_rate": 24000,
            "duration_seconds": dur,
        },
        raw_bytes=wav_bytes,
        sample_rate=24000,
        duration_seconds=dur,
    )

    c = get_container()
    mock_sched = MagicMock()
    mock_sched.submit = AsyncMock(return_value=mock_resp)
    mock_eng = MagicMock(is_loaded=True)
    mock_eng.health.return_value = {"loaded": True}

    with patch.dict(c.schedulers, {"kokoro-82m-tts": mock_sched}), \
         patch.dict(c.engines, {"kokoro-82m-tts": mock_eng}):

        response = client.post(
            "/v1/audio/speech",
            json={
                "model": "tts-1",
                "input": "Welcome to the unified multi-modal AI cockpit.",
                "voice": "af_bella",
                "response_format": "wav",
            },
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/wav"
        assert response.content[:4] == b"RIFF"
        assert response.content[8:12] == b"WAVE"


def test_openai_transcriptions_endpoint(client):
    """Verify POST /v1/audio/transcriptions accepts audio file and returns transcription."""
    mock_audio = np.zeros(16000, dtype=np.float32)
    wav_bytes, dur = encode_wav_bytes(mock_audio, sample_rate=16000)

    mock_resp = UniversalInferenceResponse(
        engine_id="whisper-large-v3-turbo",
        model_id="openai/whisper-large-v3-turbo",
        pipeline_type="automatic-speech-recognition",
        modality="timestamped_transcript",
        output={
            "modality": "timestamped_transcript",
            "text": "Hello this is a speech transcription test.",
            "duration_seconds": 1.0,
        },
    )

    c = get_container()
    mock_sched = MagicMock()
    mock_sched.submit = AsyncMock(return_value=mock_resp)
    mock_eng = MagicMock(is_loaded=True)
    mock_eng.health.return_value = {"loaded": True}

    with patch.dict(c.schedulers, {"whisper-large-v3-turbo": mock_sched}), \
         patch.dict(c.engines, {"whisper-large-v3-turbo": mock_eng}):

        response = client.post(
            "/v1/audio/transcriptions",
            data={"model": "whisper-1", "response_format": "json"},
            files={"file": ("test.wav", wav_bytes, "audio/wav")},
        )

        assert response.status_code == 200
        data = response.json()
        assert "text" in data
        assert data["text"] == "Hello this is a speech transcription test."


def test_openai_chat_completions_endpoint(client):
    """Verify POST /v1/chat/completions returns OpenAI-compliant choices structure."""
    mock_resp = UniversalInferenceResponse(
        engine_id="deepseek-r1-distill-qwen",
        model_id="deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
        pipeline_type="text-generation",
        modality="token_stream",
        output={
            "modality": "token_stream",
            "answer_markdown": "Telemetry report verified: all 8 local inference strategies operational.",
            "generated_text": "Telemetry report verified: all 8 local inference strategies operational.",
        },
    )

    c = get_container()
    mock_sched = MagicMock()
    mock_sched.submit = AsyncMock(return_value=mock_resp)
    mock_eng = MagicMock(is_loaded=True)
    mock_eng.health.return_value = {"loaded": True}

    with patch.dict(c.schedulers, {"deepseek-r1-distill-qwen": mock_sched}), \
         patch.dict(c.engines, {"deepseek-r1-distill-qwen": mock_eng}):

        response = client.post(
            "/v1/chat/completions",
            json={
                "model": "gpt-4o",
                "messages": [
                    {"role": "system", "content": "You are a cluster engineer."},
                    {"role": "user", "content": "Status check."},
                ],
                "temperature": 0.5,
                "max_tokens": 64,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["object"] == "chat.completion"
        assert len(data["choices"]) == 1
        assert data["choices"][0]["message"]["role"] == "assistant"
        assert "all 8 local inference strategies operational" in data["choices"][0]["message"]["content"]
        assert "usage" in data
        assert data["usage"]["total_tokens"] > 0


def test_openai_images_generations_endpoint(client):
    """Verify POST /v1/images/generations returns OpenAI-compliant data array."""
    dummy_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    mock_resp = UniversalInferenceResponse(
        engine_id="flux-1-schnell",
        model_id="black-forest-labs/FLUX.1-schnell",
        pipeline_type="text-to-image",
        modality="generated_image",
        output={
            "modality": "generated_image",
            "image_data_uri": dummy_uri,
        },
    )

    c = get_container()
    mock_sched = MagicMock()
    mock_sched.submit = AsyncMock(return_value=mock_resp)
    mock_eng = MagicMock(is_loaded=True)
    mock_eng.health.return_value = {"loaded": True}

    with patch.dict(c.schedulers, {"flux-1-schnell": mock_sched}), \
         patch.dict(c.engines, {"flux-1-schnell": mock_eng}):

        response = client.post(
            "/v1/images/generations",
            json={
                "model": "dall-e-3",
                "prompt": "Cyberpunk server room with purple ambient lighting",
                "size": "512x512",
                "response_format": "url",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == 1
        assert data["data"][0]["url"].startswith("data:image/png;base64,")


def test_multipart_auto_mapping_and_rtf_header(client):
    """Verify multipart uploads auto-map binary audio to data URI and calculate RTF."""
    mock_audio = np.zeros(24000, dtype=np.float32)
    wav_bytes, dur = encode_wav_bytes(mock_audio, sample_rate=24000)

    mock_resp = UniversalInferenceResponse(
        engine_id="kokoro-82m-tts",
        model_id="hexgrad/Kokoro-82M",
        pipeline_type="text-to-speech",
        modality="pcm_audio",
        output={
            "modality": "pcm_audio",
            "wav_bytes": wav_bytes,
            "raw_bytes": wav_bytes,
            "sample_rate": 24000,
            "duration_seconds": 1.0,
        },
        raw_bytes=wav_bytes,
        sample_rate=24000,
        duration_seconds=1.0,
    )

    c = get_container()
    mock_sched = MagicMock()
    mock_sched.submit = AsyncMock(return_value=mock_resp)
    mock_eng = MagicMock(is_loaded=True)
    mock_eng.health.return_value = {"loaded": True}

    with patch.dict(c.schedulers, {"kokoro-82m-tts": mock_sched}), \
         patch.dict(c.engines, {"kokoro-82m-tts": mock_eng}):

        response = client.post(
            "/v1/models/kokoro-82m-tts/infer",
            files={"file": ("prompt_audio.wav", wav_bytes, "audio/wav")},
            headers={"Accept": "audio/wav"},
        )

        assert response.status_code == 200
        # Verify submitted request had inputs populated as data URI
        assert mock_sched.submit.called
        call_arg = mock_sched.submit.call_args[0][0]
        assert isinstance(call_arg, UniversalInferenceRequest)
        assert call_arg.inputs.startswith("data:audio/wav;base64,")
        # Verify X-Real-Time-Factor header is present
        assert "x-real-time-factor" in response.headers
