# 463. Eliminate Preview Black Flashing & Unify Shuttle Engine

## Problem
Following preliminary worker unification, preview video playback in `@acc/studio` still suffered from recurring black frame flashes. A deep code and document review uncovered 5 critical root causes:
1. **SolidJS Reactive Tracking Leak**: In `useViewportRenderStrategy.ts`, reading `options.currentFrame` directly inside `createEffect` subscribed the setup effect to low-frequency playhead ticks (250ms interval). Every 250ms during playback, `strategy.resize()` and `strategy.updateTimeline()` were invoked mid-playback, wiping the canvas and rebuilding the worker engine.
2. **Dimension Mutation Canvas Blanking**: In `preview.worker.ts`, the `resize` handler assigned `canvas.width = ...` and `canvas.height = ...` without checking if dimensions actually changed. In the HTML5 Canvas specification, setting canvas dimensions synchronously clears the entire bitmap buffer to transparent/zero pixels.
3. **Double-Buffer Invariant Inversion**: In `SequentialVideoReader.ts`, Step 4 was mutating `this.activeSlot` directly on cache misses rather than decoding into the inactive slot and swapping only on verified decode success. When a decode was delayed, the active canvas was cleared before hold-on-miss could preserve it.
4. **Mediabunny Decoder Collisions**: WebCodecs packet retrieval via `CanvasSink.getCanvas()` was executed concurrently between active playback (`requestSequentialFrame`), forward preloading (`preloadNext`), and background clip prewarming (`prewarmSequence`), triggering iterator desynchronization (`Iterator returned nothing`).
5. **Split-Brain Playback & Synthetic Mocks**: `PreviewWorkerBridge.ts` contained dead mock classes (`PreviewRenderWorkerCore`, `DecodedFrameCache`) and an orphaned secondary `playbackLoop` that was never called because `useShuttleEngine` drives the authoritative master clock on the main thread for audio-video sync.

## Plan
1. **Unify Playback Architecture strictly in `useShuttleEngine`**:
   - Eliminate orphaned `playbackLoop` and `startPlayback`/`stopPlayback` handlers from `preview.worker.ts` and `PreviewWorkerBridge.ts`.
   - Remove synthetic test mocks (`PreviewRenderWorkerCore`, `DecodedFrameCache`) from `PreviewWorkerBridge.ts`.
   - Retarget `studio_offscreen_worker_parity.test.ts` to test real production classes (`PreviewWorkerBridge`, `SequentialVideoReader`).
2. **Fix SolidJS Reactive Tracking Leak**:
   - Wrap `options.currentFrame` in `untrack()` within `useViewportRenderStrategy.ts`.
   - Guard `onModifierWarmed` so it does not trigger parked render passes while `options.isPlaying` is true.
3. **Enforce Double-Buffer Invariants & CanvasSink Mutex**:
   - In `SequentialVideoReader.ts`, decode exclusively to `this.getInactiveSlot()`.
   - Only execute `this.swap()` when `painted === true`.
   - Remove canvas-wiping `clearRect` calls before `drawImage` on video slots.
   - Enforce single-flight serialized access to `canvasSink.getCanvas()` using an internal promise queue.
4. **Bypass Prewarmer Decodes During Playback**:
   - In `WorkerClipPrewarmer.ts`, bypass background `prewarmSequence` frame 0 decodes when `isPlaying === true`.
5. **Guard Canvas Resizing & Compositor Fallback Blitting**:
   - In `preview.worker.ts`, add equality checks before setting `canvas.width` and `canvas.height`.
   - Before blitting `backCanvas` to the onscreen canvas, verify that an active video clip did not miss its texture; if so, retain the front canvas buffer to guarantee zero black frame flashes.

## Changes

### `apps/studio/src/renderer/workers/PreviewWorkerBridge.ts`
- Completely removed dead mock classes `PreviewRenderWorkerCore` and `DecodedFrameCache`.
- Completely removed bypassed `startPlayback` and `stopPlayback` methods.
- Streamlined bridge to pure production singleton protocol managing worker communication, offscreen canvas transfer, and texture streaming.

