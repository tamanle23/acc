"""Production ONNX Inference Engine for Kokoro-82M Neural Text-to-Speech (`kokoro_engine.py`).

Provides high-throughput, low-latency neural TTS synthesis for Kokoro-82M via ONNX Runtime:
- Multi-sentence regex normalization and segmentation.
- eSpeak-NG G2P phonemization and vocabulary tokenization via `kokoro_onnx.Tokenizer`.
- Stateless per-request voice style embedding resolution from 512x256 float32 `.bin` profiles.
- Native 24,000 Hz float32 PCM output with dynamic gain scaling and safety clipping.
- Isomorphic execution across both host (`host-venv`) and worker sandboxes (`uv-sandbox:gpu-py312`).
"""

from __future__ import annotations

import glob
import logging
import os
import re
from typing import Any, Iterator

import numpy as np

logger = logging.getLogger("kokoro_engine")

# Canonical aliases for backward compatibility and dialect selection
VOICE_ALIASES: dict[str, str] = {
    "mai anh": "af_bella",
    "hải đăng": "am_adam",
    "hai dang": "am_adam",
}


class KokoroOnnxEngine:
    """State-of-the-art ONNX runtime engine for Kokoro-82M neural TTS."""

    sample_rate: int = 24_000

    def __init__(
        self,
        model_path: str,
        voices_dir: str,
        providers: list[str] | None = None,
    ) -> None:
        self.model_path = os.path.abspath(model_path)
        self.voices_dir = os.path.abspath(voices_dir)
        self.providers = providers or ["CPUExecutionProvider"]

        import onnxruntime as ort

        # Initialize session with requested execution providers (CUDA or CPU)
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(
            self.model_path,
            sess_options=sess_options,
            providers=self.providers,
        )

        input_names = [inp.name for inp in self.session.get_inputs()]
        self.token_key = "input_ids" if "input_ids" in input_names else "tokens"

        self._tokenizer = None
        self._voice_cache: dict[str, np.ndarray] = {}
        self._preload_voices()

    def _preload_voices(self) -> None:
        """Discover and preload all official voice profile embeddings into memory."""
        if not os.path.isdir(self.voices_dir):
            logger.warning("Kokoro voices directory does not exist: %s", self.voices_dir)
            return

        for bin_file in glob.glob(os.path.join(self.voices_dir, "*.bin")):
            name = os.path.splitext(os.path.basename(bin_file))[0]
            try:
                # Kokoro voice embedding shape: (512, 256) float32
                arr = np.fromfile(bin_file, dtype=np.float32).reshape(-1, 256)
                self._voice_cache[name.lower()] = arr
            except Exception as exc:
                logger.warning("Failed to preload voice profile '%s': %s", bin_file, exc)

        logger.info(
            "KokoroOnnxEngine initialized with %d voices from %s (providers: %s)",
            len(self._voice_cache),
            self.voices_dir,
            self.session.get_providers(),
        )

    @property
    def tokenizer(self) -> Any:
        """Lazy-load the eSpeak-NG G2P tokenizer singleton."""
        if self._tokenizer is None:
            try:
                from kokoro_onnx.tokenizer import Tokenizer

                self._tokenizer = Tokenizer()
            except Exception as exc:
                logger.error("Failed to initialize kokoro_onnx.Tokenizer: %s", exc)
                raise RuntimeError(
                    f"kokoro_onnx.Tokenizer is required for Kokoro TTS phonemization: {exc}"
                ) from exc
        return self._tokenizer

    def resolve_voice_style(self, voice_name: str) -> np.ndarray:
        """Resolve a voice name or alias to a (512, 256) float32 style embedding matrix."""
        v_key = voice_name.strip().lower()
        v_target = VOICE_ALIASES.get(v_key, v_key)
        if v_target.endswith(".bin"):
            v_target = os.path.splitext(v_target)[0]

        if v_target in self._voice_cache:
            return self._voice_cache[v_target]

        # Check if file exists on disk (e.g. dynamically registered / user cloned voice)
        custom_path = os.path.join(self.voices_dir, f"{v_target}.bin")
        if os.path.isfile(custom_path):
            try:
                arr = np.fromfile(custom_path, dtype=np.float32).reshape(-1, 256)
                self._voice_cache[v_target] = arr
                return arr
            except Exception as exc:
                logger.warning("Failed to read voice file '%s': %s", custom_path, exc)

        # Fallback to af_bella or first available voice in cache
        if "af_bella" in self._voice_cache:
            return self._voice_cache["af_bella"]
        if self._voice_cache:
            return next(iter(self._voice_cache.values()))

        # Emergency synthetic fallback style vector
        logger.warning("No voice profiles found in cache; generating neutral zero style matrix.")
        return np.zeros((512, 256), dtype=np.float32)

    def infer(
        self,
        text: str,
        voice: str = "af_bella",
        speed: float = 1.0,
        pitch: float = 0.0,
        gain_db: float = 0.0,
        **kwargs: Any,
    ) -> np.ndarray:
        """Synthesize natural neural speech from text with full multi-sentence handling."""
        raw_text = str(text or "").strip()
        if not raw_text:
            return np.zeros(int(self.sample_rate * 0.2), dtype=np.float32)

        v_arr = self.resolve_voice_style(voice)
        speed_clamped = max(0.5, min(2.0, float(speed)))

        # Split text into sentence batches using sentence-ending punctuation
        sentence_parts = [s.strip() for s in re.split(r"(?<=[.!?…\n])\s+", raw_text) if s.strip()]
        if not sentence_parts:
            sentence_parts = [raw_text]

        pause_samples = int(self.sample_rate * 0.12)  # 120ms natural inter-sentence cadence
        audio_chunks: list[np.ndarray] = []

        for sentence in sentence_parts:
            try:
                phonemes = self.tokenizer.phonemize(sentence, lang="en-us")
                tokens = self.tokenizer.tokenize(phonemes)
            except Exception as exc:
                logger.warning("Phonemize error on sentence '%s': %s", sentence[:40], exc)
                continue

            if not tokens:
                continue

            # Context window limit: Kokoro style matrix supports up to 512 tokens
            tokens = tokens[:500]

            # Style vector lookup: row index corresponds to token length
            style_idx = min(len(tokens), len(v_arr)) - 1
            style_vec = v_arr[style_idx : style_idx + 1]  # Shape: [1, 256]

            ort_inputs = {
                self.token_key: np.array([[0, *tokens, 0]], dtype=np.int64),
                "style": style_vec.astype(np.float32),
                "speed": np.array([speed_clamped], dtype=np.float32),
            }

            try:
                out = self.session.run(None, ort_inputs)[0]
                chunk_audio = np.asarray(out, dtype=np.float32).ravel()
                if np.isnan(chunk_audio).any():
                    logger.warning("Kokoro ONNX inference produced NaN values on sentence '%s'; replacing with silence.", sentence[:40])
                    chunk_audio = np.nan_to_num(chunk_audio, nan=0.0)
                audio_chunks.append(chunk_audio)
                audio_chunks.append(np.zeros(pause_samples, dtype=np.float32))
            except Exception as exc:
                logger.error("ONNX inference failed on sentence '%s': %s", sentence[:40], exc)

        if not audio_chunks:
            return np.zeros(int(self.sample_rate * 0.2), dtype=np.float32)

        # Concatenate sentence segments (omit trailing pause)
        if len(audio_chunks) > 1 and audio_chunks[-1].shape[0] == pause_samples:
            full_audio = np.concatenate(audio_chunks[:-1])
        else:
            full_audio = np.concatenate(audio_chunks)

        # Optional decibel gain modulation
        if abs(gain_db) > 1e-3:
            multiplier = 10.0 ** (float(gain_db) / 20.0)
            full_audio = full_audio * multiplier

        # Hard peak limiting to prevent clipping distortion
        full_audio = np.clip(full_audio, -1.0, 1.0)
        return full_audio.astype(np.float32)

    def infer_stream(
        self,
        text: str,
        voice: str = "af_bella",
        speed: float = 1.0,
        pitch: float = 0.0,
        gain_db: float = 0.0,
        **kwargs: Any,
    ) -> Iterator[np.ndarray]:
        """Stream sentence-level audio chunks for low-latency TTFT playback."""
        raw_text = str(text or "").strip()
        if not raw_text:
            return

        v_arr = self.resolve_voice_style(voice)
        speed_clamped = max(0.5, min(2.0, float(speed)))
        sentence_parts = [s.strip() for s in re.split(r"(?<=[.!?…\n])\s+", raw_text) if s.strip()]
        if not sentence_parts:
            sentence_parts = [raw_text]

        pause_arr = np.zeros(int(self.sample_rate * 0.12), dtype=np.float32)

        for i, sentence in enumerate(sentence_parts):
            try:
                phonemes = self.tokenizer.phonemize(sentence, lang="en-us")
                tokens = self.tokenizer.tokenize(phonemes)
            except Exception:
                continue

            if not tokens:
                continue

            tokens = tokens[:500]
            style_idx = min(len(tokens), len(v_arr)) - 1
            style_vec = v_arr[style_idx : style_idx + 1]

            ort_inputs = {
                self.token_key: np.array([[0, *tokens, 0]], dtype=np.int64),
                "style": style_vec.astype(np.float32),
                "speed": np.array([speed_clamped], dtype=np.float32),
            }

            try:
                out = self.session.run(None, ort_inputs)[0]
                chunk_audio = np.asarray(out, dtype=np.float32).ravel()
                if np.isnan(chunk_audio).any():
                    logger.warning("Kokoro ONNX streaming produced NaN values; replacing with silence.")
                    chunk_audio = np.nan_to_num(chunk_audio, nan=0.0)
                if abs(gain_db) > 1e-3:
                    chunk_audio = chunk_audio * (10.0 ** (float(gain_db) / 20.0))
                chunk_audio = np.clip(chunk_audio, -1.0, 1.0)
                yield chunk_audio
                if i < len(sentence_parts) - 1:
                    yield pause_arr
            except Exception as exc:
                logger.error("ONNX streaming error: %s", exc)
