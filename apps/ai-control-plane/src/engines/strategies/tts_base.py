"""
tts_base.py — Shared utilities, audio normalization, and common result packing for TTS strategies.
"""
from __future__ import annotations

import base64
import logging
from typing import Any

import numpy as np
import torch

from engines.audio_utils import encode_wav_bytes

logger = logging.getLogger(__name__)


def host_cuda_available() -> bool:
    """Return True if PyTorch CUDA execution is available on the current host."""
    try:
        return torch is not None and torch.cuda.is_available()
    except Exception:
        return False


def normalize_audio_array(audio_arr: Any) -> np.ndarray:
    """Safely cast and clean raw audio waveforms into finite float32 numpy arrays."""
    if isinstance(audio_arr, torch.Tensor):
        audio_arr = audio_arr.detach().cpu().float().numpy()
    arr = np.asarray(audio_arr, dtype=np.float32).ravel()
    # Replace NaN or infinities with neutral zeros / bounds
    arr = np.nan_to_num(arr, nan=0.0, posinf=1.0, neginf=-1.0)
    # Clip within [-1.0, 1.0] to prevent digital clipping in WAV headers
    return np.clip(arr, -1.0, 1.0)


def build_audio_inference_response(
    audio_arr: np.ndarray,
    sample_rate: int,
    device: str,
    pipeline_type: str = "text-to-speech",
    output_modality: str = "pcm_audio",
    extra_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Encode audio samples to 16-bit PCM WAV and produce a compliant universal output dict."""
    clean_audio = normalize_audio_array(audio_arr)
    wav_bytes, duration_sec = encode_wav_bytes(clean_audio, sample_rate=sample_rate)
    audio_b64 = base64.b64encode(wav_bytes).decode("ascii")

    res: dict[str, Any] = {
        "modality": output_modality,
        "pipeline_type": pipeline_type,
        "sample_rate": sample_rate,
        "duration_seconds": duration_sec,
        "duration_sec": duration_sec,
        "audio_wav_base64": audio_b64,
        "wav_bytes": wav_bytes,
        "output": wav_bytes,
        "device": device,
    }
    if extra_metadata:
        res.update(extra_metadata)
    return res