### `apps/studio/src/renderer/workers/preview.worker.ts`
- Removed orphaned `playbackLoop`, `stopPlayback`, and `'startPlayback'`/`'stopPlayback'` message cases.
- Removed dead variables (`shuttleSpeed`, `rafId`, `lastRafTime`, `lastUiSyncTime`, `workerClock`).
- Added dimension equality check in `case 'resize'` to avoid synchronous canvas clearing when dimensions have not changed.
- Added texture readiness guard before `ctx.drawImage(backCanvas!, 0, 0)`: holds the front-buffer when an active video sequence's frame decode is delayed rather than blitting a black back-buffer.

### `apps/studio/src/renderer/workers/SequentialVideoReader.ts`
- Implemented single-flight `enqueueDecode` promise mutex queue on `CanvasSink`.
- Enforced strict double-buffering: decodes exclusively to `this.getInactiveSlot()` and swaps only on verified decode success.
- Removed `clearRect(0, 0, w, h)` prior to `drawImage(raw, 0, 0, w, h)`.
- Preserved pristine hold-on-miss: active slot is never mutated on failed or delayed decodes.

### `apps/studio/src/renderer/workers/WorkerClipPrewarmer.ts`
- Suppressed background `prewarmSequence` frame 0 decoding when `isPlaying === true`, avoiding WebCodecs decoder bandwidth contention.

### `apps/studio/src/components/preview/useViewportRenderStrategy.ts`
- Wrapped `options.currentFrame` in `untrack()` inside setup `createEffect`.
- Guarded `onModifierWarmed` against calling `renderFrame` during active playback.

### `autogenerated-tests/studio_offscreen_worker_parity.test.ts`
- Re-architected test suite away from synthetic mocks to verify real production `PreviewWorkerBridge` singleton behavior, `SequentialVideoReader` inactive-slot mutation isolation, hold-on-miss preservation, and `CanvasSink` serialized mutex access.

## Verification
1. **Studio Test Suites**:
   - `bun test autogenerated-tests/studio_offscreen_worker_parity.test.ts autogenerated-tests/studio_preview_playback_cadence.test.ts autogenerated-tests/studio_solid_migration_architecture.test.ts autogenerated-tests/studio_liquid_glass_theme.test.ts`
   - Result: 19 pass, 0 fail (562 expect() calls).
2. **Production Bundle Verification**:
   - `pnpm --filter @acc/studio build`
   - Result: Built in 30.02s with 0 errors. Chunks minified and bundled cleanly.

## Walkthrough
- `useShuttleEngine` controls playback transport monotonically, maintaining audio hardware clock synchronization with `WebAudioEngine`.
- High-frequency RAF ticks advance the playhead smoothly at 60 FPS without triggering SolidJS component re-renders.
- `useViewportRenderStrategy` dispatches discrete frame render commands to `PreviewWorkerBridge` without reactive leaks or mid-playback resizes.
- `SequentialVideoReader` serializes WebCodecs decoding via an internal mutex, decodes exclusively to the inactive slot buffer, and swaps only on success.
- On any decode delay or frame drop, the active slot and front-buffer are held pristine, completely eliminating black frame flashing.

## Tasks
- [x] Eliminate synthetic mock classes (`PreviewRenderWorkerCore`, `DecodedFrameCache`) from `PreviewWorkerBridge.ts`.
- [x] Remove dead parallel worker playback loop (`playbackLoop`, `startPlayback`, `stopPlayback`).
- [x] Fix SolidJS reactive tracking leak in `useViewportRenderStrategy.ts`.
- [x] Guard `onModifierWarmed` against mid-playback state demotion.
- [x] Enforce inactive-slot decoding and mutex serialization in `SequentialVideoReader.ts`.
- [x] Suppress background clip pre-decoding during active playback in `WorkerClipPrewarmer.ts`.
- [x] Guard canvas resize dimension reset and black back-buffer blits in `preview.worker.ts`.
- [x] Verify real-world test suite (19 passing tests) and production build.

## Enhancement
- Timeline clip transitions with dissolve or cross-fade can leverage the dual-slot ping-pong buffer directly by reading both slots simultaneously with alpha blending.
