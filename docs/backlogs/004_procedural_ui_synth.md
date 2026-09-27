# [004] Procedural Synth & MIDI for UI Sounds

- **Status:** ✅ `[x] Completed`
- **Component:** Sound Effects CLI / FFmpeg Engine
- **Created Date:** 2026-09-27
- **Completed Date:** 2026-09-27
- **Linked History:** [`047_procedural_ui_synth.md`](../history/047_procedural_ui_synth.md)

---

## 1. Context & Problem Statement
AI and library engines are overkill for lightweight, clean digital UI feedback sounds. A native procedural synthesis method was needed to generate mathematical UI sounds with zero external dependencies.

## 2. Proposed Design & Implementation Ideas
- Expand the FFmpeg (Procedural) engine with algorithms for Oscillators, Frequency Sweeps, and ADSR Envelopes.
- Create ultra-lightweight UI sounds: `hover`, `click`, `error`, `success`.

## 3. Acceptance Criteria & Implementation Results
- [x] Implemented procedural synth audio formulas in `src/sound-effects/generators/`.
- [x] Zero-dependency synthesis via FFmpeg `aevalsrc` and `volume` filters.
- [x] Verified via CLI generation.
