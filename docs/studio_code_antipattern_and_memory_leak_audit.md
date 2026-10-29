# Enterprise Architecture & Code Quality Audit: `@acc/studio`

**Document Status:** Complete & Verified  
**Date:** 2026-10-29  
**Target:** `apps/studio` (ACC Dedicated React 19 NLE Studio Application)  
**Standard:** Enterprise Clean Coder, SOLID Principles, W3C WebCodecs / Web Audio Memory Hygiene  

---

## Executive Summary

An exhaustive code review and architectural analysis was performed across `apps/studio` to evaluate code anti-patterns, ad-hoc patches, design loopholes, race conditions, and potential memory leaks.

While the high-level architecture implements sophisticated non-linear editing (NLE) concepts (including SPSC lock-free audio ring buffers, WebCodecs hardware decoder lease pools, and discrete integer frame clocks), the implementation contains **competing memory ownership systems**, **detached bitmap invalidation bugs**, **unbounded queues**, **unhandled asynchronous race conditions in state compilation**, and **conflicting uncoordinated global event listeners**.

---

## 1. Potential Memory Leaks & Resource Exhaustion (High Risk)

### 1.1 Detached `ImageBitmap` Destruction Conflict
- **Locations:**
  - `apps/studio/src/renderer/workers/preview.worker.ts` (lines 37–61, 174–182)
  - `apps/studio/src/renderer/workers/PreviewFrameMemoryManager.ts` (lines 49–69)
- **Mechanism:**
  In `preview.worker.ts`, newly decoded video frames during scrubbing or idle refinement are cached in `PreviewFrameMemoryManager`:
  ```ts
  memoryManager.set(assetId, localFrame, bmp);
  safeSetTexture(assetId, bmp);
  ```
  Inside `safeSetTexture(id, bmp)`:
  ```ts
  const existing = textureCache.get(id);
  if (existing && existing !== bmp && typeof existing.close === 'function') {
    existing.close(); // Explicitly closes the existing bitmap!
  }
  ```
- **Architectural Defect:**
  The `existing` bitmap was also retained inside `PreviewFrameMemoryManager`'s LRU cache under `${assetId}:${previousFrame}`. Invoking `.close()` detaches and invalidates the underlying GPU/CPU buffer.
- **Consequences:**
  1. When scrubbing back to the previous frame, `memoryManager.get()` returns a **detached/closed `ImageBitmap`**.
  2. In the Web API standard, passing a closed `ImageBitmap` to `CanvasRenderingContext2D.drawImage()` throws an `InvalidStateError` or fails silently.
  3. Because a closed bitmap reports `width === 0`, `memoryManager.get()` validation `(cachedBmp.width > 0)` returns `false`. This breaks cache hits completely, forcing unneeded repeated decodes and thrashing the WebCodecs pipeline.

---

### 1.2 Leaked Unresolved Promises in `PreviewWorkerCoordinator.reset()`
- **Location:** `apps/studio/src/renderer/PreviewWorkerCoordinator.ts` (lines 218–234, 394–403)
- **Mechanism:**
  When a modifier execution is dispatched via `executeModifier()`, a Promise is instantiated and its `resolve`/`reject` callbacks are registered in `this.activeTasks`:
  ```ts
  return new Promise<void>((resolve, reject) => {
    this.activeTasks.set(payload.taskId, { targetId: payload.targetId, resolve, reject });
    ...
  });
  ```
  In `reset()`:
  ```ts
  public reset(): void {
    this.highPriorityQueue = [];
    this.lowPriorityQueue = [];
    this.activeTasks.clear(); // Leaks pending promises!
    this.completedTaskKeys.clear();
    this.isProcessing = false;
  }
  ```
- **Consequences:**
  `this.activeTasks.clear()` drops references without invoking `reject(new Error('Coordinator reset'))`. Any callers awaiting `preflightTimeline()` or `executeModifier()` are stranded in memory forever, leaking async context scopes and closure references.

---

