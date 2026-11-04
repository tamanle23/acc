# Plan 60: Standalone Text Overlay Modifier & Plugin (`text/draw`) Integration

> **Target App:** `@acc/studio` (`apps/studio/`)  
> **Aesthetic System:** Liquid Glass Enterprise NLE (`apps/studio/DESIGN.md`)  
> **Iteration:** 60 (Companion to Master Iteration 63)  
> **Status:** Agreed & Finalized (via `/grill-me` alignment)

---

## 1. Overview & Objectives
Decouple graphic text objects (titles, lower thirds, badges, headers) from `timed_text/style` (which is reserved exclusively for subtitles and captions). Integrate the new `text/draw` modifier into `@acc/studio`:
1. Register `text/draw` in `apps/studio/src/components/inspector/modifierCatalog.ts`.
2. Add visual control strategy in `apps/studio/src/components/inspector/ModifierControlStrategies.tsx` (multi-line textarea, font family select, font size slider, color pickers, stroke toggle, shadow & badge settings).
3. Connect in-canvas double-click to direct inline editing.
4. Migrate all 16 presets in `apps/studio/src/lib/library/typographyBank.ts` to `overlay` sequences on `video` tracks, attaching both a `transform` modifier (for bounding box, position, rotation, and aspect ratio handles) and `text/draw` with `params.text`.

---

## 2. Phased Roadmap
- **Phase 1: VideoIR Plugin & Schema Sync (Mirroring Master Phase 1 & 2)**:
  - Coordinate with `packages/ir` to ensure `TextModifierPlugin` is registered and verified with zero schema drift.
- **Phase 2: Inspector Strategy Controls & In-Canvas Editing**:
  - Implement dynamic property controls for `text/draw` in `ModifierControlStrategies.tsx`.
- **Phase 3: Typography Bank Migration**:
  - Update `typographyBank.ts` presets to produce `text/draw` modifiers on overlay sequences with direct `params.text` and bounding transform.
- **Phase 4: Verification & Polish**:
  - Formally verify via `bun test` and test manual addition from Vault to timeline.
