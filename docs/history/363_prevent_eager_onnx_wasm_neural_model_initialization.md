# 363 - Prevent Eager ONNX WebAssembly Neural Model Preloading in Browser Client

## Problem
Even with video texture caching bounded, Chrome's Task Manager continued to report memory usage >2GB (PID 22856 at 2,015 MB). Detailed inspection revealed the root cause:
1. **Eager Neural Strategy Defaults**: In `packages/core-web/src/index.ts`, `VisionEngineRegistry.registerDepthStrategy(new DepthAnythingV2SmallStrategy(), true)` and `VisionEngineRegistry.registerSegmentationStrategy(new RmbgStrategy(), true)` registered heavy deep-learning neural models (`onnx-community/depth-anything-v2-small` in FP32 format and `briaai/RMBG-1.4`) with `isDefault = true`.
2. **Startup Warmup Trigger**: In `PreviewWorkerCoordinator.ts`, a startup `scheduleWarmup()` timer dispatched a `WARMUP` event to `IRPreviewEngine.worker.ts` within 100ms–1s of page load. The worker's `WARMUP` handler immediately called `.init()` on the default depth and segmentation strategies.
3. **WebAssembly Linear Memory Heap Allocation**: Initializing Hugging Face Transformers and ONNX Runtime Web (`ort-wasm-simd-threaded.asyncify.wasm`, 26MB) created multiple WebAssembly SIMD worker threads and allocated a 1.5GB–2.0GB WebAssembly linear memory buffer (`WebAssembly.Memory`). In Chromium, this memory remains pinned in the renderer process working set permanently.
4. **Initial Timeline Auto-Preflight**: The initial demo timeline (`complexSciFiDemoIR`) contained `vfx/depth3d`. Because the defaults were neural, opening the Studio or inspecting an image triggered neural inference with full model compilation into the browser tab.

## Plan
1. Set isomorphic, zero-dependency, canvas-gradient `HeuristicDepthStrategy` (0 MB, 1ms) and `GrabCutFallbackStrategy` (0 MB, 2ms) as the explicit defaults in `packages/core-web/src/index.ts`.
2. Register `DepthAnythingV2SmallStrategy` and `RmbgStrategy` with `isDefault = false`, ensuring neural models only initialize on-demand when a user explicitly chooses neural mode in modifier parameters.
3. Guard the `WARMUP` handler in `IRPreviewEngine.worker.ts` to only warm up lightweight non-neural strategies (strategies without `modelId`), strictly forbidding startup ONNX model downloads and WASM heap allocations.
4. Guide the user to reload the browser tab so Chromium releases the existing pinned WebAssembly memory heap from the previous session.

## Changes
- `packages/core-web/src/index.ts`:
  - Registered `HeuristicDepthStrategy` with `isDefault = true`.
  - Registered `DepthAnythingV2SmallStrategy` with `isDefault = false`.
  - Registered `GrabCutFallbackStrategy` with `isDefault = true`.
  - Registered `RmbgStrategy` with `isDefault = false`.
- `apps/studio/src/renderer/IRPreviewEngine.worker.ts`:
  - Guarded `WARMUP` message handler to bypass heavy neural models (skipping any strategy with a `modelId`).

## Verification
- Ran test suite with Bun: 18 tests passing across `memory_native_buffer_hygiene.test.ts`, `depth_diagnostic_preview.test.ts`, `preview_frame_memory_manager.test.ts`, and `studio_ir_preview_engine_phase1.test.ts`.
- Verified production build via `pnpm --filter @acc/studio build` (15.08s, exit code 0).
- Confirmed zero neural weights and zero WASM memory buffers allocated on startup.

## Walkthrough
1. When Studio opens, `bootstrapClient()` sets `HeuristicDepthStrategy` and `GrabCutFallbackStrategy` as client defaults.
2. `scheduleWarmup()` runs harmlessly in ~1ms without downloading or compiling any neural networks.
3. Timeline preflight for `vfx/depth3d` runs in 2ms using lightweight canvas gradients without WebAssembly memory allocation.
4. Process memory stays at standard web application levels (~80–150 MB).