### 1.3 Unbounded History Memory Leak in `TimelineCommandDispatcher`
- **Location:** `apps/studio/src/lib/timeline/commands/TimelineCommands.ts` (lines 84–100)
- **Mechanism:**
  ```ts
  export class TimelineCommandDispatcher {
    private history: TimelineCommand[] = [];

    public dispatch(command: TimelineCommand): void {
      const stateManager = IRStateManager.getInstance();
      command.execute(stateManager);
      this.history.push(command); // Unbounded array growth
    }
  }
  ```
- **Consequences:**
  Every split, trim, and move operation pushes to `this.history` without depth limits or eviction. Over a long editing session, this array grows indefinitely. Furthermore, this dispatcher duplicates the existing `HistoryManager` in `apps/studio/src/lib/commands/HistoryManager.ts` without supporting undo/redo.

---

### 1.4 Multiple Unshared `AudioContext` Allocations Without Teardown
- **Locations:**
  - `apps/studio/src/lib/audio/WebAudioEngine.ts` (lines 85–100)
  - `apps/studio/src/lib/audio/AudioAssetCache.ts` (lines 58–67)
- **Mechanism:**
  Both singletons instantiate independent `AudioContext`s:
  - `WebAudioEngine.initContext()` instantiates `new AudioCtx({ sampleRate: 44100 })`.
  - `AudioAssetCache.getAudioContext()` instantiates a separate `new AudioCtx({ sampleRate: 44100 })` solely for `decodeAudioData`.
- **Consequences:**
  Browsers enforce strict hardware limits (typically 4–6) on active `AudioContext` instances. Creating parallel unshared contexts causes mobile browser audio thread lockouts and `AudioContext` suspension errors. Neither class provides an explicit `close()` or teardown lifecycle.

---

### 1.5 Leaked File Lock on Cancelled OPFS MP4 Export
- **Location:** `apps/studio/src/lib/export/ClientExportOrchestrator.ts` (lines 134–184)
- **Mechanism:**
  In `exportToMp4`, a writable file stream is created:
  ```ts
  opfsWritable = await opfsFileHandle.createWritable();
  ```
  If the export is cancelled via `signal?.aborted` (lines 173–184):
  ```ts
  if (signal?.aborted) {
    if (typeof (sink as any).dispose === 'function') {
      await (sink as any).dispose();
    }
    return { cancelled: true, framesConsumed: f, fileSizeBytes: 0, buffer: null };
  }
  ```
- **Consequences:**
  Neither `opfsWritable.abort()` nor `opfsWritable.close()` is invoked. The browser retains an active lock and temporary `.crswap` file in the Origin Private File System until tab refresh. Furthermore, completed scratch export files in `acc_content_cache` (`export_${Date.now()}.mp4`) are never cleaned up, consuming OPFS quota.

---

### 1.6 Dead & Orphaned Infrastructure
- **Location:** `apps/studio/src/lib/timeline/ThumbnailLRUCache.ts` (lines 1–84)
- **Finding:**
  The `ThumbnailLRUCache` class is implemented with full LRU eviction and bitmap closing logic, but is **never imported or referenced anywhere in the monorepo**. It violates the `NO-ORPHANED-CODE` invariant.

---

## 2. Design Loopholes & Race Conditions

### 2.1 Async DAG Compilation Race Condition in `IRStateManager`
- **Location:** `apps/studio/src/lib/ir/irState.ts` (lines 117–164)
- **Mechanism:**
  ```ts
  public dispatch(command: ICommand): void {
    const newDoc = this.historyManager.execute(command, this.state.doc);
    this.state = { ...this.state, doc: newDoc };
    this.notify();
    this.recompile(); // Un-awaited async call
  }
  ```
- **Vulnerability:**
  `recompile()` is asynchronous (`await this.compiler.compile(...)`). If commands are dispatched in rapid succession (e.g., continuous parameter adjustments or slider dragging), Compile 1 and Compile 2 run concurrently.
  If Compile 1 completes *after* Compile 2, `timeline` from Compile 1 overwrites the newer timeline, desynchronizing `state.timeline` from `state.doc`.
  During the compilation window, `state.doc` reflects the new document while `state.timeline` holds stale sequences.

---

