# Master Implementation Plan (Iteration 18): Refactor Canvas Video Preview Engine for Remotion-Level 60fps Playback

## 1. Goal Description
Refactor the Studio canvas video preview engine to deliver Remotion-grade 60fps playback smoothness and responsive scrub dynamics.
This plan incorporates the architectural decisions established during technical review:
1. **Decoder Placement**: Pure Web Worker thread execution (`preview.worker.ts`) using `mediabunny` + `WebCodecs` to eliminate main-thread `<video>` seek thrashing and cross-thread `ImageBitmap` postMessage bottlenecks.
2. **Scrub vs. Playback Strategy**: Hybrid fast scrub (throttled to 30fps max, nearest keyframe instant blit + 50ms idle exact-frame refinement) combined with a forward lookahead ring buffer (6–10 frames) for sequential 1x/2x playback.
3. **Memory & Leak Optimization Constraints**: Dynamic LRU `ImageBitmap` buffer per clip capped at a strict global budget of 64 frames (~150–250MB RAM), with explicit window culling `[playhead - 2s, playhead + 3s]` and mandatory `.close()` invocation on evicted `ImageBitmap`s to eliminate browser GPU leaks.
4. **Lookahead Clip Pre-Warming**: Background pre-warming scheduler scanning 1.5s ahead to pre-fetch, demux, and decode the first frame of upcoming timeline clips, eliminating cut/transition stutter.
5. **Dirty-Frame & Content-Hash Texture Caching**: Skip redundant canvas redraws when `frame === lastRenderedFrame` (critical for 120Hz/144Hz monitors). Rasterize static text and SVG vector overlays into OffscreenCanvas bitmaps using FNV-1a content-hash keys, applying keyframe transformations and opacity dynamically onto cached bitmaps during the frame loop.

---

## 2. Hard Memory & Performance Constraints

> [!IMPORTANT]
> **Strict Memory Hygiene Rules (Zero GPU Leak Mandate)**:
> 1. **Explicit `.close()` Disposal**: Every `ImageBitmap` or `VideoFrame` evicted from any cache or ring buffer MUST call `.close()` synchronously. Relying on garbage collection causes browser GPU process crashes.
> 2. **Global Frame Budget Ceiling**: Total pre-decoded cached frames across all active tracks and clips MUST NOT exceed 64 frames (~150MB @ 1080p RGBA).
> 3. **Window-Bounded Eviction**: All decoded frames falling outside `[playhead - 2s, playhead + 3s]` are evicted immediately on playhead advancement.
> 4. **Zero-Alloc Hot Loop**: Coordinate buffers, scratch arrays, and transform math during 60fps frame rendering must reuse pre-allocated typed arrays (Float32Array) with zero heap cloning.

---

## 3. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Main Thread (apps/studio)                            │
│  - StudioPlayheadController (High-frequency playhead ticks & scrubs)   │
│  - Timeline & Preview UI (Passes timeline IR & asset URLs to worker)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ transferControlToOffscreen() + postMessage
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Dedicated Worker (preview.worker.ts)                     │
│                                                                        │
│  ┌─────────────────────────────┐     ┌──────────────────────────────┐  │
│  │   MediabunnyVideoReader     │     │   LookaheadClipScheduler     │  │
│  │   - mediabunny.Input        │     │   - Scans [playhead, +1.5s]  │  │
│  │   - WebCodecs VideoDecoder  │     │   - Pre-warms upcoming clips │  │
│  │   - Ring Buffer (6-10 fwd)  │     │   - Pre-decodes hero frame   │  │
│  └──────────────┬──────────────┘     └──────────────┬───────────────┘  │
│                 │                                   │                  │
│                 ▼                                   ▼                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │         Global LRU Bitmap Cache (Max 64 frames, .close())         │  │
│  │         - Active Playback Ring: [playhead, playhead + 10]        │  │
│  │         - Pre-warmed Hero Frames: upcoming clips                 │  │
│  │         - Window Culling: Evicts outside [playhead - 2s, +3s]    │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────┐   │   ┌───────────────────────────┐  │
│  │  Content-Hash Text/SVG Cache │   │   │   Dirty-Frame Checker     │  │
│  │  - FNV-1a hash key           │   │   │   - frame === lastFrame?  │  │
│  │  - Rasterize once to bitmap  │   │   │   - Skip redraw on 120Hz  │  │
│  └──────────────┬───────────────┘   │   └─────────────┬─────────────┘  │
│                 │                   │                 │                │
│                 ▼                   ▼                 ▼                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │             IRPreviewEngine / IRCanvasCompositor                 │  │
│  │             - Blit cached bitmaps with transform & opacity       │  │
│  │             - Zero main-thread blocking                          │  │
│  │             - 60fps stable output on OffscreenCanvas             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Step-by-Step Implementation Details

### Step 1: Worker-Side Video Reader & Bounded Lookahead Ring Buffer
**Target File**: `apps/studio/src/workers/MediabunnyWorkerReader.ts` [NEW]
- Uses `mediabunny.Input` with `mediabunny.UrlSource` and `mediabunny.CanvasSink` / `VideoSampleSink`.
- Maintains a local ring buffer of 6–10 pre-decoded `ImageBitmap`s ahead of current playback frame.
- Implements hybrid scrubbing:
  - **Fast Scrub Mode** (throttled to 30fps max): Seeks directly to the nearest keyframe for instantaneous visual feedback.
  - **Idle Refinement**: When playhead rests for > 50ms, decodes and blits the exact target frame.
  - **Sequential Playback (1x/2x)**: Streams sequential frames into the ring buffer continuously ahead of the render tick.
