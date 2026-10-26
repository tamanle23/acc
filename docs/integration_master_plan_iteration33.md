# Master Integration Plan - Iteration 33: Studio Timeline DOM Hardening, Track-Scoped Ripple Push & Synchronized A/V Pairing

## 1. Problem Statement & Root Cause Diagnosis

During comprehensive testing and QA of the decoupled [`TimelineDom.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/timeline/TimelineDom.tsx) component, several functional bugs, data integrity hazards, and interaction limitations were identified in the sequence moving subsystem:

### Root Causes
1. **Incompatible Cross-Track Drops:**
   - When dragging a video sequence down over an audio track (or an audio clip onto a video track), `@dnd-kit`'s `handleDragEnd` invoked `moveSequence` without checking track container types.
   - When rendered, audio mixers and video preview engines crashed or produced broken states because sequences were placed into incompatible track containers.
2. **Linked A/V Visual Desynchronization During Pointer Drag:**
   - In [`MoveSequenceCommand.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/commands/MoveSequenceCommand.ts), when an A/V linked sequence is dropped, the command shifts both the video and audio partner sequences.
   - However, during the drag phase in `TimelineDom.tsx`, only the primary clip's translation was updated. The partner clip remained stationary until mouse release, breaking visual feedback and confusing users.
3. **Collision & Ripple Push (Insert) Absence:**
   - When a clip was moved or dropped onto an occupied area, `TimelineDom.tsx` attempted a flawed clamp calculation (`initialStartFrame >= sEnd`) that failed when transferring across tracks and caused clips to collide or jump unpredictably.
   - Standard NLE workflows (Premiere, DaVinci Resolve) expect an intuitive **Ripple Insert**: dropping a clip creates space by pushing downstream clips forward, avoiding unintended overwrites.
4. **Horizontal Virtualization Clip Pruning:**
   - Because `visibleSequences` filtered clips strictly by `scrollLeft` and viewport width, dragging a clip or hovering near the edge could cause candidate snap targets or the partner clip to unmount.
5. **Lack of Drag Affordance & Collision Feedback:**
   - In-lane dragging lacked elevation (`z-index` and drop shadow), delta timecode readouts (`+00:01:14`), and clear destructive warning indicators when hovering over forbidden/incompatible tracks.

---

## 2. Architectural Design & Invariants

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TIMELINE DOM DRAG LIFECYCLE                    │
│                                                                        │
│   [ClipItem (Primary)] ─── DragStart ───► [TimelineDom State Machine]  │
│          ▲                                        │                    │
│          │                                        ├─► Detect A/V Link  │
│   [ClipItem (Paired)]   ◄── Synchronized Motion ──┤   (pairedSeqId)    │
│                                                   │                    │
│   [DroppableTrackLane]  ◄── Over Event ───────────┤                    │
│          │                                        ▼                    │
│          ├─► Valid Track Type? ──► YES ──► Compute Magnet Snapping     │
│          │                                 & Delta Timecode HUD        │
│          │                                                             │
│          └─► Incompatible Type? ─► NO  ──► Render Destructive Red Tint  │
│                                            (cursor-not-allowed)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Drop Event (handleDragEnd)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   IR COMMAND & PERSISTENCE LAYER                      │
│                                                                        │
│  [RippleMoveSequenceCommand]                                           │
│         │                                                              │
│         ├─► 1. Remove sequence from source track                       │
│         ├─► 2. Target Track: Push all downstream clips forward by D    │
│         │      (strictly scoped to target track; other tracks intact)  │
│         ├─► 3. Insert sequence at targetStartFrame                     │
│         ├─► 4. Shift linked A/V partner sequence by same delta         │
│         └─► 5. Full Undo / Redo displacement stack reversal            │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Invariants
- **Track-Scoped Ripple Push / Insert**: Dropping a sequence at frame `T` with duration `D` onto a track where downstream clips exist pushes all clips on that track starting at or after `T` forward by `D` frames. Other tracks remain unaffected.
- **Strict Cross-Track Type Safety**: Video/Image/Text sequences are strictly constrained to video/overlay/vfx tracks. Audio sequences are strictly constrained to audio tracks. Incompatible drops are rejected and snap back safely.
- **Real-Time Linked A/V Pairing**: Linked video and audio clips slide horizontally together in real time during drag operations.
- **Full Undo / Redo Parity**: `RippleMoveSequenceCommand` records downstream clip displacements and restores them bit-identically upon undo.