### 2.2 Preflight Cache Invalidation Loophole
- **Location:** `apps/studio/src/renderer/PreviewWorkerCoordinator.ts` (lines 213–216)
- **Mechanism:**
  ```ts
  const taskKey = `${payload.targetId}:${payload.modifier.type}`;
  if (this.completedTaskKeys.has(taskKey)) {
    return; // Skipped
  }
  ```
- **Loophole:**
  `taskKey` is composed only of `targetId` and `modifier.type`. If a user modifies the parameters of an existing modifier (e.g. changing blur radius, depth intensity, or transformation offset), `targetId` and `modifier.type` remain identical.
  Consequently, **all parameter mutations are skipped by background preflight** until a complete coordinator `reset()` is executed.

---

### 2.3 Competing Decoders During Playback Lookahead
- **Locations:**
  - `apps/studio/src/renderer/workers/preview.worker.ts` (lines 153–165)
  - `apps/studio/src/renderer/workers/WorkerClipPrewarmer.ts` (lines 90–105)
- **Mechanism:**
  During sequential playback (`isPlaying === true`):
  1. `preview.worker.ts` requests frames via `SequentialVideoReader` using `canvasSink.getCanvas()`.
  2. Concurrently, `WorkerClipPrewarmer.prewarmSequentialLookahead` calls `reader.requestFrame(localFrame, fps, false)` for frames `[currentFrame + 1 .. + 4]`.
- **Consequence:**
  Both paths concurrently issue seek and decode requests to the same underlying Mediabunny `CanvasSink`, causing internal WebCodecs decoder stalls, race conditions in canvas extraction, and dropped frames during playback.

---

### 2.4 Uncoordinated Global Keyboard Shortcut Collisions
- **Locations:**
  - `apps/studio/src/lib/shuttle/useShuttleEngine.ts` (lines 227–231)
  - `apps/studio/src/components/Timeline.tsx` (lines 155–182)
  - `apps/studio/src/components/preview/usePreviewHotkeys.ts` (lines 56–61)
- **Collisions:**
  1. **Cmd+K / Ctrl+K vs Shuttle K:** `useShuttleEngine` listens for `case 'KeyK'` on `window` and executes `e.preventDefault(); shuttleStop();` without verifying `metaKey` or `ctrlKey`. In `Timeline.tsx`, `Cmd+K` is mapped to razor split. Pressing `Cmd+K` halts the shuttle *and* triggers a razor split.
  2. **Delete / Backspace Collision:** Both `usePreviewHotkeys` and `Timeline.tsx` listen for `Delete`/`Backspace` on `window`. When a clip is selected, both fire concurrently: `usePreviewHotkeys` calls `IRStateManager.deleteSequence()`, while `Timeline.tsx` invokes `RippleDeleteCommand`. Depending on listener order, this causes double deletions or mutations against deleted IDs.
  3. **Spacebar Collision:** `useShuttleEngine` calls `togglePlay()`, while `usePreviewHotkeys` sets `isSpacePressed(true)` for the hand canvas pan tool.

---

### 2.5 High-Frequency Playhead Stuttering
- **Locations:**
  - `apps/studio/src/lib/shuttle/useShuttleEngine.ts` (lines 180–188)
  - `apps/studio/src/App.tsx` (lines 94–102)
  - `apps/studio/src/lib/playhead/StudioPlayheadController.ts` (lines 83–95)
- **Mechanism:**
  `StudioPlayheadController` separates subscribers into `subscribeHighFrequency` (60 FPS direct canvas/needle blits) and `subscribeLowFrequency` (throttled 10 Hz React updates).
  However, in `useShuttleEngine.ts`, the 60 FPS RAF loop only calls `onScrub(frame)` every **66ms (~15 FPS)**:
  ```ts
  if (now - lastUiSyncTime >= 66) {
    lastUiSyncTime = now;
    onScrubRef.current(discreteFrame);
  }
  ```
  `onScrub` is the **only** caller invoking `StudioPlayheadController.seek()`. Consequently, `highFreqSubscribers` only fires at 15 FPS instead of 60 FPS, causing canvas rendering and timeline needle animation to stutter during playback.

