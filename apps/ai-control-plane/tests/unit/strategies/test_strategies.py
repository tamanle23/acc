"""
Unit tests for PipelineStrategy implementations and StrategyRegistry.
"""
from __future__ import annotations

import base64
import io
import math
import struct
import wave
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
import torch
from PIL import Image

from engines.strategies.base import PipelineStrategy
from engines.strategies.registry import StrategyRegistry
from engines.strategies.asr import WhisperAsrStrategy
from engines.strategies.depth import DepthEstimationStrategy
from engines.strategies.detection import DetectionStrategy
from engines.strategies.diffusion import DiffusionStrategy
from engines.strategies.embeddings import EmbeddingsStrategy
from engines.strategies.llm import LlmGenerationStrategy
from engines.strategies.segmentation import SegmentationStrategy
from engines.strategies.tts import KokoroTtsStrategy


def _generate_synthetic_wav_bytes(duration_sec: float = 0.5, sample_rate: int = 16000) -> bytes:
    num_samples = int(duration_sec * sample_rate)
    samples = [int(32767 * math.sin(2 * math.pi * 440 * i / sample_rate)) for i in range(num_samples)]
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f"<{len(samples)}h", *samples))
    return buf.getvalue()


def test_strategy_registry_task_mapping():
    tasks = StrategyRegistry.list_supported_tasks()
    assert "automatic-speech-recognition" in tasks
    assert "asr" in tasks
    assert "text-to-speech" in tasks
    assert "tts" in tasks
    assert "depth-estimation" in tasks
    assert "image-segmentation" in tasks
    assert "text-generation" in tasks
    assert "text-to-image" in tasks
    assert "object-detection" in tasks
    assert "feature-extraction" in tasks

    # Verify instantiation
    asr = StrategyRegistry.create("automatic-speech-recognition")
    assert isinstance(asr, WhisperAsrStrategy)
    assert isinstance(asr, PipelineStrategy)

    tts = StrategyRegistry.create("text-to-speech")
    assert isinstance(tts, KokoroTtsStrategy)

    depth = StrategyRegistry.create("depth-estimation")
    assert isinstance(depth, DepthEstimationStrategy)

    seg = StrategyRegistry.create("image-segmentation")
    assert isinstance(seg, SegmentationStrategy)

    llm = StrategyRegistry.create("text-generation")
    assert isinstance(llm, LlmGenerationStrategy)

    diff = StrategyRegistry.create("text-to-image")
    assert isinstance(diff, DiffusionStrategy)

    det = StrategyRegistry.create("object-detection")
    assert isinstance(det, DetectionStrategy)

    emb = StrategyRegistry.create("feature-extraction")
    assert isinstance(emb, EmbeddingsStrategy)


def test_whisper_audio_decoding_and_extraction():
    wav_bytes = _generate_synthetic_wav_bytes(duration_sec=0.25, sample_rate=16000)
    samples = WhisperAsrStrategy.decode_audio_to_float32(wav_bytes)

    assert isinstance(samples, np.ndarray)
    assert samples.dtype == np.float32
    assert len(samples) == 4000
    assert not np.isnan(samples).any()

    # Test data URI extraction
    b64_uri = f"data:audio/wav;base64,{base64.b64encode(wav_bytes).decode('ascii')}"
    extracted = WhisperAsrStrategy.extract_audio_bytes(b64_uri, {})
    assert extracted == wav_bytes

    # Test parameter audio_data_uri extraction
    extracted_param = WhisperAsrStrategy.extract_audio_bytes("", {"audio_data_uri": b64_uri})
    assert extracted_param == wav_bytes


