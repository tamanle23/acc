# Master Integration Plan - Iteration 23: Dedicated Transition System, Snapping & Ripple Timeline, and Direct Asset Ingestion

Comprehensive integration architecture for Studio NLE and Universal IR:
1. **Pillar 1: Dedicated Transition System & Cross-Clip Blends** (`transition/crossfade`, `transition/wipe`, `transition/push`, `transition/zoom`, `transition/dip_black`, `transition/glitch`, `transition/light_leak`, `transition/radial_wipe`, `transition/iris`).
2. **Pillar 2: Audio Waveform Peak Integration & Ripple / Magnetic Snapping Engine**.
3. **Pillar 3: Asset Library Direct Drag-and-Drop Ingestion to Timeline Tracks with Auto-Probing & Linked A/V Split**.

---

## 1. Goal Description

Following the detailed `/grill-me` architectural alignment on Pillar 1, three foundational NLE capabilities are specified for full end-to-end integration:

### Pillar 1: Dedicated Transition Engine & Universal IR Schema Alignment
- **Expanded Suite**: Core 5 types + Glitch, Light Leak, Radial Clock Wipe, and Iris (`transition/crossfade`, `transition/dip`, `transition/wipe`, `transition/push`, `transition/zoom`, `transition/glitch`, `transition/light_leak`, `transition/radial_wipe`, `transition/iris`).
- **Entity Placement**: Attached to Incoming Clip ($B$) referencing `outgoingSeqId` (matching the existing `TransitionCrossfadePlugin.overlapTarget` convention) with transition alignment (`center_on_cut`, `start_at_cut`, `end_at_cut`).
- **Handle Extension & Insufficient Media Guard**:
  - Center-on-cut alignment automatically extends handles by `durationFrames / 2` across adjoining clips $A$ and $B$.
  - If a clip has insufficient source trim head/tail (i.e. source trim is already at frame 0 or source limit), the inspector displays a clear warning badge (`"Insufficient media handles: head/tail truncated"`) and clamps to available frames.
- **Pre-allocated Zero-Alloc Dual-Buffer Scratchpad**: In `IRCanvasCompositor`, pre-allocate reusable scratchpad canvases (`offscreenA`, `offscreenB`) to sample outgoing and incoming frames and composite using wipe paths, directional translation vectors, or custom pixel blends with zero heap allocations per frame.
- **Dedicated Timeline & Inspector UX**:
  - Stylized transition block badge on the cut boundary between clips on the timeline.
  - Dedicated 'Transitions' section in `SequenceInspector.tsx` for Clip $B$ with live parameter controls (type, duration, ease, direction, color).

### Pillar 2: Timeline Audio Waveform & Snapping / Ripple Editing
- **Audio Waveform Peak Decimation**: Guarantee active waveforms for all audio sequences (fetched media arraybuffers, synthesized procedural SFX buffers, and deterministic synthetic fallbacks).
- **Ripple Edit Mode**: Toggleable toolbar mode (`Shuffle` / `ArrowRightLeft` icon) where moving/trimming a sequence shifts downstream clips on unlocked tracks by `deltaFrames`, and deleting clips closes gaps.
- **Abutting Magnetic Snapping**: Visual emerald snap guidelines (`"Abut"`) when dragging within 4 frames of neighboring clip edges.

### Pillar 3: Direct Asset Drag-and-Drop Ingestion to Timeline
- **Unified DndContext**: Drop presets or media files directly onto specific `DroppableTrackLane` rows in `Timeline.tsx` with precise drop frame calculation.
- **Industry Standard Linked A/V Split**:
  - When a video asset containing an audio stream is dropped onto the timeline, it creates **two linked clips synchronously**:
    1. Video sequence on target video track (`V1`).
    2. Audio sequence on matching audio track (`A1`).
    3. Coupled via `linkedGroupId` so moving or trimming one moves both in sync.
- **Independent Audio/Video Transitions**: Because video and audio are split across dedicated tracks, visual transitions on `V1` do not distort audio; audio tracks can independently have crossfades or cuts.

---

## 2. User Review Required

> [!IMPORTANT]
> - **Video IR Schema Stability & Sync Rule**: Any update to transition modifier properties in `packages/ir/src/types/modifiers.ts` must maintain strict synchronization across `VideoIRSchemaValidator.ts`, `schema/video-ir.schema.json`, and `docs/ir/1. video_(IR)_specification.md`.
> - **Rule 229 Preservation**: All Accordion components in inspectors must keep interactive elements in `actions` props, never inside `AccordionTrigger` children.
> - **Zero-Alloc Frame Loop**: Any transition shader or canvas blending must avoid heap allocations inside the render loop (reusing offscreen canvas/contexts for clip dual-buffering).
> - **RightSidebar 350-line ceiling**: Must remain strictly below 350 lines (currently at 252 lines).

