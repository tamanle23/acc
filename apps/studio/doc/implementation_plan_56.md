# Implementation Plan 56: Studio Preview Playback Smoothness & High-Frequency Decoupling

## Overview
Even though telemetry displays 60 FPS playback, the preview in Studio suffers from visual lag and stutter caused by:
1. Stale async React texture-sync promises dispatching outdated frames ($N+2 \rightarrow N \rightarrow N+3$).
2. Discrete 30 Hz integer step jumping of the timeline playhead needle on 60/120 Hz displays.
3. Worker queue message flooding from duplicate frame rendering on consecutive 60 Hz RAF ticks.
4. Track isolation scratch canvas allocating full 1080p buffers on blended overlay tracks, bypassing virtual resolution.
5. Worker 2D canvas context configured with `willReadFrequently: false`, causing GPU readback stalls on pixel filters.

---

## Phased Roadmap

### Phase 1: Viewport Render Strategy & Async Race Elimination
* In `apps/studio/src/components/preview/useViewportRenderStrategy.ts`:
  * Suppress `strategy.renderFrame(currentFrame)` in low-frequency React `useEffect` when `isPlaying === true`.
  * Ensure high-frequency playhead subscriber alone drives canvas rendering during playback.

### Phase 2: High-Frequency Sub-Frame Needle Gliding & Frame Deduplication
* In `apps/studio/src/lib/playhead/PlayheadController.ts`:
  * Add `fractionalFrame` to `PlayheadSubscriber` and `seek(frame, immediateUiSync, fractionalFrame)`.
  * Throttle `notifyLowFreq` to 250ms during playback to reduce React reconciliation by 60%.
* In `apps/studio/src/lib/shuttle/useShuttleEngine.ts`:
  * Track raw continuous frame and pass both discrete and fractional frames to `PlayheadController.seek()`.
  * Guard audio context running state.
* In `apps/studio/src/components/Timeline.tsx`:
  * Bind needle position to `fractionalFrame ?? frame` during active playback for 60/120 Hz gliding.
* In `apps/studio/src/renderer/strategies/WorkerRenderStrategy.ts`:
  * Deduplicate render dispatches when discrete integer frame has not changed during playback.

### Phase 3: Track Isolation Virtual Buffer Resolution
* In `packages/ir/src/renderer/shared/IRCanvasCompositor.ts`:
  * Size isolated scratch canvases to `(bufferW, bufferH)` when `isVirtualScaled` is active.
  * Apply scale transform to scratch context so overlay particle passes run at virtual preview resolution.

### Phase 4: Worker Canvas Readback Acceleration
* In `apps/studio/src/renderer/workers/preview.worker.ts`:
  * Initialize canvas 2D context with `{ willReadFrequently: true }` to eliminate Chromium GPU pipeline flushes and PCIe readback penalties during color grading.

---

## File Changes
* `apps/studio/src/components/preview/useViewportRenderStrategy.ts`
* `apps/studio/src/lib/playhead/PlayheadController.ts`
* `apps/studio/src/lib/shuttle/useShuttleEngine.ts`
* `apps/studio/src/components/Timeline.tsx`
* `apps/studio/src/renderer/strategies/WorkerRenderStrategy.ts`
* `packages/ir/src/renderer/shared/IRCanvasCompositor.ts`
* `apps/studio/src/renderer/workers/preview.worker.ts`