- Exposes `getFrame(frame: number): ImageBitmap | null`.

### Step 2: Global LRU Frame Eviction Manager
**Target File**: `apps/studio/src/workers/PreviewFrameMemoryManager.ts` [NEW]
- Manages all decoded `ImageBitmap` instances across all active video readers in the worker.
- Enforces strict constraints:
  - Global budget: `MAX_GLOBAL_FRAMES = 64`.
  - Window eviction: Any frame where `frame < playhead - 2 * fps` or `frame > playhead + 3 * fps` is immediately evicted.
  - Mandatory disposal: Calls `bitmap.close()` synchronously upon eviction to prevent browser GPU leaks.

### Step 3: Lookahead Clip Pre-Warming Scheduler
**Target File**: `apps/studio/src/workers/WorkerClipPrewarmer.ts` [NEW]
- Runs in the Web Worker alongside the frame loop.
- Given `currentFrame` and `fps`:
  - Queries timeline `IntervalTreeIndex` for clips starting in the range `[currentFrame, currentFrame + Math.round(1.5 * fps)]`.
  - For each upcoming clip:
    - If not already initialized, instantiates `MediabunnyWorkerReader`.
    - Asynchronously requests decode of frame 0 of that sequence.
    - Stores pre-warmed hero frame in the `PreviewFrameMemoryManager`.
- When the playhead crosses the cut boundary, the first frame is already hot in cache: **zero black frame, zero hesitation**.

### Step 4: Content-Hash Static Text & Vector Overlay Texture Cache
**Target File**: `apps/studio/src/workers/ContentHashTextureCache.ts` [NEW]
- Computes 32-bit FNV-1a hash over `(text + font + fontSize + color + stroke + strokeWidth + width + height)`.
- If hash not in cache:
  - Draws text/shape once onto an isolated offscreen scratch canvas acquired from `CanvasScratchPool`.
  - Converts to `ImageBitmap` and stores in `Map<number, ImageBitmap>`.
- In `IRCanvasCompositor`:
  - Instead of calling costly vector/text layout routines per frame, retrieves the cached `ImageBitmap`.
  - Applies keyframe matrix transform (`scale`, `rotation`, `translate`) and `globalAlpha` in the hot render loop.
  - Cleans up and `.close()`s bitmaps when sequence is deleted or updated.

### Step 5: Worker Render Loop Modernization & Dirty-Frame Skipping
**Target File**: `apps/studio/src/workers/preview.worker.ts` [MODIFY]
- Implement dirty-frame skipping:
  ```typescript
  if (frame === lastRenderedFrame && lod === lastRenderedLOD && popOutIntensity === lastPopOutIntensity && !texturesDirty) {
    return; // Skip entire render pass on 120Hz/144Hz monitors or parked playhead
  }
  ```
- Wire `MediabunnyWorkerReader`, `WorkerClipPrewarmer`, and `ContentHashTextureCache` directly into the worker's `engine.renderFrame(...)` pipeline.
- Synchronize playhead state and scrub events with 30fps throttle during fast dragging.

### Step 6: Main Thread Decoupling & Cleanup
**Target File**: `apps/studio/src/components/Preview.tsx` & `apps/studio/src/lib/worker/PreviewWorkerBridge.ts` [MODIFY]
- Remove per-frame synchronous `createImageBitmap` and `Promise.all` in `Preview.tsx`.
- Simply pass asset metadata / URLs to the worker on project load or asset update; let the worker handle all decoding and texture streaming internally.
- Update `StudioPlayheadController` high-frequency subscriber to pass scrub rate metadata.

---

## 5. Verification Plan

### Automated Test Suites (`bun:test` in `/autogenerated-tests/`)
1. **`autogenerated-tests/mediabunny_worker_reader.test.ts`**:
   - Tests lookahead ring buffer filling ahead of playhead (6–10 frames).
   - Tests fast scrub nearest-keyframe vs idle refinement logic.
   - Tests `.close()` call on every evicted frame.
2. **`autogenerated-tests/preview_frame_memory_manager.test.ts`**:
   - Tests global 64-frame ceiling enforcement.
   - Tests window-bounded eviction `[playhead - 2s, playhead + 3s]`.
   - Tests zero memory leak verification (mock bitmap close tracking).
3. **`autogenerated-tests/content_hash_texture_cache.test.ts`**:
   - Tests FNV-1a content hashing of text and styles.
   - Tests cache hits and single-rasterization invariant.
4. **`autogenerated-tests/preview_dirty_frame_skipping.test.ts`**:
   - Tests consecutive identical frame ticks skip canvas draw calls.
5. **Full Regression Suites**:
   - `bun test autogenerated-tests/timeline_worker_and_virtualization.test.ts`
   - `bun test autogenerated-tests/studio_timeline_patch.test.ts`

### Manual Verification in Studio
- Load `complexSciFiDemoIR` in Studio:
  - Verify smooth, sustained 60fps playback without `<video>` seek stutter.
  - Verify rapid J-K-L shuttle scrubbing without playback stalls.
  - Verify seamless clip transitions at frame 90 (no black placeholder flashes).
  - Inspect Chrome DevTools Memory / Performance tab: verify steady heap allocation and zero GPU `ImageBitmap` memory leakage over 5+ minutes of continuous playback.
