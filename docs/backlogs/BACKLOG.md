# Project Backlog

This document tracks future features, technical debt, and architectural epics that are planned but not yet implemented.

## Epic 1: Multi-language Cultural Subtitles (Cultural Captions)
**Context:** When the AI sound generator creates animal sounds using cultural onomatopoeia (e.g., "cho" + "ang_ang"), the visual renderer should display localized closed captions rather than standard English descriptors.
**Implementation Ideas:**
- The Sound Generator metadata (`.json`) already captures the original `variant` and `subVariant`.
- Update the video rendering engine (`renderer.ts` / FFmpeg filters) to parse this JSON metadata and burn subtitle text based on a localization map.
- Instead of showing `[Dog barking]`, the video will show `[Chó: Ẳng ẳng...]` or `[Dế mèn: Rỉ rả...]`.

## Epic 2: Story Config Enum Standardization for Fauna
**Context:** The current `story-config.schema.json` might not have strict Enum validation for all the new Vietnamese animal onomatopoeias.
**Implementation Ideas:**
- Standardize the taxonomy of `fauna` variants and sub-variants.
- Inject the full list of supported combinations (e.g., `ho` -> `gam_vang`, `ga_trong` -> `o_o_o`) into `story-config.schema.json` so IDEs provide strict validation and autocomplete.
- Ensure the `auto-config.ts` wizard dynamically uses these enums.

## Epic 3: Spatial & 3D Audio for Sound Effects
**Context:** Enhance video immersion by providing spatial audio support.
**Implementation Ideas:**
- Upgrade AudioNormalizer or the Composite Engine to support audio panning (left/right) or 3D surround sound mixing.
- Enable effects like a car driving across the screen or dynamic positional UI sounds.

## Epic 4: Procedural Synth & MIDI for UI Sounds
**Context:** AI and Library engines are overkill for simple, clean digital UI feedback sounds.
**Implementation Ideas:**
- Expand the fmpeg (Procedural) engine with algorithms for Oscillators, Sweeps, and LFOs.
- Create ultra-lightweight, mathematical UI sounds (Hover, Click, Error, Success) natively without external dependencies.

## Epic 5: Advanced Auto-Ducking Composites
**Context:** When sound effects (or voices) overlap with background music, the mix can get muddy.
**Implementation Ideas:**
- Expand the Combinatorial Composites system to support Auto-Ducking (sidechain compression in FFmpeg).
- Automatically lower the volume of ambient/background layers when an impact, transition, or voice-over occurs.

## Epic 6: Migrate Overlay Effects CLI & Complex Composites to FFmpegFilterGraph DAG
**Context:** Following Phase 2 of the Architecture Vision (`docs/ARCHITECTURE_VISION.md`), the core video renderer adopts `FFmpegFilterGraph`. Complex multi-layer stacking and procedural overlay generations in `overlay-effects-cli.ts` still use legacy string-based filters.
**Implementation Ideas:**
- Migrate `src/overlay-effects/pipeline.ts` and combinatorial stacking engines in `overlay-effects-cli.ts` to `FFmpegFilterGraph`.
- Use DAG node-based routing for alpha-blending, chroma-keying, and composite layer stacking.
- Add static validation for composite stream graphs prior to running FFmpeg.

## Epic 7: Isolated Pipeline Architecture (Phase 3 - The Pipeline Orchestrator)
**Context:** Following Phase 1 (`AssetContext` & defensive fallbacks) and Phase 2 (`FFmpegFilterGraph` DAG builder) from `docs/ARCHITECTURE_VISION.md`, the final phase refactors the main rendering loop into a fully decoupled, extensible Pipeline Orchestrator.
**Implementation Ideas:**
- Implement `PipelineRunner` to orchestrate discrete processing stages (`Validation` -> `Asset Generation` -> `DAG Filtergraph Composition` -> `FFmpeg Execution` -> `Cleanup`).
- Register all pipeline features (TTS, AI Upscaling, 3D Depth, Overlays, Transitions, Audio Normalization, Background Music) as pluggable middleware implementing `IPlugin`.
- Sub-process Sandboxing (Actor Model): Run heavy AI tasks (such as Real-ESRGAN, Whisper alignment, VieNeu-TTS) in worker threads or isolated child processes with strict timeouts and resource limits.
- Implement **Dry-Run Mode**: Fast syntax and graph verification using `ffmpeg -f null -` on the generated command (validates in <1s before starting long renders).
