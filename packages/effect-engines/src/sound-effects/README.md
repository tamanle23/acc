# @acc/effect-engines/sound-effects

The **Sound Effects Engine** is a modular, high-performance audio synthesis and mixing subsystem designed for Visual Storytelling applications. It utilizes design patterns to deliver studio-quality sound effects (SFX), automated routing, multi-layer sidechain compression (auto-ducking), and loudness normalization.

---

## 🏛️ Design Patterns & Architecture

### 1. Strategy Pattern & Smart Routing (`ISmartRouter`, `SmartRouter`)
The **Smart Router** selects the optimal synthesis engine based on the acoustic nature of the requested sound effect without requiring callers to know lower-level engine details:
- **`UI Procedural Synth` Strategy (`FFmpeg`):** Synthesizes crisp UI tones, chimes, button clicks, and retro 8-bit sounds using pure mathematical frequency equations, ADSR envelopes, and resonant filtering.
- **`Acoustic & Foley Library` Strategy (`Freesound` + DSP Fallback):** Retrieves real-world environmental recordings (fauna, weather, footsteps, cloth, handling) from Freesound API with graceful procedural fallback when offline.
- **`Creative AI & Synthesis` Strategy (`AudioLDM2` + DSP Synth):** Synthesizes complex cinematic impacts, risers, sci-fi sweeps, and custom freeform text prompts using local AI models with zero-latency DSP fallback.

### 2. Template Method Pattern (`BaseSoundGenerator`, `BaseFFmpegGenerator`)
- Standardizes output file path resolution, parameter validation, JSON metadata serialization, and execution handling across all generator instances.
- `BaseFFmpegGenerator` provides reusable building blocks for studio DSP processing:
  - `buildADSRFilter(duration, attack, release)`: Smooth attack/release envelopes preventing digital pops/clicks.
  - Parameterized DSP modulation (vibrato, tremolo, flanger, aphaser, aecho, chorus).

### 3. Composite Pattern & Sidechain Auto-Ducking
- Multi-layer composite sounds (e.g. `stormy_night`, `cafe_notification`) blend background ambient audio with foreground transient effects.
- Dynamic sidechain compression (`sidechaincompress`) automatically ducks background layers whenever foreground transients trigger, producing clear studio mixes without frequency masking.

### 4. Audio Processing & Normalization
- Every generated sound effect passes through `AudioNormalizer` for EBU R128 loudness normalization (-16 LUFS), high-pass DC rumble filtering (40Hz), and seamless crossfade looping for ambient sound types.

---

## 🧪 Quality Benchmarking & Iteration Loop

The automated quality verification test suite (`sound_effects_quality_loop.test.ts`) validates:
1. **Routing Strategy Integrity:** Confirms categories route to their designated strategy engine.
2. **Catalog & Discovery API:** Validates `getAvailableComposites`, `getAvailableEffects`, `getAvailableVariants`, and `getAvailableSubVariants`.
3. **Synthesis Quality Benchmarks:** Validates generated audio file sizes, duration precision, ADSR envelope decay, and EBU R128 normalization metadata.
