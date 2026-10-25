# Performance Optimization: Vectorized Audio Synthesis

**Date:** 2024-10-04
**Author:** Jules

## Overview
Optimized the Fast Resilient Fallback mechanism in the `TTSEngine` (located in `apps/python-backend/src/services/tts_engine.py`) to drastically reduce audio synthesis times when external TTS engines (like Kokoro) are unavailable or not loaded.

## Problem
The previous implementation iteratively generated an audio array frame-by-frame using a standard Python `for` loop, calling `math.sin()`, generating max/min values iteratively, and packing bytes one-by-one. This was incredibly slow and computationally expensive.
A baseline benchmark taking ~50 repetitive sentences (generating a large number of frames) took **~15.97s**.

## Solution
Replaced the iterative code with highly optimized, natively vectorized `numpy` operations.
1. Replaced the `for` loop with a single time array generated via `np.arange`.
2. Replaced `math.sin` with `np.sin` which computes across the whole array instantly.
3. Used `np.maximum` and `np.clip` to handle constraints.
4. Exported directly via `.astype(np.int16).tobytes()` which perfectly matches the old `struct.pack('<h')` system.

## Results
* **Baseline:** ~15.97s
* **Optimized:** ~1.20s
* **Improvement:** > 92% reduction in synthesis time (approx. 13x speedup).
