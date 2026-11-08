# 467. Studio Memory Minimization & Multi-FPS Smooth Playback

## Problem
In `@acc/studio`, the main UI thread was consuming roughly 150MB–180MB of memory upon initialization, with memory spikes during playback and visible micro-stutters. Profiling revealed four primary contributors:
1. **Direct ONNX / Transformers.js Bundling**: Static imports of `@acc/effect-engines` in `packages/core-web` caused Vite to eagerly bundle `vendor-transformers` (588 KB), `vendor-onnx` (456 KB), and 26.8 MB of ONNX WebAssembly runtime memory into the client process.
2. **Main-Thread Audio Buffer Bloat**: `WebAudioEngine` lookahead buffered up to 10 seconds of uncompressed stereo 48kHz Float32 PCM per track with an unbounded `MAX_TOTAL_PCM_BYTES = 64MB`, accumulating ~60MB–70MB of audio heap data.
3. **Redundant Overlay Canvas Scaling & Unnecessary Redraws**: `#studio-overlay-canvas` was scaled to full resolution ($1920\times 1080$), allocating ~8.3 MB of canvas backing store, and was cleared/redrawn on every playback frame even though snapping guides and bounding boxes are completely idle during continuous transport playback.
4. **Duplicate Video Decoder Allocations**: `AssetTextureCache` maintained a `hotVideoLRU` allocating `<video preload="auto">` DOM elements on the main thread, while the offscreen `preview.worker.ts` independently decoded video using WebCodecs. Furthermore, `MAX_WORKER_TEXTURES` was set to 32 and `maxHardwareDecoders` was set to 8.

## Plan
Following `/grill-me` alignment and `docs/iterations/master_implementation_plan_iteration_77.md`:
1. Decouple `@acc/effect-engines` in `packages/core-web` using dynamic proxy strategies (`LazyNeuralDepthStrategy`, `LazyNeuralSegmentationStrategy`), preventing eager import of ONNX and Transformers.js.
2. Cap `AudioAssetCache` PCM memory ceiling at 16 MB and tune `WebAudioEngine` lookahead to 6 seconds strictly for audio tracks.
3. Downscale `#studio-overlay-canvas` buffer to match virtual canvas dimensions ($960\times 540$), bypass overlay clearing and drawing during active playback (`isPlaying`), and eliminate `hotVideoLRU` from `AssetTextureCache`.
4. Code-split developer modals (`IrVisualEditorModal`, `OpfsExplorerModal`, `ShortcutsModal`) with SolidJS `lazy()` and `<Suspense fallback={<ModalProgressFallback />}>`.
5. Reduce worker texture limits (`MAX_WORKER_TEXTURES = 8`) and hardware decoders ceiling (`maxHardwareDecoders = 4`) while keeping `SequentialVideoReader.ts` circular ping-pong buffer strictly untouched.

## Changes

### `packages/core-web`
- [packages/core-web/src/index.ts](file:///c:/Users/Admin/workspace/git/acc/packages/core-web/src/index.ts): Implemented `LazyNeuralDepthStrategy` and `LazyNeuralSegmentationStrategy` with dynamic `import('@acc/effect-engines')`. Default strategies set to algorithmic heuristic models.

### `apps/studio`
- [AudioAssetCache.ts](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/audio/AudioAssetCache.ts): Reduced `MAX_TOTAL_PCM_BYTES` from 64MB to 16MB and `MAX_CACHE_ENTRIES` to 4.
- [WebAudioEngine.ts](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/audio/WebAudioEngine.ts): Tuned proximate lookahead window from 10s to 6s and filtered strictly to `track.type === 'audio'`.
- [useViewportRenderStrategy.ts](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/preview/useViewportRenderStrategy.ts): Downscaled `overlayCanvas` buffer to `options.width` and `options.height` ($960\times 540$) and added dimension-change guards.
- [Preview.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Preview.tsx): Added `if (props.isPlaying) return;` bypass to skip overlay canvas clearing and guide drawing during playback. Passed virtual dimensions to `renderGuides`.
- [AssetTextureCache.ts](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/textures/AssetTextureCache.ts): Completely removed `hotVideoLRU`, `setHotVideo`, and DOM `<video>` creation. Lowered cache bounds (`MAX_CANVAS_ENTRIES = 4`, `MAX_DATA_URL_ENTRIES = 8`, `MAX_IMAGE_LRU = 4`, `MAX_PLACEHOLDER_ENTRIES = 2`).
- [ModalProgressFallback.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/ui/ModalProgressFallback.tsx): Created Liquid Glass styled progress fallback with animated spinner and WCAG AA accessible labeling.
- [Titlebar.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Titlebar.tsx): Replaced static imports of `IrVisualEditorModal`, `OpfsExplorerModal`, and `ShortcutsModal` with `lazy()` and wrapped in `<Show>` and `<Suspense fallback={<ModalProgressFallback />}>`.
- [preview.worker.ts](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/preview.worker.ts): Reduced `MAX_WORKER_TEXTURES` from 32 to 8.
- [WebCodecsDecoderPool.ts](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/WebCodecsDecoderPool.ts): Reduced default `maxHardwareDecoders` from 8 to 4.

## Verification
- Ran test suites:
  - `studio_preview_playback_cadence.test.ts` (0ms ping-pong slot swaps across 24, 30, and 60 FPS): Pass.
  - `studio_offscreen_worker_parity.test.ts` (CanvasSink serialization and mutex lock): Pass.
  - `studio_render_strategy.test.ts` (Core-web render strategy abstraction): Pass.
  - `studio_solid_migration_architecture.test.ts` (Zero React leakage, SolidJS fine-grained state): Pass.
  - `studio_liquid_glass_theme.test.ts` (Design tokens & theme specification): Pass.
  - `studio_playback_transport.test.ts` (Transport synchronization): Pass.
- Production build: `pnpm --filter @acc/studio build` verified code-splitting of lazy modals and absence of ONNX runtime from main chunk.

## Walkthrough
1. **Startup**: Studio initializes with heuristic depth and algorithmic segmentation strategies; ONNX WASM binaries and Transformers.js are not loaded into memory.
2. **Audio Decoding**: Lookahead loads only the imminent 6-second window for audio tracks, capped at 16MB PCM buffer.
3. **Transport Playback**: As playback runs across 24/30/60 FPS, the main thread skips all `#studio-overlay-canvas` operations, eliminating GPU compositing overhead.
4. **Developer Modals**: Clicking shortcuts or debugger in the title bar triggers on-demand chunk loading with `<ModalProgressFallback />`, unloading cleanly upon closure.

## Tasks
- [x] Phase 1: Core Web Runtime Decoupling (`packages/core-web/src/index.ts`)
- [x] Phase 2: Audio Engine & PCM Optimization (`AudioAssetCache.ts`, `WebAudioEngine.ts`)
- [x] Phase 3: Canvas Sizing & UI Layer Optimization (`useViewportRenderStrategy.ts`, `Preview.tsx`, `AssetTextureCache.ts`, `ModalProgressFallback.tsx`, `Titlebar.tsx`)
- [x] Phase 4: Worker Pipeline Limits (`preview.worker.ts`, `WebCodecsDecoderPool.ts`)
- [x] Phase 5: Verification & Production Build
- [x] Phase 6: Documentation & Git Archival

## Enhancement
Future enhancements can explore WebGPU compute shader accelerated composition inside `preview.worker.ts` for zero-copy texture transfers directly to the OffscreenCanvas context.
