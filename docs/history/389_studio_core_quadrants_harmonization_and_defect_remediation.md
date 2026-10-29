# Milestone 389: Studio Core Quadrants Harmonization & Defect Remediation

## 1. Problem Statement
Across the Studio Core Quadrants (`apps/studio`: `LeftSidebar.tsx`, `RightSidebar.tsx`, `Timeline.tsx`, `Preview.tsx`) and `packages/ir`, a comprehensive audit uncovered 18 architectural defects, state desynchronizations, and UX friction points:
1. **Left Sidebar (`LeftSidebar.tsx`)**:
   - Nested `<DndContext>` in `TimelineDom.tsx` intercepted and failed drag events initiated from the left sidebar staging presets and assets (Defect L-1).
   - Preset assets referenced missing stock asset IDs (`asset-film-burn`, `asset-holo-globe`, `asset-bgm-*`) causing 404s/broken previews (Defect L-2).
   - Shape vector presets passed invalid `shapeType` instead of standard `geometry` property (Defect L-3).
   - Ingested files were hardcoded to 90 frames / 1920x1080 without metadata probing (Defect L-4).
   - Audio card preview leaked `AudioContext` instances without closure on playback ended (Defect L-5).
2. **Right Sidebar (`RightSidebar.tsx`)**:
   - Dynamic modifier accordion in `SequenceInspector.tsx` keyed items on presentation categories instead of unique modifier IDs, causing multi-accordion collision bugs (Defect R-1).
   - Dynamic modifier addition defaulted `target` to `'video'` even on audio/overlay/text sequences, breaking schema validation (Defect R-2).
   - UniversalAudioMixer and IRCanvasCompositor ignored track-level mute, volume, pan, and visibility settings (Defect R-3).
   - RightSidebar wrapped single inspector views in `@tanstack/react-virtual` with dynamic accordion sizes, causing height jumping and clipped controls (Defect R-4).
3. **Timeline (`Timeline.tsx`)**:
   - Duplicate waveform renderers (`TrackWaveformVirtualCanvas` + `WaveSurferWaveform`) conflicted with double memory overhead (Defect T-1).
   - Timecode ruler scrubbing lacked pointer capture, stalling at container bounds (Defect T-2).
   - Relational start/duration collapsed on split/ripple move commands (Defect T-3).
   - Track mute/lock buttons lacked persistence and bypass in document history (Defect T-4).
   - Edit shortcuts (`Cmd+K`, `Backspace`, `Delete`) functioned on locked tracks (Defect T-5).
4. **Preview Viewport (`Preview.tsx`)**:
   - 2D Transform Gizmo positioned handles using unnormalized absolute pixel values, drifting on scaled viewports (Defect P-1).
   - Gizmo drag operations bypassed live canvas updates and lacked ephemeral transform streaming to `IRPreviewEngine` (Defect P-2).
   - Timed-text sequences bypassed spatial transform and motion modifiers in `IRCanvasCompositor` (Defect P-3).
   - `WebAudioEngine.syncFromIR` omitted video track assets from audio preloading, resulting in silent playback of video footage (Defect P-4).
   - Preview drop zone omitted normalized coordinate resolution and passed `previewEngine={null}` (Defect P-5).

---

## 2. Architecture & Design Plan
1. **Quadrant 1 (Left Sidebar)**:
   - Eliminate inner `<DndContext>` in `TimelineDom.tsx`; standardize on single root DnD provider in `App.tsx` with `@dnd-kit/core` `useDndMonitor`.
   - Register all 15 demo asset IDs in `complexSciFiDemoIR.ts` and `defaultDemoIR.ts`.
   - Update `stagingPresets.ts`, `footageBank.ts`, and `audioFootageBank.ts` to supply valid geometries (`rounded_rect`, `circle`, `arrow`), structured `regions: [...]`, and `audio/volume` modifiers.
   - Implement client-side metadata probing via `HTMLVideoElement` and `AudioContext` in `LeftSidebar.handleFilesIngest`.
   - Enforce transient `AudioContext.close()` with timeout fallbacks on audition end.
2. **Quadrant 2 (Right Sidebar & Inspector)**:
   - Key `<AccordionItem>` by `mod.id || `${mod.type}_${idx}`` with mapped `effectiveOpenSections`.
   - Enforce automatic sequence domain target alignment (`target: selectedSeq.type`) in `UpdateModifierCommand` and `IRStateManager.addModifier`.
   - Integrate `track.muted`, `track.visible`, `track.style.volume`, and `track.style.pan` into `UniversalAudioMixer` and `IRCanvasCompositor`.
   - Prune single-item `@tanstack/react-virtual` in `RightSidebar.tsx`; replace with natural `overflow-y-auto` container.