---

## 3. Code Anti-Patterns & Structural Deficiencies

### 3.1 React 19 `useSyncExternalStore` Contract Violations
- **Locations:**
  - `apps/studio/src/lib/ir/useStudioStore.ts` (lines 19–39)
  - `apps/studio/src/lib/ir/irState.ts` (lines 99–105)
  - `apps/studio/src/lib/playhead/StudioPlayheadController.ts` (lines 59–78)
- **Violations:**
  1. **Synchronous Notification Inside Subscribe:**
     In `irState.ts` (line 101) and `StudioPlayheadController.ts` (lines 62, 74), `subscribe` calls the callback synchronously:
     ```ts
     this.subscribers.add(callback);
     callback(this.state); // Synchronous invocation during subscribe
     ```
     React expects `subscribe` to register the listener without invoking it synchronously during component mount/commit.
  2. **Impure `getSnapshot` in `useIRSelector`:**
     ```ts
     const getSelection = (): T => {
       const next = selector(manager.getSnapshot());
       if (prevRef.current.hasValue && isEqual(prevRef.current.value, next)) {
         return prevRef.current.value;
       }
       prevRef.current = { hasValue: true, value: next }; // Mutating ref during getSnapshot
       return next;
     };
     ```
     React Concurrent Mode can evaluate `getSnapshot` multiple times or abort renders. Mutating refs inside `getSnapshot` breaks function purity and can lead to tearing.

---

### 3.2 Pervasive `JSON.parse(JSON.stringify)` Allocations
- **Locations:** All 18 command classes in `apps/studio/src/lib/commands/`
- **Finding:** Over 60 occurrences of synchronous `JSON.parse(JSON.stringify(doc))` exist across the command pattern layer. During 60 FPS dragging or keyframe scrubbing, this causes massive GC pauses. A canonical utility `cloneIR` with native `structuredClone` was created in `studioTypes.ts`, but is bypassed across all commands.

---

### 3.3 Engine Re-Instantiation on Every Prop Change
- **Location:** `apps/studio/src/renderer/strategies/MainThreadRenderStrategy.ts` (lines 61–69)
- **Mechanism:**
  ```ts
  public updateTimeline(timeline: ResolvedTimeline, ...): void {
    this.timeline = timeline;
    this.recreateEngine(timeline); // Allocates a brand-new IRPreviewEngine instance
  }
  ```
  `IRPreviewEngine` provides a dedicated method `syncTimeline()` for in-place updates. Recreating the engine throws away internal caches, resets IntervalTrees, and detaches/reattaches the audio mixer on every prop change.

---

### 3.4 Direct State Mutation Bypassing History Command Pattern
- **Location:** `apps/studio/src/lib/ir/irState.ts` (lines 397–407)
- **Mechanism:**
  ```ts
  public addAsset(assetId: string, asset: StudioAssetRecord): void {
    const assets = { ...(this.state.doc.assets || {}), [assetId]: asset };
    this.state = { ...this.state, doc: { ...this.state.doc, assets } };
    this.notify();
  }
  ```
  Unlike all other mutating operations, `addAsset` directly mutates `this.state.doc` without creating an `ICommand`. It cannot be undone or redone and fails to trigger `recompile()`.

---

### 3.5 Insufficient Cache Key Granularity in Waveform Pyramid
- **Location:** `apps/studio/src/components/timeline/WaveSurferWaveform.tsx` (lines 16–35)
- **Mechanism:**
  The module-level `pyramidCache` uses only `id` as the key:
  ```ts
  let pyramid = pyramidCache.get(id);
  ```
  If an audio sequence is trimmed, extended, or replaced, `id` remains identical. The component permanently renders the stale waveform pyramid from its initial duration.

---

## 4. Ad-Hoc Patches & Fragile Workarounds

### 4.1 Dead Flag Workaround: `_isTransient`
- **Location:** `apps/studio/src/renderer/workers/preview.worker.ts` (lines 206, 230)
- **Code:**
  ```ts
  if (asset && (asset as any)._isTransient && typeof (asset as any).close === 'function') {
    (asset as any).close();
  }
  ```