def test_whisper_mock_infer():
    asr = WhisperAsrStrategy()
    mock_pipe = MagicMock()
    mock_pipe.return_value = {
        "text": "Hello world from speech recognition",
        "language": "en",
        "chunks": [{"text": "Hello", "timestamp": (0.0, 0.5)}, {"text": "world", "timestamp": (0.5, 1.0)}],
    }
    asr._pipe = mock_pipe
    asr.is_loaded = True

    wav_bytes = _generate_synthetic_wav_bytes()
    res = asr.infer(wav_bytes, {"language": "en", "task": "transcribe"})

    assert res["modality"] == "timestamped_transcript"
    assert res["text"] == "Hello world from speech recognition"
    assert len(res["chunks"]) == 2


def test_depth_estimation_colormap_rendering():
    depth_strat = DepthEstimationStrategy()
    mock_pipe = MagicMock()
    # Mock depth output as 100x100 L image
    mock_depth_img = Image.new("L", (100, 100), color=128)
    mock_pipe.return_value = {"depth": mock_depth_img}
    depth_strat._pipe = mock_pipe
    depth_strat.is_loaded = True

    # Test turbo colormap
    res_turbo = depth_strat.infer("data:image/png;base64,fake", {"colormap": "turbo"})
    assert res_turbo["modality"] == "bounding_boxes"
    assert res_turbo["pipeline_type"] == "depth-estimation"
    assert "data:image/png;base64," in res_turbo["depth_data_uri"]

    # Test grayscale colormap
    res_gray = depth_strat.infer("data:image/png;base64,fake", {"colormap": "grayscale"})
    assert "data:image/png;base64," in res_gray["depth_data_uri"]


def test_segmentation_mock_infer():
    seg = SegmentationStrategy()
    mock_model = MagicMock()
    # Mock sigmoid output tensor 1x1x100x100
    mock_res = np.ones((1, 1, 100, 100), dtype=np.float32)
    mock_model.return_value = mock_res
    seg.model = mock_model
    seg.is_loaded = True

    res = seg.infer("data:image/png;base64,fake", {"mask_threshold": 0.5})
    assert res["modality"] == "bounding_boxes"
    assert res["pipeline_type"] == "image-segmentation"
    assert "segmented_image_data_uri" in res
    assert "alpha_mask_data_uri" in res
    assert res["foreground_coverage_pct"] >= 0.0


def test_llm_generation_mock_infer():
    llm = LlmGenerationStrategy()
    mock_input_ids = torch.zeros((1, 5), dtype=torch.long)
    mock_tokenizer = MagicMock()
    mock_tokenizer.return_value = {
        "input_ids": mock_input_ids,
        "attention_mask": torch.ones((1, 5)),
    }
    mock_tokenizer.decode.side_effect = ["Paris", "What is the capital of France? Paris"]

    mock_model = MagicMock()
    mock_model.generate.return_value = torch.tensor([[1, 2, 3, 4, 5, 6]], dtype=torch.long)

    llm.tokenizer = mock_tokenizer
    llm.model = mock_model
    llm.is_loaded = True

    res = llm.infer("What is the capital of France?", {"max_new_tokens": 10})
    assert res["modality"] == "token_stream"
    assert "Paris" in res["answer_markdown"]
    assert res["tokens_generated"] == 1


def test_embeddings_mock_infer():
    emb = EmbeddingsStrategy()
    mock_tokenizer = MagicMock()
    mock_tokenizer.return_value = {
        "input_ids": MagicMock(),
        "attention_mask": np.ones((1, 4), dtype=np.float32),
        "to": lambda dev: {
            "input_ids": MagicMock(),
            "attention_mask": torch.ones((1, 4)),
        },
    }

    mock_model = MagicMock()
    mock_last_hidden = torch.ones((1, 4, 384))
    mock_out = MagicMock()
    mock_out.last_hidden_state = mock_last_hidden
    mock_model.return_value = mock_out

    emb.tokenizer = mock_tokenizer
    emb.model = mock_model
    emb.is_loaded = True
    emb.is_classification = False

    res = emb.infer(["Audio control plane"], {})
    assert res["modality"] == "embeddings"
    assert res["count"] == 1
    assert res["dimensions"] == 384
    assert len(res["embeddings"]) == 1

