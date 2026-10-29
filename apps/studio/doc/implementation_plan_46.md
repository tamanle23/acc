# Studio Implementation Plan 46: Core Quadrants Architectural Harmonization & Defect Remediation

**Document Status:** Complete, Aligned & Verified via `/grill-me`  
**Companion Master Plan:** [`docs/iterations/master_implementation_plan_iteration_51.md`](file:///c:/Users/Admin/workspace/git/acc/docs/iterations/master_implementation_plan_iteration_51.md)  
**Target:** `apps/studio` (`LeftSidebar.tsx`, `RightSidebar.tsx`, `Timeline.tsx`, `Preview.tsx`), `packages/ir`  
**Standards:** Principal Polyglot Architect, Enterprise Clean Coder, Zero-Stub Prohibition, WAI-ARIA / Liquid Glass UI  

---

## 1. Executive Summary & Problem Formulation

A deep multi-vector architectural and code-level audit of the four primary quadrants in Studio ([`LeftSidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/LeftSidebar.tsx), [`RightSidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/RightSidebar.tsx), [`Timeline.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Timeline.tsx), [`Preview.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Preview.tsx)) revealed 18 critical bugs, loopholes, coordinate mismatches, and dead stubs that prevent the Studio from functioning as an integrated, non-linear video editing (NLE) environment.

Through the `/grill-me` design alignment process, all technical decisions have been resolved and agreed upon:
1. **DnD Architecture:** Single root `DndContext` in `App.tsx`; nested context in `TimelineDom.tsx` is pruned. All cards, tracks, and clips use typed discriminator payloads (`type: 'preset' | 'asset' | 'clip'`).
2. **Transform Gizmo & Preview Drag:** Ephemeral Viewport Render Override. Pointer drag streams transient deltas directly to `IRPreviewEngine` and OffscreenCanvas worker for 60fps live canvas updates without DAG compilation overhead, committing a single atomic undoable command to `IRStateManager` on pointer release.
3. **Audio Waveform Strategy:** Clip-Scoped Waveform inside `ClipItem.tsx` with live trim responsiveness. The redundant `TrackWaveformVirtualCanvas` is removed from `DroppableTrackLane.tsx`.
4. **Relational Timing Math:** When relational sequences (`{ after, offsetFrames }`) or string durations (`'300f'`) are split or ripple-moved, their timeline placement is resolved from `CompiledTimeline` and materialized into concrete absolute frame numbers.
5. **Track Controls & Semantics:**
   - Audio tracks: `muted` (speaker) + `locked` (padlock).
   - Timed text / overlay tracks: `visible` (eye) + `locked` (padlock).
   - Video tracks: `visible` (eye) + `muted` (speaker) + `locked` (padlock).
   - Persisted directly in `VideoIR` document (saved with project), bypassing the undo stack so toggling doesn't pollute `Ctrl+Z`.
6. **Media & Presets:** Full unified support for:
   - Self-contained procedural generators (audio synthesizers, procedural VFX/shaders, shapes).
   - External & bundled media assets (video, audio, image).
   - User vault file uploads with browser-native metadata probing (`HTMLVideoElement` / `AudioContext`) for duration and dimensions.
7. **Inspector Organization:** Discrete per-modifier accordions keyed by unique `mod.id` (e.g. `'Volume'`, `'Pan'`, `'Bloom'`), with modifier target types strictly synchronized to `seq.type`.

---

## 2. Phased Implementation Roadmap (Strict 1:1 Parity)

### Phase 1: Unified Workspace DnD, Semantic Track State & Core Command Parity
- **Defects Addressed:** L-1, T-1, T-2, T-3, T-4, T-5
- **Task 1.1 (DnD Unification):** Prune the isolated inner `<DndContext>` in `apps/studio/src/components/timeline/TimelineDom.tsx`. Elevate all timeline track droppables (`DroppableTrackLane.tsx`) and clip draggables (`ClipItem.tsx`) to register with `App.tsx`'s root `<DndContext>` using `WorkspaceDragPayload`.
- **Task 1.2 (Timeline Coordinate Math):** Update `useWorkspaceDnd.ts` to consume dynamic `timelineScrollLeft` and `pixelsPerFrame = Math.max(0.2, 1.5 * zoomScale)`. When a preset or vault asset is dropped on a track lane, calculate exact drop frame $F_{\text{drop}}$ and track index.
- **Task 1.3 (Semantic Track Controls):**
  - Audio tracks: expose Speaker icon (`muted / unmuted`) + Padlock (`locked`).
  - Text / overlay tracks: expose Eye icon (`visible / hidden`) + Padlock (`locked`).
  - Video tracks: expose both Eye icon (`visible / hidden`) and Speaker icon (`muted / unmuted`) + Padlock (`locked`).
  - Persist directly in `VideoIR` via `IRStateManager.setTrackMuted`, `setTrackVisible`, and `setTrackLocked` (bypassing undo history). Guard keyboard shortcuts (`Delete`, `Backspace`, `S`, `Cmd+K`) and clip manipulation against locked tracks.
- **Task 1.4 (Relational Timing Command Fix):** Update `SplitSequenceCommand.ts` and `RippleMoveSequenceCommand.ts` to resolve absolute start frame and duration from `CompiledTimeline` when `time.start` is relational (`{ after, offsetFrames }`) or duration is a string (`'300f'`), materializing affected sequences into absolute frames.
- **Task 1.5 (Waveform & HUD Cleanup):** Remove redundant `TrackWaveformVirtualCanvas` from `DroppableTrackLane.tsx`, standardizing on clip-scoped `WaveSurferWaveform` in `ClipItem.tsx`. Wire `razorHoverFrame` and `timecodeHUD` in `Timeline.tsx` and implement pointer scrubbing on `TimecodeRuler.tsx`.

### Phase 2: Presets, Procedural Generators & Vault Ingestion Hardening
- **Defects Addressed:** L-2, L-3, L-4, L-5
- **Task 2.1 (Preset Parameter Normalization):**
  - Update `stagingPresets.ts` shape presets to pass `geometry` (`'rounded_rect'`, `'circle'`, `'arrow'`) and `cornerRadius`. Update `ShapeModifierPlugin.ts` to normalize legacy `shapeType` and support arrow geometry.
  - Update `stagingPresets.ts` partial VFX presets to supply `regions: [...]`. Add fallback normalization in `PartialVFXPlugin.ts` so flat params (`normX`, `normY`, `radius`, `intensity`) automatically populate a default region.
- **Task 2.2 (Footage & Audio Banks Hardening):**
  - Support procedural generators (BGM synthetics via `ProceduralAudioSynthesizer`, procedural VFX/shader generators, shape generators) alongside external and bundled media.
  - In `audioFootageBank.ts`, replace unregistered modifier `'audio/gain'` with `'audio/volume'`, and link presets to procedural synthesizer generators.
  - Replace dangling asset IDs in `footageBank.ts` with valid video asset definitions or procedural shader video sequences (`type: 'video'`).
- **Task 2.3 (Vault Media Ingestion & Probing):**
  - Enhance `handleFilesIngest` in `LeftSidebar.tsx` to probe video/audio metadata (`HTMLVideoElement` / `AudioContext.decodeAudioData`) to set exact `durationSec`, `width`, and `height` before adding assets to `IRStateManager`. Add filename search matching (`a.name`) and an "Insert to Timeline" button on `DraggableAssetCard`.
- **Task 2.4 (AudioContext Resource Cleanup):**
  - In `SidebarCards.tsx` and `ModifierControlStrategies.tsx`, close transient audition `AudioContext` instances upon playback completion (`onended = () => ctx.close()`) with try/finally safety.

### Phase 3: Discrete Modifier Accordions, Target Validation & Bus Compiler Wiring
- **Defects Addressed:** R-1, R-2, R-3, R-4
- **Task 3.1 (Discrete Per-Modifier Accordions):**
  - Refactor `SequenceInspector.tsx` to key each `<AccordionItem>` by unique `value={mod.id}` (titled by modifier name, e.g. `'Volume'`, `'Pan'`, `'Bloom'`) so that multiple modifiers never collide on identical category keys.
- **Task 3.2 (Modifier Target Schema Alignment):**
  - In `UpdateModifierCommand.ts` and `SequenceInspector.tsx`, ensure newly added modifiers strictly set `target: selectedSeq.type` to prevent `VideoIRSchemaValidator` target mismatch errors on `overlay` and `image` sequences.
- **Task 3.3 (Track Bus Compilation & Mixer Integration):**
  - Update `RelationalDAGCompiler.ts` to preserve `style` (`volume`, `pan`, `blendMode`, `opacity`), `visible`, and `routeTo` on `ResolvedTrack`.
  - Update `IRCanvasCompositor.ts` to skip tracks with `visible === false` and apply `track.style.opacity` and `track.style.blendMode` during visual layer compositing.
  - Update `UniversalAudioMixer.ts` to apply track bus volume, pan, and mute gating to all sequences routed through each track.
- **Task 3.4 (Inspector Virtualizer Pruning):**
  - Replace the single-item virtualizer in `RightSidebar.tsx` with standard auto-scrolling container styling (`overflow-y-auto`) to eliminate clipped accordion content and height measurement jumping.

### Phase 4: Preview Gizmo Viewport Math, Ephemeral Live Drag & Audio Preloader Parity
- **Defects Addressed:** P-1, P-2, P-3, P-4, P-5
- **Task 4.1 (Normalized Gizmo Overlays):**
  - Refactor `TransformGizmoOverlay.tsx` and `LightGizmoOverlay.tsx` to position gizmos using normalized viewport percentages based on `normX`, `normY`, `x / 1920`, and `y / 1080` relative to the bounding client rect of the canvas container.
- **Task 4.2 (Ephemeral Live Dragging & Delta Math):**
  - In `useGizmoTransform.ts`, divide pointer deltas $(\Delta x, \Delta y)$ by `canvas.getBoundingClientRect()` width and height.
  - Stream live ephemeral transform overrides to `IRPreviewEngine.setEphemeralTransformOverride` during pointer move for 60fps canvas updates, and commit a single atomic undoable command on `handleTransformDragEnd`.
- **Task 4.3 (Typography Transform & Styling Compositor Support):**
  - In `IRCanvasCompositor.ts`, update `finalizePostVisualTracks` to apply sequence `transform` and `motion/gsap` modifiers to canvas context transformations when rendering `timed_text` sequences.
  - Map `params.textColor` to `CaptionSettings.fillColor` in `extractTextConfigFromSequence`. Update `CanvasHitTester.ts` to evaluate transformed text bounding boxes.
- **Task 4.4 (Video Audio Preloading in WebAudioEngine):**
  - In `WebAudioEngine.ts`, update `syncFromIR` preloader to detect sequences on audio tracks referencing video-container assets (`assets[id].type === 'video'`), invoking audio extraction/decoding so video soundtrack playback functions seamlessly.
- **Task 4.5 (Preview Canvas Native Drop Sync):**
  - Wire root `useWorkspaceDnd` drop handling on the preview canvas to calculate canvas-relative normalized coordinates $(\mu_X, \mu_Y)$ from the drop point and pass them to preset insertion.

---

## 3. Formal Verification Matrix (`/autogenerated-tests/`)

- `/autogenerated-tests/workspace_dnd_quadrant_integration.test.ts` (Phase 1)
- `/autogenerated-tests/preset_schema_compatibility.test.ts` (Phase 2)
- `/autogenerated-tests/relational_commands_integrity.test.ts` (Phase 1)
- `/autogenerated-tests/track_bus_compilation_and_mixing.test.ts` (Phase 3)
- `/autogenerated-tests/viewport_gizmo_projection.test.ts` (Phase 4)
- `/autogenerated-tests/caption_transform_compositor.test.ts` (Phase 4)
