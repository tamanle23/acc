"""
Unit tests for Studio Voice Cloning, Base64 Audio Ingestion, and Disk-Persisted Voice Profiles.
"""
from __future__ import annotations

import base64
import os
import shutil

import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture
def clean_custom_voices(tmp_path):
    """Ensure clean custom voices test sandbox."""
    cache_base = str(tmp_path / "models")
    old_env = os.environ.get("INFERENCE_CACHE_DIR")
    os.environ["INFERENCE_CACHE_DIR"] = cache_base
    yield
    if old_env is not None:
        os.environ["INFERENCE_CACHE_DIR"] = old_env
    else:
        os.environ.pop("INFERENCE_CACHE_DIR", None)


def test_register_voice_with_base64_payload(clean_custom_voices):
    """Verify POST /v1/models/{engine_id}/voices/register decodes base64 WAV, saves to disk, and updates voice list."""
    client = TestClient(app)

    # 44-byte minimal valid WAV header
    fake_wav_header = (
        b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
    )
    b64_audio = f"data:audio/wav;base64,{base64.b64encode(fake_wav_header).decode('ascii')}"

    engine_id = "kokoro-82m-tts"
    res = client.post(
        f"/v1/models/{engine_id}/voices/register",
        json={
            "voice_name": "Test Cloned Voice Alpha",
            "ref_audio_b64": b64_audio,
        },
    )

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "registered"
    assert data["voice_name"] == "Test Cloned Voice Alpha"
    assert "ref_audio_path" in data
    assert data["ref_audio_path"] is not None
    assert os.path.isfile(data["ref_audio_path"])
    assert os.path.basename(data["ref_audio_path"]) == "test_cloned_voice_alpha.wav"

    # Verify voice is listed in GET /v1/models/{engine_id}/voices
    list_res = client.get(f"/v1/models/{engine_id}/voices")
    assert list_res.status_code == 200
    voices = list_res.json()["voices"]
    assert any(
        (v["id"] if isinstance(v, dict) else v) == "Test Cloned Voice Alpha"
        or (v.get("voice_id") if isinstance(v, dict) else v) == "Test Cloned Voice Alpha"
        for v in voices
    )


def test_custom_voices_disk_rediscovery():
    """Verify voices saved on disk in ~/.cache/ai-inference/models/{engine_id}/voices/custom/ are re-discovered across restarts."""
    client = TestClient(app)
    engine_id = "vieneu-tts-v3-turbo"

    # Emulate cold restart by purging in-memory custom_registered_voices for this engine
    from api.main import app as main_app

    # Ensure custom directory has a voice file
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
    sample_file = os.path.join(custom_dir, "cold_restart_speaker.wav")
    with open(sample_file, "wb") as fp:
        fp.write(b"RIFF fake audio")

    # Clear container in-memory register
    app_container = main_app.state.container if hasattr(main_app.state, "container") else None
    if app_container and hasattr(app_container, "custom_registered_voices"):
        app_container.custom_registered_voices.pop(engine_id, None)

    # Fetch voices
    res = client.get(f"/v1/models/{engine_id}/voices")
    assert res.status_code == 200
    voices = res.json()["voices"]
    assert any(
        (v["id"] if isinstance(v, dict) else v) == "cold_restart_speaker"
        or (v.get("voice_id") if isinstance(v, dict) else v) == "cold_restart_speaker"
        for v in voices
    )

    # Clean up test file
    try:
        os.remove(sample_file)
    except OSError:
        pass
