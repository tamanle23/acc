# Comprehensive Implementation Plan: Studio Preview Playback Smoothness & High-Frequency Decoupling

## Goal Description
Resolve persistent playback stutter and visual lag in Studio preview during playback. Even though telemetry reports 60 FPS, the preview suffers from:
1. **Async Stale Promise Racing**: React state reconciliations trigger async texture syncs that post stale older frame render requests to the worker 15–25ms after the playhead has already advanced, causing a jarring 2-frame backward jitter every 66ms ($0 \rightarrow 1 \rightarrow 2 \rightarrow \mathbf{0} \rightarrow 3 \rightarrow 4 \rightarrow \mathbf{2} \rightarrow 5$).
2. **Discrete 30 Hz Integer Step Playhead Judder**: On a 30 FPS timeline viewed on a 60/120 Hz display, the playhead needle only moves on discrete integer frame increments, freezing for 33.3ms and jumping by whole frames, visually appearing broken and choppy.
3. **Duplicate Frame Renders**: The 60 Hz RAF loop dispatches redundant render calls for the exact same integer frame (30 times/sec), burning GPU/CPU and queuing up worker messages.
4. **Track Isolation Scratch Canvas Bypass**: Blended tracks (such as Track V2 with `blendMode: 'screen'` and particle overlays) allocate full $1920 \times 1080$ scratch canvases on every frame, completely ignoring the virtual canvas downsampling.
5. **Worker Canvas GPU Readbacks**: The worker 2D canvas context is initialized with `willReadFrequently: false`, forcing GPU pipeline flushes and PCIe readback stalls when `vfx/color_grading` performs pixel-level operations (`getImageData`).

---

## User Review Required
> [!IMPORTANT]
> **Sub-Frame Playhead Needle Interpolation**: The playhead needle will now glide continuously at the monitor's native refresh rate (60 Hz, 120 Hz, 144 Hz) using fractional frame coordinates during active playback, while canvas frame rendering and editing snapping strictly remain locked to discrete integer frames.
>
> **Playback Render Exclusivity**: During active playback (`isPlaying === true`), asynchronous React effect passes will no longer re-dispatch `strategy.renderFrame(currentFrame)`. Only the high-frequency playhead subscriber drives frame rendering during playback.

---

## Proposed Changes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            STUDIO PLAYBACK PIPELINE                         │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────┐         RAF 60Hz Tick
│  DeterministicTimeline    │ ──────────────────────────────┐
│  Clock (audio / mono)     │                               │
└───────────────────────────┘                               ▼
          │                                 ┌───────────────────────────────┐
          ▼                                 │ useShuttleEngine              │
  targetFrame (Float)                       │ - Fractional: 12.43           │
  discreteFrame (Int: 12)                   │ - Discrete: 12                │
                                            └───────────────────────────────┘
                                                            │
                                                            ▼
                                            ┌───────────────────────────────┐
                                            │ PlayheadController      │
                                            │ seek(discrete, fractional)    │
                                            └───────────────────────────────┘
                                              │                           │
                   High-Freq (Needle)         │                           │ High-Freq (Canvas)
                   (Every 16.6ms @ 60Hz)      ▼                           ▼ (Only when discrete frame changes!)
                ┌───────────────────────────────┐               ┌───────────────────────────────────┐
                │ Timeline Playhead Needle      │               │ WorkerRenderStrategy              │
                │ translate3d(leftPx)           │               │ - if (frame === last) SKIP        │
                │ Continuous Sub-Pixel Glide    │               │ - postMessage('renderFrame')      │
                └───────────────────────────────┘               └───────────────────────────────────┘
                                                                                  │
                                                                                  ▼
                                                                ┌───────────────────────────────────┐
                                                                │ preview.worker.ts                 │
                                                                │ - willReadFrequently: true        │
                                                                │ - IRCanvasCompositor              │
                                                                │   Scratch canvas sizes to         │
                                                                │   virtual buffer (960x540)        │
                                                                └───────────────────────────────────┘