3. **Quadrant 3 (Timeline)**:
   - Remove redundant `TrackWaveformVirtualCanvas` from `DroppableTrackLane.tsx`.
   - Implement full 60 FPS pointer scrubbing with `setPointerCapture` in `TimecodeRuler.tsx`.
   - Materialize split and ripple move sequence coordinates into absolute integer frames in `SplitSequenceCommand` and `RippleMoveSequenceCommand`.
   - Connect track header cards directly to IR document track state (`setTrackMuted`, `setTrackVisible`, `setTrackLocked`), bypassing history pollution.
   - Enforce `isSelectedSeqLocked()` shortcut guards for `Cmd+K`, `Delete`, and `Backspace`.
4. **Quadrant 4 (Preview Viewport)**:
   - Refactor transform gizmo to normalized container percentage projection:
     $$\%X_{\text{center}} = \left(\mu_X + \frac{X_{\text{offset}}}{W_{\text{canvas}}}\right) \times 100, \quad \%Y_{\text{center}} = \left(\mu_Y + \frac{Y_{\text{offset}}}{H_{\text{canvas}}}\right) \times 100$$
   - Divide drag deltas by container element dimensions; stream ephemeral transform overrides to `IRPreviewEngine`.
   - Add spatial matrix evaluation (`ctx.translate`, `ctx.scale`, `ctx.rotate`) and `textColor` mapping for `timed_text` sequences in `IRCanvasCompositor`.
   - Include video assets in `WebAudioEngine.syncFromIR` preloader.
   - Supply normalized coordinate calculation in preview droppable container and wire `renderStrategy.previewEngine`.

---

## 3. Changes Implemented
- `packages/ir/src/types/VideoIR.ts`: Added `TrackStyle` interface; typed `muted`, `visible`, `locked`, `routeTo`, and `style` on `IRTrack` and `ResolvedTrack`.
- `schema/video-ir.schema.json`: Added `muted`, `visible`, `locked` booleans to `definitions.IRTrack`.
- `packages/ir/src/schema/VideoIRSchemaValidator.ts`: Added schema validations for track bus properties.
- `packages/ir/src/compiler/RelationalDAGCompiler.ts`: Preserved track bus properties on compiled `ResolvedTrack`.
- `packages/ir/src/renderer/audio/UniversalAudioMixer.ts`: Skips muted tracks; scales sequence volume by `track.style.volume`; applies `track.style.pan`.
- `packages/ir/src/renderer/shared/IRCanvasCompositor.ts`: Skips tracks where `track.visible === false`; evaluates spatial transform modifiers and maps `textColor` to `fillColor` for `timed_text` sequences.
- `packages/ir/src/plugins/shape/ShapeModifierPlugin.ts`: Added arrow vector rendering and legacy fallback normalization.
- `packages/ir/src/plugins/vfx/PartialVFXPlugin.ts`: Added fallback normalization for flat parameter structures.
- `apps/studio/src/lib/ir/irState.ts`: Added `setTrackMuted`, `setTrackVisible`, `setTrackLocked`, `updateTrackStyle`, `updateTrackRouting`; updated `addModifier` and `updateModifier` to pass domain targets; fixed `rippleMoveSequence` resolution.
- `apps/studio/src/lib/commands/SplitSequenceCommand.ts`: Materialized split halves into absolute frames and parsed duration strings (`'300f'`).
- `apps/studio/src/lib/commands/RippleMoveSequenceCommand.ts`: Materialized target start & duration into absolute frames and stripped relational references.
- `apps/studio/src/lib/commands/UpdateModifierCommand.ts`: Auto-assigned unique modifier IDs and enforced sequence domain target alignment.
- `apps/studio/src/lib/dnd/useWorkspaceDnd.ts`: Integrated timeline zoom and scroll offsets into drop coordinate calculations.
- `apps/studio/src/components/timeline/TimelineDom.tsx`: Pruned inner `<DndContext>` in favor of root `useDndMonitor`.
- `apps/studio/src/components/timeline/DroppableTrackLane.tsx`: Removed redundant `TrackWaveformVirtualCanvas`.
- `apps/studio/src/components/timeline/TrackHeaderCard.tsx`: Connected Eye, Speaker, and Padlock controls to authoritative IR document track state.
- `apps/studio/src/components/timeline/TimecodeRuler.tsx`: Replaced static click handler with 60 FPS pointer scrub with `setPointerCapture`.
- `apps/studio/src/components/Timeline.tsx`: Connected locked and muted tracks to IR document; added shortcut guards.
- `apps/studio/src/components/LeftSidebar.tsx`: Added media metadata probing in `handleFilesIngest`; wired `handleInsertAsset`.
- `apps/studio/src/components/sidebar/SidebarCards.tsx`: Enforced `AudioContext.close()` on ended.
- `apps/studio/src/components/inspector/ModifierControlStrategies.tsx`: Enforced `AudioContext.close()` on audition ended.
- `apps/studio/src/components/inspector/SequenceInspector.tsx`: Keyed accordion items by unique ID; resolved `effectiveOpenSections`.
- `apps/studio/src/components/RightSidebar.tsx`: Pruned single-item `useVirtualizer`; aligned modifier target domains on addition.
- `apps/studio/src/renderer/IRPreviewEngine.ts`: Added `setEphemeralTransformOverride` and merged overrides into `getActiveInterpolatedTransform`.
- `apps/studio/src/components/preview/TransformGizmoOverlay.tsx`: Refactored positioning to normalized viewport container percentages.
- `apps/studio/src/components/preview/useGizmoTransform.ts`: Divided pointer deltas by container dimensions; streamed live ephemeral overrides to preview engine.
- `apps/studio/src/lib/audio/WebAudioEngine.ts`: Added video track assets to audio preloader.
- `apps/studio/src/components/Preview.tsx`: Wired normalized drop coordinates and passed live `previewEngine`.
- `apps/studio/src/App.tsx`: Synced `timelineScrollLeft` and `timelineZoomScale`.