---

## 3. Architecture & Detailed Specifications

```
                     ┌──────────────────────────────────────────────┐
                     │           Universal Video IR (SSOT)          │
                     │  - transition/* modifiers (Crossfade, Wipe,  │
                     │    Push, Zoom, DipToColor, Glitch, etc.)     │
                     └──────────────────────┬───────────────────────┘
                                            │
               ┌────────────────────────────┼───────────────────────────┐
               ▼                            ▼                           ▼
┌─────────────────────────────┐┌───────────────────────────┐┌─────────────────────────────┐
│ Pillar 1: Transitions       ││ Pillar 2: Audio & Timeline││ Pillar 3: Drag & Drop Ingest│
│ - TransitionPluginRegistry  ││ - AudioWaveform Live Dec  ││ - Unify DndContext in App   │
│ - CanvasCompositor Dual-Buf ││ - Ripple Edit Mode Toggle ││ - DroppableTrackLane Dropping│
│ - Timeline Transition Blocks││ - Abutting Snap Guides    ││ - Linked A/V Split on Drop  │
│ - Transition Inspector Form ││ - JKL Scrubbing Parity    ││ - Auto Track Type Routing   │
│ - Handle Extension & Warning││                           ││                             │
└─────────────────────────────┘└───────────────────────────┘└─────────────────────────────┘
```

---

## 4. Proposed Changes

### Pillar 1: Dedicated Transition System & Cross-Clip Blends

#### [MODIFY] [`packages/ir/src/types/modifiers.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/types/modifiers.ts)
- Extend `TransitionModifierParams` to support:
  - `transitionType`: `'crossfade' | 'dip' | 'wipe' | 'push' | 'zoom' | 'glitch' | 'light_leak' | 'radial_wipe' | 'iris'`.
  - `durationFrames`: number (default: 15).
  - `ease`: `'linear' | 'ease_in' | 'ease_out' | 'ease_in_out' | 'power2_in_out'`.
  - `alignment`: `'start_at_cut' | 'center_on_cut' | 'end_at_cut'`.
  - `direction`: `'left' | 'right' | 'up' | 'down'`.
  - `dipColor`: string (default: `#000000`).
  - `outgoingSeqId`: string.
- Add union type `'transition/crossfade' | 'transition/wipe' | 'transition/push' | 'transition/zoom' | 'transition/dip' | 'transition/glitch' | 'transition/light_leak' | 'transition/radial_wipe' | 'transition/iris' | 'editorial/transition'` to `StandardModifierNode`.

#### [MODIFY] [`packages/ir/src/schema/VideoIRSchemaValidator.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/schema/VideoIRSchemaValidator.ts)
- Validate extended transition parameters: `transitionType`, `alignment`, `ease`, `direction`, `dipColor`, and positive non-zero `durationFrames`.

#### [MODIFY] [`packages/ir/src/plugins/editorial/TransitionCrossfadePlugin.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/plugins/editorial/TransitionCrossfadePlugin.ts) -> Modernize to `UniversalTransitionPlugin.ts`
- Implement multi-mode transitions:
  - **Crossfade/Dissolve**: Linear/smoothstep alpha interpolation.
  - **Dip to Color**: Smooth fade to `dipColor` at 50% transition progress, then fade up to incoming clip.
  - **Wipe (Left/Right/Up/Down)**: Canvas clipping path (`ctx.clip()`) progressing across the frame boundary.
  - **Push (Slide)**: Incoming clip translates in from edge while offsetting outgoing clip.
  - **Whip Zoom**: Exponential scale-up with chromatic aberration or motion blur cue.
  - **Radial Wipe**: Clock-sweep canvas clipping path from angle $0 \to 2\pi$.
  - **Iris**: Circular expanding/contracting aperture mask.
  - **Glitch & Light Leak**: Procedural displacement and additive glow blending.
- Ensure deterministic frame math: `progress = localFrame / durationFrames`, zero wall-clock dependencies.

#### [MODIFY] [`packages/ir/src/renderer/shared/IRCanvasCompositor.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/renderer/shared/IRCanvasCompositor.ts)
- Support transition rendering across adjoining clips using pre-allocated zero-alloc scratchpad canvases:
  - Pre-allocate secondary offscreen canvas `scratchBuffer` in `IRCanvasCompositor`.
  - Render outgoing frame into buffer $A$, incoming frame into buffer $B$, execute composite transition.