```

---

### Component 1: `apps/studio` — Playhead & Shuttle Engine

#### [MODIFY] [`apps/studio/src/lib/playhead/PlayheadController.ts`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/lib/playhead/PlayheadController.ts)
* Update `PlayheadSubscriber` type:
  ```ts
  export type PlayheadSubscriber = (
    frame: number,
    isPlaying: boolean,
    fractionalFrame?: number
  ) => void;
  ```
* Store `private currentFractionalFrame = 0`.
* Extend `seek(frame: number, immediateUiSync = false, fractionalFrame?: number)`:
  * Clamp both integer `currentFrame` and continuous `currentFractionalFrame`.
  * Pass `(this.currentFrame, this.isPlaying, this.currentFractionalFrame)` to high-frequency subscribers.
* Increase `lowFreqSyncIntervalMs` from 100ms to 250ms during active playback to reduce React reconciliation pressure on the main thread by 60%.

#### [MODIFY] [`apps/studio/src/lib/shuttle/useShuttleEngine.ts`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/lib/shuttle/useShuttleEngine.ts)
* In `tick(now)`:
  * Retain exact floating-point time: `const rawFractionalFrame = targetFrame`.
  * Compute `discreteFrame = snapToDiscreteFrame(rawFractionalFrame)`.
  * Track `lastRenderedDiscreteFrameRef`: only trigger canvas renders when the integer frame advances (or on shuttle speed change).
  * Check audio engine state: verify `WebAudioEngine.getInstance().getIsPlaying() && WebAudioEngine.getInstance().isContextRunning()` before selecting `audio_master` mode; fallback to monotonic delta if context is suspended.
  * Dispatch `PlayheadController.getInstance().seek(discreteFrame, false, rawFractionalFrame)`.
  * Throttle `onScrubRef.current(discreteFrame)` to 250ms during active playback.

#### [MODIFY] [`apps/studio/src/components/Timeline.tsx`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/components/Timeline.tsx)
* In the needle high-frequency subscription:
  ```ts
  return PlayheadController.getInstance().subscribeHighFrequency(
    (frame, isPlaying, fractionalFrame) => {
      const activeFrame = isPlaying && fractionalFrame !== undefined ? fractionalFrame : frame;
      const leftPx = 208 + activeFrame * pixelsPerFrame;
      needle.style.transform = `translate3d(${leftPx}px, 0, 0)`;
    }
  );
  ```

---

### Component 2: `apps/studio` — Viewport Render Strategy & Worker Bridge

#### [MODIFY] [`apps/studio/src/components/preview/useViewportRenderStrategy.ts`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/components/preview/useViewportRenderStrategy.ts)
* In the low-frequency React `useEffect` (lines 117–137):
  * **Suppress renderFrame dispatch when `isPlaying === true`**:
    ```ts
    if (isPlaying) {
      // During active playback, frame rendering is driven exclusively by high-frequency playhead ticks.
      // Do not dispatch stale async frame render calls from React reconciliation.
      return;
    }
    ```
* In high-frequency playhead subscription (lines 140–151):
  * Track `lastDispatchedFrameRef`: skip dispatch if `frame === lastDispatchedFrameRef.current && playing`.

#### [MODIFY] [`apps/studio/src/renderer/strategies/WorkerRenderStrategy.ts`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/renderer/strategies/WorkerRenderStrategy.ts)
* Track `lastRenderedFrame`: skip posting message to worker if `frame === this.lastRenderedFrame && options?.isPlaying`.

#### [MODIFY] [`apps/studio/src/renderer/workers/preview.worker.ts`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/preview.worker.ts)
* Line 443: Change canvas context initialization to:
  ```ts
  ctx = canvas.getContext('2d', {
    willReadFrequently: true,
  }) as OffscreenCanvasRenderingContext2D;
  ```
  Eliminates Chromium GPU readback stalls when `vfx/color_grading` executes `getImageData()`.

---

### Component 3: `packages/ir` — Canvas Compositor Virtual Resolution for Isolated Tracks

#### [MODIFY] [`packages/ir/src/renderer/shared/IRCanvasCompositor.ts`](file:///mnt/c/Users/Admin/workspace/git/acc/packages/ir/src/renderer/shared/IRCanvasCompositor.ts)
* In `finishTrackIsolation`:
  * Size isolated scratch canvas to `(bufferW, bufferH)` when `isVirtualScaled` is true, rather than hardcoded full timeline `(width, height)`.
  * Apply `scratchCtx.scale(scaleX, scaleY)` on the scratch context so track sequences render natively into the downscaled virtual buffer.
  * Eliminates full 1080p software canvas clears and particle calculations for blended overlay tracks (Track V2).

---

## Verification Plan

### Automated Tests
* Create unit test in `/autogenerated-tests/preview_playback_smoothness.test.ts`:
  * Verifies `PlayheadController.seek()` dispatches `fractionalFrame` to high-frequency subscribers.
  * Verifies `useViewportRenderStrategy` suppresses async stale render dispatches during active playback.
  * Verifies `WorkerRenderStrategy` deduplicates identical integer frame render calls.
  * Verifies `IRCanvasCompositor` sizes scratch canvas to virtual buffer dimensions when `isVirtualScaled` is true.

### Manual Verification
1. Launch Studio preview in browser (`pnpm --filter @acc/studio dev`).
2. Play default demo project at normal speed (Space / L).
3. Observe the playhead needle: verify it glides smoothly at 60 Hz without 30 Hz jumping or pauses.
4. Observe the preview viewport: verify zero backward frame jitter ($N+2 \rightarrow N \rightarrow N+3$).
5. Select `Auto`, `Half (1/2)`, and `Quarter (1/4)` virtual resolution modes: verify playback remains smooth with active Color Grading and particle overlays.