---

## 4. Verification Matrix
Formal unit and integration test suites created in `/autogenerated-tests/`:
1. `autogenerated-tests/workspace_dnd_quadrant_integration.test.ts`:
   - Frame drop coordinate math with zoom and scroll offset.
   - Viewport drop coordinate normalization to $[0.05, 0.95]$.
   - Non-destructive sequence addition and history undo.
2. `autogenerated-tests/preset_schema_compatibility.test.ts`:
   - All staging, footage, and audio presets produce valid IR sequences.
   - Vector arrow and rounded rect drawing in `ShapeModifierPlugin`.
   - Fallback normalization of flat parameters in `PartialVFXPlugin`.
3. `autogenerated-tests/relational_commands_integrity.test.ts`:
   - SplitSequenceCommand materialization of relational start and duration.
   - RippleMoveSequenceCommand materialization and dangling relational reference stripping.
4. `autogenerated-tests/track_bus_compilation_and_mixing.test.ts`:
   - RelationalDAGCompiler preservation of `muted`, `visible`, `locked`, and `style`.
   - UniversalAudioMixer skipping muted tracks and applying track volume and pan styling.
5. `autogenerated-tests/viewport_gizmo_projection.test.ts`:
   - Percentage projection of canvas coordinates to container viewport.
   - Container pointer delta normalization.
   - Ephemeral transform override lifecycle in `IRPreviewEngine`.
6. `autogenerated-tests/caption_transform_compositor.test.ts`:
   - Spatial transform modifier evaluation and `textColor` mapping on `timed_text` sequences.
   - Track visibility suppression in `IRCanvasCompositor`.

---

## 5. Walkthrough & User Experience
- **Left Sidebar**: Dragging any preset or media card smoothly crosses quadrant boundaries and drops onto the timeline at the exact frame under the cursor, or drops into the preview canvas at the exact normalized $(X, Y)$ drop location.
- **Timeline**: Scrubbing the timecode ruler feels butter-smooth at 60 FPS without losing tracking when dragging outside the ruler. Track headers display intuitive Eye (visibility), Speaker (mute), and Padlock (lock) controls that instantly update rendering without cluttering undo history.
- **Right Sidebar**: Adding multiple audio or visual effects cleanly appends accordion items without collisions or accidental sync-toggling. Scrolling the inspector is natural and eliminates height jumping.
- **Preview Viewport**: The transform gizmo remains locked to the sequence center across arbitrary window sizes and zoom levels. Dragging handles streams real-time updates directly to the canvas before committing a single undoable command on pointer release.

---

## 6. Tasks & Completion Status
- [x] Phase 1: Left Sidebar & Ingestion Architecture (L-1 to L-5)
- [x] Phase 2: Timeline Core Interactions & Commands (T-1 to T-5)
- [x] Phase 3: Right Sidebar & Modifier Integration (R-1 to R-4)
- [x] Phase 4: Preview Viewport & Ephemeral Transform Engine (P-1 to P-5)
- [x] Formal Test Suites in `/autogenerated-tests/`
- [x] History & Milestone Registration

---

## 7. Future Enhancements
- Multi-clip box selection and group transformation in preview viewport.
- GPU-accelerated WebGL shader blitting for preview canvas under intense multi-layer compositing.
- Magnetic snapping to beat markers extracted from audio waveform peak transients.