---

## 3. Implementation Steps

### Phase 1: Persistence & Command Layer (`apps/studio/src/lib/`)
1. Create [`RippleMoveSequenceCommand.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/commands/RippleMoveSequenceCommand.ts):
   - Accepts `sequenceId: string`, `targetTrackId: string`, `targetStartFrame: number`.
   - Records `previousTrackId`, `previousStartFrame`, and downstream displaced clip offsets `{ sequenceId: string, originalStart: number }[]`.
   - On `execute`:
     - Validates source and target track types match (`audio` vs `video`/`overlay`).
     - Extracts sequence from `sourceTrack`.
     - Identifies all sequences on `targetTrack` where `start >= targetStartFrame`.
     - Displaces downstream sequences forward by `durationFrames`.
     - Inserts the sequence at `targetStartFrame`.
     - Displaces any linked A/V partner sequence by the same delta.
   - On `undo`: restores the sequence and all displaced downstream clips to their exact original frames.
2. Update [`irState.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/ir/irState.ts):
   - Expose `rippleMoveSequence(sequenceId: string, targetTrackId: string, targetStartFrame: number)`.

### Phase 2: Lane & Feedback Wiring (`apps/studio/src/components/timeline/`)
3. Update [`DroppableTrackLane.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/timeline/DroppableTrackLane.tsx):
   - Pass `trackType: track.type` in dnd-kit droppable `data`.
   - Receive `isInvalidDrop?: boolean` to render destructive styling (`bg-destructive/10 border-destructive/50 ring-1 ring-destructive/40 cursor-not-allowed`) when an incompatible clip hovers over the lane.
4. Update [`ClipItem.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/timeline/ClipItem.tsx):
   - Support `activeDragState.pairedSeqId === seq.id` to visually offset the linked A/V clip in real time.
   - Render floating delta micro-pill HUD (`+15f (00:00:15)`) and magnet snapping badge on the active clip during drag.
   - Add elevation styling (`z-30 shadow-2xl scale-[1.01] ring-2 ring-accent-theme`).

### Phase 3: Timeline DOM Orchestration (`TimelineDom.tsx`)
5. Update [`TimelineDom.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/timeline/TimelineDom.tsx):
   - On `handleDragStart`: inspect `seq.modifiers` for `editorial/av_link`. If linked, populate `pairedSeqId`.
   - On `handleDragMove`: inspect `overTrack.type` against `seq.type`. Flag `isValidDrop: false` if incompatible.
   - On `handleDragEnd`: if drop is valid, dispatch `IRStateManager.getInstance().rippleMoveSequence(...)`. If invalid, reset drag state without mutating the document.
   - Preserve both primary and paired clips in horizontal sequence virtualization filter.

---

## 4. Verification Plan

### Automated Verification
- Run TypeScript and bundle verification:
  ```powershell
  pnpm --filter @acc/studio exec vite build --mode development
  ```

### Manual Acceptance Tests
1. **Track Type Compatibility**:
   - Drag a video clip over an audio track: verify red invalid drop styling appears and releasing cancels the drop.
   - Drag an audio clip over a video track: verify identical rejection.
2. **Linked A/V Pair Synchronization**:
   - Drag a linked video clip: observe the paired audio clip on the audio track sliding horizontally in perfect sync.
3. **Ripple Push / Insert Verification**:
   - Drop a 60-frame clip at frame 30 on a track that has clips starting at frame 40.
   - Verify the clip at frame 40 is pushed forward to frame 100 (`40 + 60`).
   - Press `Ctrl+Z`: verify all clips return to their original timestamps.
4. **Visual HUD**:
   - Verify live delta frames (`+00:01:14`) and snap guidelines display accurately during movement.
