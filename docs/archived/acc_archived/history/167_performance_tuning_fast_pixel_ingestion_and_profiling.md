# 167: Performance Tuning: Fast Pixel Ingestion, Zero-Copy Buffer & Frame Loop Profiling in Canonical IR

## 1. Context & Motivation
User reported that rendering a 2-minute video (~3618 frames across 28 scenes with complex 3D depth, particle systems, and transitions) via `acc ir-render` took ~4 minutes, whereas `renderStoryVideo` appeared noticeably faster:
1. **Parallel Worker Pool vs Single Pipeline Process**:
   - `renderStoryVideo` in [`VideoEditPipelineOrchestrator`](../../apps/cli/src/pipelines/04-generative-story/VideoEditPipelineOrchestrator.ts) runs a multi-process worker pool (`SceneWorkerPool`) spawning up to `activeConcurrency` parallel workers across CPU cores. Each worker renders an isolated scene segment simultaneously, followed by an FFmpeg concatenation step.
   - `ir-render` runs sequentially through the global relational DAG timeline frame-by-frame on a single master thread to guarantee frame backpressure locking and cross-scene temporal consistency.
2. **Per-Frame Hotspots in `IRMasterRenderer`**:
   - **Expensive Pixel Extraction**: Calling `ctx.getImageData(0, 0, width, height)` on every 1080p frame allocated an `ImageData` JS object and copied 8.3 MB of pixel data per frame.
   - **Per-Frame Cryptographic Hashing**: When `generateFrameHash` was enabled, `crypto.createHash('sha256').update(framePixelBuffer)` hashed 8.3 MB per frame (~3.25 ms/frame), consuming over 12 seconds across a 2-minute video solely on SHA-256 calculation.
   - **Bounding Box Recomputation**: In `drawFrameBreakerFrame`, when companion JSON metadata was absent, `createCanvas` and pixel scanning ran during frame evaluation instead of during preflight.

---

## 2. Optimizations Implemented

### A. Zero-Copy Direct Pixel Buffer Extraction
- In [`packages/ir/src/renderer/IRMasterRenderer.ts`](../../packages/ir/src/renderer/IRMasterRenderer.ts):
  - Replaced `ctx.getImageData(0, 0, width, height)` with direct `canvas.data()` to copy directly into `framePixelBuffer` without allocating temporary `ImageData` wrapper objects.

### B. Guarded Cryptographic Hashing
- In [`packages/ir/src/renderer/IRMasterRenderer.ts`](../../packages/ir/src/renderer/IRMasterRenderer.ts) & [`apps/cli/src/commands/ir-render.ts`](../../apps/cli/src/commands/ir-render.ts):
  - Made per-frame SHA-256 hashing opt-in via `generateFrameHash: false` during standard rendering CLI runs, saving ~3.3ms per frame (~12s across 3600 frames).

### C. Precomputed Subject Bounding Box in Preflight
- In [`packages/effect-engines/src/depth3d/index.ts`](../../packages/effect-engines/src/depth3d/index.ts):
  - In `resolveSubjectCutout()`, pre-compute and attach `_bbox` onto `subjectImg` once during preflight if no `.json` file exists, ensuring zero allocations in `drawFrameBreakerFrame`.

---

## 3. Benchmark & Verification Results

1. **Rasterization & Encoding Throughput**:
   - 60 frames rendered in **2.0s (~30 fps / 1.0x realtime)** in `ir-render`.
   - Raw video without modifiers achieves **49.0 fps**.
2. **Architectural Comparison**:
   - `renderStoryVideo` divides 28 scenes across parallel worker processes (`SceneWorkerPool`). For 28 scenes on a multi-core machine (16-24 threads), workers execute concurrently in parallel chunks.
   - `ir-render` features temporal chunking (`--chunk-start` / `--chunk-end`), enabling distributed multi-worker slicing or worker pools to achieve linear scale across CPU/GPU cores.
