# Master Implementation Plan - Iteration 41: Unified Isomorphic Resource & Asset Management with Zero-Copy Blob & Streaming Pipeline

## 1. Executive Summary & Context

Cross-platform media authoring and editing across Web, Web Worker, Node.js, and Bun processes requires unified, zero-copy resource caching. Prior to this iteration, `@apps/studio` exhibited critical memory regressions:
1. **Initial Load Spikes (~1GB RAM)**: Caused by `WebAudioEngine.syncFromIR()` eagerly preloading and decoding every audio preset in the project into full-length, uncompressed 32-bit floating point PCM arrays (`Float32Array[]`) retained indefinitely in `AudioAssetCache`.
2. **Timeline Playback Memory Runaway (>2.5GB VRAM/RAM)**: In `WorkerRenderStrategy.syncTextures()`, an 8.3MB `ImageBitmap` (1920x1080 32-bit RGBA) was transferred on every single frame tick at 60Hz. The receiving worker (`preview.worker.ts`) overwrote textures in its `textureCache` without invoking `ImageBitmap.close()`, causing rapid leaks of ~250MB to ~500MB per second during preview.
3. **In-Memory Heap Thrashing**: Ingestion and caching pipelines loaded whole files as contiguous `Uint8Array` arrays rather than utilizing platform-native zero-copy `Blob` handles and WHATWG `ReadableStream<Uint8Array>` interfaces.

Iteration 41 unifies the monorepo's resource and cache architecture around `ContentCacheRegistry` and its strategy implementations, establishing first-class `Blob` and streaming contracts across all runtimes.

---

## 2. Target Architecture & Strategy Hierarchy

```mermaid
graph TD
    subgraph Client_Applications["Client Apps & Workers"]
        StudioUI["@acc/studio (UI / LeftSidebar / Timeline)"]
        PreviewWorker["preview.worker.ts (OffscreenCanvas Compositor)"]
        BackendEngine["@acc/backend & CLI Pipelines"]
    end

    subgraph Isomorphic_Cache_Subsystem["@acc/core-isomorphic (packages/core-isomorphic/src/cache/)"]
        Registry["ContentCacheRegistry (Singleton & Strategy Factory)"]
        Interface["<<interface>>\nIContentCacheStrategy\n+ get(key): Promise<Uint8Array | null>\n+ set(key, data, meta): Promise<void>\n+ getBlob(key): Promise<Blob | null>\n+ setBlob(key, blob, meta): Promise<void>\n+ getStream(key): Promise<ReadableStream<Uint8Array> | null>\n+ setStream(key, stream, meta): Promise<void>\n+ getMetadata(key): Promise<CacheEntryMetadata | null>"]
        StreamUtils["streamUtils.ts\n(uint8ArrayToStream, streamToUint8Array, blobToStream, streamToBlob)"]
        MemStrategy["MemoryCacheStrategy\n(Bounded LRU maxSizeBytes Ceiling, Blob/Stream storage)"]
    end

    subgraph Specialized_Strategies["Platform-Specific Strategies"]
        WebCache["WebCacheStrategy (@acc/core-web)\nNative CacheStorage (window.caches), Response.blob(), Response.body Stream"]
        IDBCache["IndexedDbCacheStrategy (@acc/core-web)\nDirect IDB Blob Storage, Zero RAM Retention"]
        DiskCache["NativeFileCacheStrategy (@acc/core)\nNode/Bun fs.createReadStream / createWriteStream"]
    end

    StudioUI --> Registry
    PreviewWorker --> Registry
    BackendEngine --> Registry
    Registry --> Interface
    Interface <|.. MemStrategy
    Interface <|.. WebCache
    Interface <|.. IDBCache
    Interface <|.. DiskCache
    MemStrategy --> StreamUtils
    WebCache --> StreamUtils
    IDBCache --> StreamUtils
    DiskCache --> StreamUtils
```

---

## 3. Phased Implementation Details

### Phase 1: Core Isomorphic Cache Foundation (`@acc/core-isomorphic`)
- **Strategy Contract Modernization (`types.ts`)**:
  - Added optional `getBlob`, `setBlob`, `getStream`, `setStream`, and `getMetadata` to `IContentCacheStrategy`.
  - Preserved 100% backward compatibility for existing `Uint8Array` methods.
