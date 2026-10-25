# [047] Procedural Synth & MIDI for UI Sounds

## 1. Context & Problem Statement
Epic 4 requested native procedural sound synthesis for lightweight UI sounds (clicks, hovers, success/error chimes, and retro game effects). Using AI or Freesound for a 0.05s mouse click is inefficient and prone to networking/VRAM latency. We needed to push the FFmpeg engine's Digital Signal Processing capabilities further by using advanced mathematical evaluations to synthesize clean sound natively without external audio files or neural networks.

## 2. Implementation Plan
- **Modify `src/sound-effects/generators/ffmpeg/UI.ts`**: Replace the basic placeholders with advanced `filter_complex` graphs.
- **Utilize DSP Filters**: Use `aevalsrc`, `anoisesrc`, and `sine` connected into `amix` to synthesize pure frequencies.
- **Implement Modern Group**: `hover` (fast decaying 1500Hz sine), `click` (high-passed pink noise), `success` (C major chord mixed via 3 sines + tremolo), `error` (150Hz square wave).
- **Implement Retro Group**: `pickup` (rapid upward swept square wave), `jump` (medium upward sweep), `laser` (fast downward sweep).

## 3. Changes Made
- **[MODIFY] `src/sound-effects/generators/ffmpeg/UI.ts`**: Rewrote the generator to route variants into sophisticated zero-dependency mathematical strings.
- **[MODIFY] `docs/history/README.md`**: Appended history item `046`.

## 4. Verification & Walkthrough
Ran the following CLI commands:
```bash
bun run sound-effects-cli.ts --effect ui --variant pickup --sub-variant coin --duration 1.0 --engine ffmpeg
bun run sound-effects-cli.ts --effect ui --variant success --sub-variant chime --duration 1.0 --engine ffmpeg
```
Verified that:
- `aevalsrc` parses trigonometric square wave equations `sgn(sin(2*PI*(1000*t + 2000*t*t)))` correctly.
- Multi-input amix filter successfully generates the C-Major chord (`523Hz, 659Hz, 783Hz`).
- The `AudioNormalizer` catches the synthesized raw wav files and perfectly executes the one-shot DSP tail smoothing and EBU R128 compliance.