- **Finding:** `_isTransient` is checked in two places in `preview.worker.ts`, but is **never set on any object anywhere in the entire codebase**. It is an orphaned monkey-patch left over from an abandoned refactor.

---

### 4.2 Synchronous Video Element Seek Thrashing
- **Location:** `apps/studio/src/lib/textures/AssetTextureCache.ts` (lines 385–391)
- **Mechanism:**
  ```ts
  if (Math.abs(vEntry.video.currentTime - targetTime) > 0.05) {
    try {
      vEntry.video.currentTime = targetTime;
    } catch { }
  }
  ```
  Setting `HTMLVideoElement.currentTime` synchronously inside the 60 FPS canvas render loop triggers browser decode stalls. Furthermore, `onseeked` is never hooked to notify the render strategy when the frame arrives, leaving the canvas displaying stale frames.

---

### 4.3 Conflicting Memory Limits & Magic Numbers
- **Location:** `apps/studio/src/renderer/workers/PreviewFrameMemoryManager.ts` (lines 6, 19)
- **Code:**
  ```ts
  // Rule 1 in docstring: "MAX_GLOBAL_FRAMES = 64 (~150MB RAM ceiling)."
  private readonly MAX_GLOBAL_FRAMES = 8; // Hardcoded to 8
  ```
  The implementation hardcodes an aggressive ceiling of 8 frames across all video assets, causing immediate thrashing on timelines with 3+ simultaneous video tracks.

---

### 4.4 Completely Unused Worker Playback Pipeline
- **Locations:**
  - `apps/studio/src/renderer/workers/PreviewWorkerBridge.ts` (lines 411–428)
  - `apps/studio/src/renderer/workers/preview.worker.ts` (lines 481–499)
- **Finding:** An entire worker-driven playback loop (`startPlayback`, `stopPlayback`, `playbackLoop`, `workerClock`) was implemented in `preview.worker.ts` and `PreviewWorkerBridge`. However, the app never invokes `bridge.startPlayback()`. Instead, `useShuttleEngine.ts` runs its own RAF loop on the main thread and dispatches individual `renderFrame` messages.

---

## 5. Architectural Remediation Plan

| Priority | Issue | Recommended Solution |
| :--- | :--- | :--- |
| **P0** | **Bitmap Cache Destruction** (`safeSetTexture` vs `PreviewFrameMemoryManager`) | Transfer ownership of `ImageBitmap` lifecycle exclusively to `PreviewFrameMemoryManager`. Remove `.close()` from `safeSetTexture`; let the memory manager handle LRU eviction and disposal. |
| **P0** | **Uncoordinated Keyboard Listeners** | Consolidate all keyboard handling into a centralized `StudioKeyboardManager` with a focused priority stack (Modal > Active Tool > Transport > Workspace). |
| **P1** | **Async Compilation Race** (`IRStateManager.recompile`) | Introduce a monotonically increasing revision counter or AbortController to discard out-of-order DAG compilation results. |
| **P1** | **Coordinator Task Invalidation** | Incorporate a hash of `modifier.params` into `taskKey` (`${targetId}:${modifier.type}:${contentHash}`). Reject pending promises on `reset()`. |
| **P1** | **60 FPS Playhead Decoupling** | Ensure `useShuttleEngine` calls `StudioPlayheadController.seek()` on **every** RAF frame tick, and only throttle React state setters (`usePlayheadFrame`). |
| **P2** | **AudioContext Singleton Consolidation** | Unify `WebAudioEngine` and `AudioAssetCache` to share a single, lazily initialized `AudioContext` provider. |
| **P2** | **Replace `JSON.parse(JSON.stringify)`** | Refactor command classes to use structural cloning via `cloneIR()` or shallow path updates. |
| **P2** | **OPFS Lock Release & Cleanup** | Ensure `opfsWritable.close()` / `abort()` is called in `finally` blocks during cancelled exports, and purge scratch files upon task completion. |
| **P3** | **Remove Orphaned Code** | Delete `ThumbnailLRUCache.ts` and clean up dead references to `_isTransient` in `preview.worker.ts`. |