#### [NEW] [`apps/studio/src/components/timeline/TimelineTransitionBlock.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/timeline/TimelineTransitionBlock.tsx)
- Renders a stylized transition handle / badge directly at the cut boundary between two sequences on the timeline.
- Shows transition type icon, duration badge (e.g. `15f`), and click-to-inspect trigger.

#### [MODIFY] [`apps/studio/src/components/inspector/modifierCatalog.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/modifierCatalog.ts)
- Register `transition/wipe`, `transition/push`, `transition/zoom`, `transition/dip`, `transition/glitch`, etc., with parameter controls (Type, Duration Frames, Direction, Easing, Alignment, Dip Color).

---

### Pillar 2: Audio Waveform Peak Integration & Ripple / Magnetic Snapping Engine

#### [MODIFY] [`apps/studio/src/components/timeline/WaveSurferWaveform.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/timeline/WaveSurferWaveform.tsx) & [`AudioWaveform.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/timeline/AudioWaveform.tsx)
- Ensure peak caching gracefully handles all audio source types:
  - Assets with audio URLs (fetching arrayBuffer -> decoding via WebAudio `decodeAudioData`).
  - Procedural SFX sequences (synthesizing preview PCM buffer via `ProceduralAudioSynthesizer`).
  - Fallback deterministic synthetic noise waveform when audio is loading or offline, avoiding flat blank bars.

#### [MODIFY] [`apps/studio/src/components/Timeline.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Timeline.tsx)
- Add **Ripple Edit Mode** (`rippleEnabled` state & toolbar toggle with `Shuffle` / `ArrowRightLeft` icon).
  - In Ripple Edit Mode:
    - Moving a sequence or trimming its start/end automatically shifts all downstream clips on that track (or across all unlocked tracks) by `deltaFrames`.
    - Deleting a sequence ripples remaining clips backward, closing the gap.
  - Abutting Snap Guideline: Highlight the seam between adjacent clips with an emerald snap guideline (`"Abut"`) when dragging within 4 frames of neighboring start/end.

---

### Pillar 3: Asset Library Direct Drag-and-Drop Ingestion to Timeline Tracks

#### [MODIFY] [`apps/studio/src/App.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/App.tsx) & [`apps/studio/src/components/Timeline.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Timeline.tsx)
- **DndContext Architectural Unification**:
  - Lift or bridge drag events so that dragging a preset or asset from `LeftSidebar` can be dropped directly onto a `DroppableTrackLane` in `Timeline.tsx`.
  - Calculate drop frame accurately:
    $$\text{dropFrame} = \max\left(0, \text{Math.round}\left(\frac{\text{dropPointerX} - \text{trackLeftOffset}}{\text{pixelsPerFrame}}\right)\right)$$
- **Linked A/V Split Engine**:
  - When dragging a video asset containing an audio stream, automatically create both Video (`V1`) and Audio (`A1`) sequence entities with synchronized `startFrame` and `durationFrames`, tagged with a shared `linkedGroupId`.
  - Moving or trimming either clip moves the linked counterpart automatically unless unlinked.
- Instantly selects the newly created sequence and opens `RightSidebar` with auto-focus.

---

## 5. Verification Plan

### Automated Tests
1. **IR Schema & Parity Tests**:
   - `bun test autogenerated-tests/video_ir_schema_validator.test.ts`
   - `bun test autogenerated-tests/studio_inspector_plugin_parity.test.ts`
2. **Dedicated Transition & Ingestion Suite**:
   - Create `autogenerated-tests/studio_transitions_and_timeline_ingest.test.ts`:
     - Test all transition modifier schemas (Crossfade, Dip, Wipe, Push, Zoom, Glitch, Iris, Radial).
     - Test UniversalTransitionPlugin execution across frame progress $0.0 \to 1.0$.
     - Test handle extension calculation and insufficient media warning.
     - Test Linked A/V split command dispatching on media drop.
     - Test Ripple edit math: verify downstream clip offsets when trimming/moving.
3. **Build Integrity**:
   - `bun run --cwd apps/studio build`

### Manual Verification
1. Drag a video asset with audio from the Left Sidebar directly into timeline tracks; verify both `V1` video clip and `A1` audio clip are created synchronously with linked indicators.
2. Add a `transition/wipe` or `transition/dip` between two clips; observe the transition badge on the timeline and scrub through the cut to verify smooth blending.
3. Verify the warning badge if a clip lacks sufficient head/tail handles for the requested duration.
4. Toggle Ripple Edit mode, trim a clip, and verify downstream clips shift cleanly without overlapping.
