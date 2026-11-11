"""Shared Pure Audio DSP Utilities for Waveform Encoding and RIFF Streaming."""

from __future__ import annotations

import io
import re
import struct
import wave
from typing import Any

import numpy as np

try:
    import soundfile as sf  # type: ignore[import-untyped]
except ImportError:
    sf = None  # type: ignore[assignment]


def encode_wav_bytes(audio_array: np.ndarray, sample_rate: int = 48_000) -> tuple[bytes, float]:
    """Encode a 1D/2D float32 numpy audio array to 16-bit PCM WAV bytes with duration in seconds."""
    arr = np.asarray(audio_array, dtype=np.float32).squeeze()
    duration = float(arr.shape[0]) / float(sample_rate) if arr.size > 0 else 0.0
    buffer = io.BytesIO()

    if sf is not None:
        sf.write(buffer, arr, sample_rate, format="WAV", subtype="PCM_16")
    else:
        pcm16 = (np.clip(arr, -1.0, 1.0) * 32767.0).astype("<i2")
        with wave.open(buffer, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm16.tobytes())

    return buffer.getvalue(), round(duration, 4)


def build_streaming_wav_header(
    sample_rate: int = 48_000,
    channels: int = 1,
    bits_per_sample: int = 16,
) -> bytes:
    """Build a 44-byte RIFF WAV header for live HTTP chunked audio streaming (0xFFFFFFFF unknown length)."""
    byte_rate = sample_rate * channels * (bits_per_sample // 8)
    block_align = channels * (bits_per_sample // 8)
    unknown_size = 0xFFFFFFFF
    return struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        unknown_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        unknown_size,
    )


def parse_prosody_tags(text: str) -> tuple[str, list[dict[str, Any]]]:
    """Parse Vietnamese and international acoustic prosody tags such as [pause:0.4s] or [emphasis].

    Returns a cleaned string and a list of structured tag descriptors.
    """
    tags: list[dict[str, Any]] = []
    pattern = re.compile(r"\[(pause:([0-9.]+)s|emphasis|fast|slow)\]")

    def _replace(match: re.Match[str]) -> str:
        full = match.group(1)
        if full.startswith("pause:"):
            sec = float(match.group(2))
            tags.append({"type": "pause", "duration_sec": sec, "index": match.start()})
        else:
            tags.append({"type": full, "index": match.start()})
        return " "

    cleaned = pattern.sub(_replace, text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned, tags


def compute_rtf(latency_seconds: float, duration_seconds: float) -> float:
    """Compute Real-Time Factor (RTF = latency / duration). Lower is faster than real-time."""
    if duration_seconds <= 0:
        return 0.0
    return round(float(latency_seconds) / float(duration_seconds), 4)

