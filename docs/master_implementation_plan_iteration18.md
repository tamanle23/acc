# Master Implementation Plan (Iteration 18): Refactor Canvas Video Preview Engine for Remotion-Level 60fps Playback

## Goal Description
Audit the current Studio playback loop, clock, and canvas renderer to eliminate frame drops, seek latency, and rendering overhead during 60fps playback. Refactor the playback engine to achieve Remotion-level smoothness by implementing:
1. **Mediabunny / WebCodecs Decoded Frame Streaming** with a Lookahead Ring Buffer (6–10 decoded `VideoFrame`s / `ImageBitmap`s ahead of the playhead) to eliminate HTML `<video>` seek thrashing.
2. **Lookahead Clip Pre-Warming Scheduler**: Pre-fetch, mount, seek, and decode the first frame of upcoming clips 1.5 seconds ahead of their timeline start timestamp, eliminating cut/transition stutter.
3. **Dirty-Frame & Texture Caching**: Skip redundant redraws on 120Hz/144Hz displays when `targetFrame === lastRenderedFrame`. Rasterize static text/SVG/vector overlays once to offscreen bitmap textures upon change, applying keyframe transformations and opacity dynamically on cached textures during the frame loop.

---

## Audit of Current Bottlenecks

1. **HTML `<video>` Seek Thrashing in `AssetTextureCache.ts`**:
   - Currently, in `apps/studio/src/lib/textures/AssetTextureCache.ts` lines 122–126:
     ```typescript
     if (Math.abs(vEntry.video.currentTime - targetTime) > 0.05) {
       vEntry.video.currentTime = targetTime;
     }
     ```
     At 60fps playback (every 16.6ms), changing `HTMLVideoElement.currentTime` invokes browser demuxing and decoding threads on the main DOM element. Browsers cannot decode compressed GOP inter-frames at 60Hz via DOM seek, causing severe jitter, stalled playback, and skipped frames.
2. **Synchronous `createImageBitmap` on Every Frame Transfer**:
   - In `apps/studio/src/components/Preview.tsx` lines 333–354, on every frame tick, `createImageBitmap(visualAsset.source)` is called and awaited inside a `Promise.all` before posting to the Web Worker. This incurs per-frame heap churn, GC pressure, and frame drops.
3. **Lack of Clip Lookahead Pre-Warming**:
   - When the playhead crosses a clip cut (e.g. from Clip 1 to Clip 2 at frame 90), Clip 2's asset is requested *at* frame 90. If it is not in cache, a blank charcoal placeholder is rendered for several frames until the network/decoder loads it.
4. **Redundant Redraws on Display Refresh Cycles**:
   - Neither `preview.worker.ts` nor `Preview.tsx` tracks `lastRenderedFrame`. When playback is paused or running on a 120Hz/144Hz display, `requestAnimationFrame` fires at the display rate, redundantly clearing and re-rendering identical frames and running full matrix math across all tracks.
5. **Static Text / SVG Overlay Re-Rasterization**:
   - Vector shapes and text cues are drawn or transformed in DOM / Canvas on every tick without texture caching.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                      StudioPlayheadController                          │
│               (High-Frequency 60fps Tick / Scrub)                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌───────────────────────────────┐         ┌──────────────────────────────┐
│  LookaheadPrewarmScheduler    │         │     MediabunnyVideoReader    │
│  - Scans [playhead, +1.5s]    │         │  - Ring Buffer (6-10 frames) │
│  - Pre-decodes upcoming clips │         │  - Pre-decoded ImageBitmaps  │
│  - Caches hero frame          │         │  - Zero DOM seek thrashing   │
└───────────────────────────────┘         └──────────────┬───────────────┘
                                                         │
                                                         ▼
                                          ┌──────────────────────────────┐
                                          │      AssetTextureCache       │
                                          │  - Instant cache hit         │
                                          │  - Offscreen Textures        │
                                          └──────────────┬───────────────┘
                                                         │
                                                         ▼
                                          ┌──────────────────────────────┐
                                          │  Preview Worker / Compositor │
                                          │  - Dirty-frame check         │
                                          │  - Bitmap blit + transform   │
                                          │  - 60fps stable loop         │
                                          └──────────────────────────────┘
