# 359. Eliminate IR Plugin In-Memory Caches & Standardize Blob-First ContentCacheRegistry

## Problem
In `packages/ir/src/plugins`, numerous modifier plugins maintained local, instance-level in-memory caches using `Map` and `WeakMap` collections (`Depth3DPlugin` had 8 separate `Map` properties caching cutouts, depth layers, background canvases, particles, dust particles, base canvases, normal maps, and relight canvases; `Camera3DPlugin` cached trajectories and focal zones in `Map`; `AutoReframeModifierPlugin` cached strategy instances; `CanvasParticleOverlayPlugin` cached scratch canvases in `Map`; `CaptionModifierPlugin` held a `WeakMap` cache; `TimeSpaceModifierPlugin` held a `machineCache` `Map`). These caches created significant heap bloat, memory leaks during long-running preview sessions, and state contamination across worker boundaries.

Concurrently, `IContentCacheStrategy` and `ContentCacheRegistry` had splintered method signatures (`get`, `getBytes`, `getBlob`, `getStream`, `set`, `setBlob`, `setStream`), with `Uint8Array` as the primary type rather than the modern Web standard `Blob` and Streams (`ReadableStream` / `WritableStream`), causing unnecessary heap copies and memory churn.

## Plan
1. **Blob-First Cache Contract**: Standardize `IContentCacheStrategy` across `@acc/core-isomorphic`, `@acc/core-web`, and `@acc/core` to expose pure Web-standard methods:
   - `get(key: string): Promise<Blob | null>`
   - `set(key: string, data: CachePayload, metadata?): Promise<void>`
   - `createWritableStream?(key: string, metadata?): Promise<WritableStream<Uint8Array>>`
   - Completely eliminate redundant auxiliary methods: `getBytes`, `getBlob`, `setBlob`, `getStream`, `setStream`.
2. **Strategy Implementations**: Update `NativeFileCacheStrategy`, `OpfsCacheStrategy`, `IndexedDbCacheStrategy`, and `WebCacheStrategy` to implement the standardized `Blob`-first interface with zero-copy stream ingestion.
3. **Eliminate All In-Memory Caches in IR Plugins**:
   - `Depth3DPlugin`: Remove all 8 `Map` cache properties (`cutoutCache`, `depthLayerCache`, `bgCanvasCache`, etc.). Load assets via `ContentCacheRegistry` and `CanvasAssetLoader`, borrow/release scratch canvases via `UniversalCanvasProvider`, and calculate particle physics statelessly.
   - `Camera3DPlugin`: Remove `trajectoryCache` and `focalZoneCache`. Persist and retrieve trajectory `Float32Array` via `ContentCacheRegistry` as a binary `Blob`.
   - `AutoReframeModifierPlugin`: Remove `strategyCache`. Instantiate strategies statelessly.
   - `CanvasParticleOverlayPlugin`: Remove `scratchCanvasCache`. Borrow bloom scratch canvas from `UniversalCanvasProvider`.
   - `CaptionModifierPlugin`: Remove `captionConfigCache = new WeakMap()`. Bind precalculated configs directly to the sequence object.
   - `TimeSpaceModifierPlugin`: Remove `machineCache`. Bind time-space machines to the target sequence context.
4. **Asynchronous Clip-Space Rendering**: Ensure `IRCanvasCompositor.renderFrame` and `renderTrackSequences` await modifier plugins (`renderClipSpace`), enabling asynchronous cache reads without blocking render loops.
5. **Consumer Adaptation**: Update consumers in `apps/studio` (`LeftSidebar`, `AudioAssetCache`, `AssetTextureCache`, `MediabunnyWorkerReader`, `preview.worker.ts`, `IRPreviewEngine`), `packages/effect-engines`, and `packages/ir/src/renderer/IRMasterRenderer.ts` to use standardized `cache.get()` and `cache.set()`.
6. **Verification**: Write comprehensive automated unit and integration tests validating zero in-memory caches on plugin instances, blob-first storage, and streaming ingestion.

## Changes

### 1. `packages/core-isomorphic`
- **`cache/types.ts`**: Standardized `IContentCacheStrategy` to `get(key): Promise<Blob | null>`, `set(key, data)`, and `createWritableStream(key)`. Removed `getBlob`, `setBlob`, `getBytes`, `getStream`, `setStream`.
- **`cache/streamUtils.ts`**: Added `payloadToBlob(payload, mimeType?)` and `payloadToStream(payload)` helpers.
- **`vision/OnnxModelManager.ts`**: Refactored to store and retrieve ONNX model binaries via `Blob`.

