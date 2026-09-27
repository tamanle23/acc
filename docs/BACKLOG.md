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