```

---

## Proposed Changes

### Component 1: `apps/studio/src/lib/video/` (Mediabunny Video Reader & Lookahead Ring Buffer)

#### [NEW] `apps/studio/src/lib/video/MediabunnyVideoReader.ts`
- Encapsulates `mediabunny.Input`, `mediabunny.UrlSource`, and `mediabunny.CanvasSink`.
- Maintains a **Lookahead Ring Buffer** of 6–10 pre-decoded `ImageBitmap` frames indexed by frame number.
- Offers instantaneous synchronous reads for `getFrame(targetFrame)`:
  - If in buffer: returns pre-decoded bitmap immediately (0ms latency, zero GC).
  - Triggers asynchronous lookahead fetch to fill the ring buffer ahead of the playhead.
- Implements `seek(frame)` with rapid GOP seek without DOM video thrashing.
- Disposes decoded frames using `.close()` when evicted from the ring buffer.

---

### Component 2: `apps/studio/src/lib/video/` (Lookahead Clip Pre-Warming Scheduler)

#### [NEW] `apps/studio/src/lib/video/LookaheadClipScheduler.ts`
- Watches `StudioPlayheadController` playhead position.
- Calculates lookahead window: `[currentFrame, currentFrame + fps * 1.5]`.
- Queries the timeline `IntervalTreeIndex` for clips entering in that window.
- For each upcoming sequence:
  - If not yet warmed: creates reader / requests first frame decode at sequence `startFrame`.
  - Warms asset into `AssetTextureCache` so the frame is already cached in memory before the playhead reaches the cut.
- Completely eliminates stutter and black/charcoal placeholder flashes at cut boundaries.

---

### Component 3: `apps/studio/src/lib/textures/` (AssetTextureCache & Static Overlay Rasterization)

#### [MODIFY] `apps/studio/src/lib/textures/AssetTextureCache.ts`
- Integrate `MediabunnyVideoReader` as the primary video decoding strategy.
- When `assetType === 'video' | 'media'`:
  - Fetch frames from `MediabunnyVideoReader` ring buffer.
  - Fallback to `<video>` only if browser cannot decode via mediabunny.
- **Static Overlay / Text Caching**:
  - Add `getRasterizedTextTexture(text, style, dpr)`: caches offscreen canvas/bitmap of rendered text.
  - Add `getRasterizedShapeTexture(shapeKey, drawFn, width, height)`: caches static vector shape textures once.
  - In render loops, only the cached bitmap is blitted with CSS/2D context transforms and opacity applied.

---

### Component 4: `apps/studio/src/workers/` & `Preview.tsx` (Dirty-Frame Skipping & Coalescing)

#### [MODIFY] `apps/studio/src/workers/preview.worker.ts`
- Implement **Dirty-Frame Checking**:
  ```typescript
  let lastRenderedFrame: number | null = null;
  let lastRenderedLOD: number | null = null;
  let lastPopOutIntensity: number | null = null;

  function renderCurrentFrame(frame: number, lod = 1.0, popOutIntensity = 1.0) {
    if (!canvas || !ctx || !engine) return;
    if (frame === lastRenderedFrame && lod === lastRenderedLOD && popOutIntensity === lastPopOutIntensity) {
      return; // Skip redraw entirely!
    }
    // ... draw ...
    lastRenderedFrame = frame;
    lastRenderedLOD = lod;
    lastPopOutIntensity = popOutIntensity;
  }
  ```
- Eliminates 50% wasted draws on 120Hz/144Hz monitors and redundant draws during paused/parked states.

#### [MODIFY] `apps/studio/src/components/Preview.tsx`
- Connect `LookaheadClipScheduler` in `Preview.tsx` or `StudioPlayheadController`.
- Avoid calling `createImageBitmap` on unchanged static frames; only send updated bitmap handles when textures change.

---

## Verification Plan

### Automated Tests
1. **Lookahead Ring Buffer Unit Tests**:
   - `autogenerated-tests/mediabunny_ring_buffer.test.ts`:
     - Verifies ring buffer allocation, filling ahead of playhead, and capacity bounds (6–10 frames).
     - Verifies `.close()` eviction hygiene for bitmaps.
2. **Lookahead Scheduler Unit Tests**:
   - `autogenerated-tests/lookahead_clip_scheduler.test.ts`:
     - Verifies upcoming clips within 1.5s window are detected and triggered for pre-warming.
     - Verifies already warmed clips are not re-triggered.
3. **Dirty-Frame Skipping Test**:
   - `autogenerated-tests/preview_dirty_frame_skipping.test.ts`:
     - Verifies identical consecutive frame requests skip canvas rasterization.
4. **Regression Testing**:
   - `bun test autogenerated-tests/timeline_worker_and_virtualization.test.ts`
   - `bun test autogenerated-tests/studio_timeline_patch.test.ts`

### Manual Verification
- Scrub and play demo projects (`defaultDemoIR`, `complexSciFiDemoIR`) in Studio:
  - Verify smooth 60fps playback without `<video>` seek stalls.
  - Verify seamless clip transitions at frame 90 without black flashes.
  - Verify low CPU/GPU usage when paused or scrubbing on high-refresh monitors.