### 2. Cache Strategies (`@acc/core`, `@acc/core-web`)
- **`NativeFileCacheStrategy.ts`**: Implemented `get()` returning `Blob` from local file stream/buffer, `set()` handling `Blob`/`ReadableStream`, and `createWritableStream()` for zero-copy file writing.
- **`OpfsCacheStrategy.ts`**: Implemented `get()` returning OPFS file `Blob`, `set()` writing via `createWritable()`, and `createWritableStream()`.
- **`IndexedDbCacheStrategy.ts`**: Implemented `get()` reading `Blob` from IndexedDB object store, `set()` writing `Blob`, and `createWritableStream()`.
- **`WebCacheStrategy.ts`**: Implemented `get()` reading `Response.blob()` from Cache API, `set()` writing `Response` with `Blob`, and `createWritableStream()`.

### 3. IR Plugins (`packages/ir/src/plugins`)
- **`vfx/Depth3DPlugin.ts`**: Completely removed all 8 `Map` cache properties. Renders depth maps and surface normals statelessly via `ContentCacheRegistry` and `CanvasAssetLoader`.
- **`vfx/Camera3DPlugin.ts`**: Removed `trajectoryCache` and `focalZoneCache` Map properties. Precomputes and caches camera trajectories into `ContentCacheRegistry` as binary `Blob`s. Preserves dynamic rack focus pre-generation and bokeh crossfading by storing near/far focal zone layers as `Blob`s in `ContentCacheRegistry` and caching on sequence context.
- **`vfx/AutoReframeModifierPlugin.ts`**: Removed `strategyCache`.
- **`overlay/CanvasParticleOverlayPlugin.ts`**: Removed `scratchCanvasCache`.
- **`text/CaptionModifierPlugin.ts`**: Removed `captionConfigCache` `WeakMap`.
- **`TimeSpaceModifierPlugin.ts`**: Removed `machineCache` `Map`.

### 4. Compositor & Consumers
- **`IRCanvasCompositor.ts`**: Made `renderFrame` and `renderTrackSequences` `async`, awaiting `plugin.renderClipSpace`.
- **`IRMasterRenderer.ts`**: Replaced raw WAV byte array caching with `Blob`.
- **`apps/studio/`**: Updated `LeftSidebar.tsx`, `AudioAssetCache.ts`, `AssetTextureCache.ts`, `MediabunnyWorkerReader.ts`, `preview.worker.ts`, and `IRPreviewEngine.ts` to use standardized `cache.get()` and `cache.set()`.
- **`packages/core/src/index.ts` & `editing/index.ts` & `native/index.ts`**: Cleaned up stale exports referencing deleted modules.

## Verification
Executed 7 test suites containing 34 automated unit and integration tests with Bun test runner:
- `autogenerated-tests/ir_plugin_cache_elimination_and_blob_registry.test.ts`: Passed 10/10 tests validating zero in-memory `Map`/`WeakMap` data caches across all plugins, `Blob`-first storage, streaming ingestion, and absence of deprecated methods.
- `autogenerated-tests/camera_spline_rack_focus.test.ts`: Passed 3/3 tests.
- `autogenerated-tests/auto_reframe_modifier_plugin.test.ts`: Passed 3/3 tests.
- `autogenerated-tests/particle_random_access_stateless.test.ts`: Passed 2/2 tests.
- `autogenerated-tests/depth_relighting.test.ts`: Passed 5/5 tests.
- `autogenerated-tests/core_isomorphic_universal_services.test.ts`: Passed 5/5 tests.
- `autogenerated-tests/web_cache_strategy.test.ts`: Passed 6/6 tests.
**Result**: 34 pass, 0 fail (355ms).

## Walkthrough
1. **Zero In-Memory Retention**: Plugins now hold no instance data caches; repeated calls to `renderClipSpace` rely purely on stateless calculations and `ContentCacheRegistry` backed by OPFS, IndexedDB, or filesystem.
2. **First-Class Blob**: All cache transactions use Web standard `Blob` objects, allowing direct zero-copy interop with `createObjectURL`, `fetch()`, `Response`, and worker message passing.
3. **Streaming Support**: Direct write access through `createWritableStream()` enables chunked ingestion of huge assets without holding complete payloads in RAM.

## Tasks
- [x] Standardize `IContentCacheStrategy` on `get(key): Promise<Blob | null>` and `set(key, data)`
- [x] Refactor all cache strategies (`NativeFileCacheStrategy`, `OpfsCacheStrategy`, `IndexedDbCacheStrategy`, `WebCacheStrategy`)
- [x] Eliminate in-memory caches across all IR plugins (`Depth3DPlugin`, `Camera3DPlugin`, `AutoReframeModifierPlugin`, `CanvasParticleOverlayPlugin`, `CaptionModifierPlugin`, `TimeSpaceModifierPlugin`)
- [x] Make `IRCanvasCompositor.renderFrame` asynchronous
- [x] Refactor consumers in `apps/studio` and `@acc/effect-engines`
- [x] Clean up stale core package re-exports
- [x] Create and verify comprehensive test suite
- [x] Archive in documentation history and commit

## Enhancement
Future iterations can leverage native transferable `ReadableStream` piping between web worker rendering threads and OPFS strategies for multi-gigabyte video clip proxy caching.