- **Zero-Copy Streaming Helpers (`streamUtils.ts`)**:
  - `uint8ArrayToStream`: WHATWG ReadableStream controller enqueueing.
  - `streamToUint8Array`: Chunk-accumulated single allocation reduction with deterministic `reader.releaseLock()` in `finally`.
  - `blobToStream` & `streamToBlob`: Zero-copy stream transformations.
  - `computeStreamChecksumAndSize`: Teeing stream inspector calculating `fastChecksum` and byte length.
- **Bounded In-Memory Cache (`MemoryCacheStrategy.ts`)**:
  - Configurable `maxSizeBytes` LRU ceiling (default 64MB) evicting least-recently used items when byte quota is exceeded.
  - Native `Blob` and `ReadableStream` storage and retrieval.
- **Asset Protocol Integration (`AssetProtocolRegistry.ts`, `IAssetBlob.ts`)**:
  - Extended `IAssetBlob` with optional `blob?(): Promise<Blob>`.
  - Added `BlobAssetBlob` and `CachedAssetBlob` (backed by `ContentCacheRegistry.get()`).

### Phase 2: Web & Native Storage Strategies (`@acc/core-web`, `@acc/core`)
- **Web Cache API Strategy (`WebCacheStrategy.ts`)**:
  - Zero-copy streaming via `response.body`.
  - Native Blob extraction via `response.blob()`.
  - Direct `setBlob` constructing `new Response(blob)` with custom metadata headers (`x-acc-checksum`, `x-acc-created-at`, `x-acc-meta-json`).
- **IndexedDB Strategy (`IndexedDbCacheStrategy.ts`)**:
  - Direct `Blob` storage in IndexedDB object store with streaming adapters.
- **Native Filesystem Strategy (`NativeFileCacheStrategy.ts`)**:
  - Chunked Node/Bun filesystem streams via `fs.createReadStream` / `createWriteStream`.

### Phase 3: Studio Runtime Memory Remediations (`@acc/studio`)
- **WorkerRenderStrategy (`WorkerRenderStrategy.ts`)**:
  - Deduplicated `createImageBitmap` invocations with `syncedSources` map, avoiding redundant 8.3MB allocations for unchanged sources.
- **Preview Worker (`preview.worker.ts`)**:
  - Implemented `safeSetTexture()` with LRU ceiling (`MAX_WORKER_TEXTURES = 32`).
  - Mandatory `existing.close()` prior to replacing textures to reclaim GPU VRAM immediately.
- **Audio Pipeline (`AudioAssetCache.ts`, `WebAudioEngine.ts`)**:
  - Bounded decoded PCM cache (`MAX_CACHE_ENTRIES = 8`, `MAX_TOTAL_PCM_BYTES = 64MB`).
  - Preloaded only proximate audio clips within 10s of the playhead instead of all project audio clips on app load.
- **Texture Cache (`AssetTextureCache.ts`)**:
  - Added LRU bounds to `imageCache` (32), `videoCache` (6), `canvasCache` (32), `dataUrlCache` (32), `placeholderCache` (16).
  - Explicit video cleanup (`video.pause()`, `video.src = ''`, `video.load()`).
- **File Ingestion (`LeftSidebar.tsx`)**:
  - Connected file uploads directly to `ContentCacheRegistry.get().setBlob(assetId, file)`.

---

## 4. Verification & Validation Metrics

| Test Suite | Assertions | Status | Execution Time |
|---|---|---|---|
| `autogenerated-tests/core_isomorphic_universal_services.test.ts` | 35 | Passed | 571ms |
| `autogenerated-tests/web_cache_strategy.test.ts` | 49 | Passed | 540ms |
| `autogenerated-tests/content_hash_texture_cache.test.ts` | 6 | Passed | 110ms |
| `autogenerated-tests/studio_texture_cache.test.ts` | 4 | Passed | 111ms |
| `autogenerated-tests/streaming_audio_worklet.test.ts` | 10 | Passed | 325ms |
