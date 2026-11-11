"""
Unit tests for decoupled TTS strategies and AdaptiveTtsStrategy router.
"""
from __future__ import annotations

import base64
import os
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from core.exceptions import ModelWeightsNotFoundError
from engines.strategies.base import PipelineStrategy
from engines.strategies.registry import StrategyRegistry
from engines.strategies.tts import (
    AdaptiveTtsStrategy,
    HuggingFaceTtsStrategy,
    KokoroTtsStrategy,
    VieneuTtsStrategy,
)
from engines.strategies.tts_kokoro import KokoroTtsStrategy as DirectKokoroStrategy
from engines.strategies.tts_vieneu import VieneuTtsStrategy as DirectVieneuStrategy
from engines.strategies.tts_hf import HuggingFaceTtsStrategy as DirectHfStrategy


def test_strategy_registry_resolves_tts_aliases():
    """Verify registry maps both 'text-to-speech' and specialized sub-aliases."""
    assert StrategyRegistry.get("text-to-speech") is AdaptiveTtsStrategy
    assert StrategyRegistry.get("tts") is AdaptiveTtsStrategy
    assert StrategyRegistry.get("kokoro-tts") is DirectKokoroStrategy
    assert StrategyRegistry.get("vieneu-tts") is DirectVieneuStrategy
    assert StrategyRegistry.get("hf-tts") is DirectHfStrategy


def test_kokoro_strategy_missing_weights_raises_typed_error(tmp_path):
    """Verify KokoroTtsStrategy raises ModelWeightsNotFoundError when ONNX files are absent."""
    kokoro = DirectKokoroStrategy()
    with patch.dict(os.environ, {"INFERENCE_CACHE_DIR": str(tmp_path)}):
        with pytest.raises(ModelWeightsNotFoundError) as exc_info:
            kokoro.load(engine_id="kokoro-82m-tts")
        assert "Kokoro ONNX weights" in str(exc_info.value)
        assert exc_info.value.engine_id == "kokoro-82m-tts"


def test_kokoro_strategy_mock_infer():
    """Verify KokoroTtsStrategy inference produces valid 24kHz audio output structure."""
    kokoro = DirectKokoroStrategy()
    mock_engine = MagicMock()
    mock_audio = np.sin(np.linspace(0, 1.0, 24000, endpoint=False)).astype(np.float32)
    mock_engine.infer.return_value = mock_audio
    mock_engine._voice_cache = {"af_bella": np.zeros((512, 256)), "am_adam": np.zeros((512, 256))}
    
    kokoro._primary_tts = mock_engine
    kokoro.is_loaded = True
    kokoro.sample_rate = 24000

    res = kokoro.infer("Hello world", {"voice": "af_bella", "speed": 1.0})
    assert res["modality"] == "pcm_audio"
    assert res["pipeline_type"] == "text-to-speech"
    assert res["sample_rate"] == 24000
    assert res["duration_seconds"] == pytest.approx(1.0, rel=1e-2)
    assert "audio_wav_base64" in res
    assert res["wav_bytes"][:4] == b"RIFF"

    voices = kokoro.list_voices()
    assert len(voices) == 2
    assert any(v["id"] == "af_bella" for v in voices)


def test_vieneu_strategy_fallback_stub_execution():
    """Verify VieneuTtsStrategy loads with graceful stub when package is missing and synthesizes 48kHz audio."""
    vieneu = DirectVieneuStrategy()
    load_res = vieneu.load(engine_id="vieneu-tts-v3-turbo")

    assert load_res["status"] == "ready"
    assert vieneu.sample_rate == 48000
    assert vieneu.is_loaded is True

    res = vieneu.infer("Xin chào Việt Nam", {"voice": "Hải Đăng"})
    assert res["modality"] == "pcm_audio"
    assert res["sample_rate"] == 48000
    assert res["duration_seconds"] > 0
    assert res["wav_bytes"][:4] == b"RIFF"

    voices = vieneu.list_voices()
    assert len(voices) >= 4
    assert any(v["id"] == "Hải Đăng" for v in voices)


def test_hf_tts_strategy_mock_pipeline():
    """Verify HuggingFaceTtsStrategy handles standard HF pipeline output dictionaries."""
    hf_strat = DirectHfStrategy()
    mock_pipe = MagicMock()
    mock_audio = np.zeros(16000, dtype=np.float32)
    mock_pipe.return_value = {"audio": mock_audio, "sampling_rate": 16000}

    hf_strat._pipe = mock_pipe
    hf_strat.is_loaded = True

    res = hf_strat.infer("Testing Hugging Face speech", {})
    assert res["modality"] == "pcm_audio"
    assert res["sample_rate"] == 16000
    assert res["duration_seconds"] == pytest.approx(1.0, rel=1e-2)
    assert res["wav_bytes"][:4] == b"RIFF"


def test_adaptive_tts_routing():
    """Verify AdaptiveTtsStrategy dynamically instantiates and delegates to the appropriate specialized strategy."""
    adaptive = AdaptiveTtsStrategy()
    assert isinstance(adaptive, PipelineStrategy)
    assert isinstance(adaptive, KokoroTtsStrategy)

    # 1. Routes to Vieneu for Vieneu models
    load_res_vieneu = adaptive.load(engine_id="vieneu-tts-v3-turbo", model_id="vieneu/vietnamese-voice-v3")
    assert isinstance(adaptive._delegate, VieneuTtsStrategy)
    assert adaptive.sample_rate == 48000
    assert load_res_vieneu["status"] == "ready"

    res = adaptive.infer("Xin chào", {"voice": "Hải Đăng"})
    assert res["sample_rate"] == 48000
    assert res["wav_bytes"][:4] == b"RIFF"

    # 2. Routes to HF for generic models
    with patch("transformers.pipeline") as mock_pipeline:
        mock_instance = MagicMock()
        mock_pipeline.return_value = mock_instance
        res = adaptive.load(engine_id="custom-parler-tts", model_id="parler-tts/parler-tts-mini-v1")
        assert isinstance(adaptive._delegate, HuggingFaceTtsStrategy)
        assert res["status"] == "ready"
