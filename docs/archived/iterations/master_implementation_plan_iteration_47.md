# Master Implementation Plan — Iteration 47: Isomorphic `IRMasterRenderer` Web Worker Export & `AssetProtocolRegistry` Integration

## 1. Executive Summary & Problem Formulation
In Studio (`apps/studio`), exporting video to MP4 currently uses an ad-hoc, hand-rolled export loop in [`ClientExportOrchestrator.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/export/ClientExportOrchestrator.ts) using `IRPreviewEngine` on the main UI thread. Because `AssetTextureCache` uses bounded LRU caches without upfront pre-warming, cache misses synchronously return fallback placeholder canvases (`#151518` charcoal with `[▶ VIDEO]` / `[🖼 IMAGE]` badges). Furthermore, running export on the main UI thread causes frame drops and UI freezes during 1080p/4K encodes.

**Architectural Goal:**
Refactor Studio video export to run **[`IRMasterRenderer`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/renderer/IRMasterRenderer.ts)** inside a dedicated Web Worker (`export.worker.ts`), orchestrating:
1. **Isomorphic Asset Loading via `AssetProtocolRegistry`:** Decouple `preloadAssets` from Node/Bun runtime filesystems so it seamlessly decodes image and video frames across Web, Worker, and Server environments via unified protocol resolvers (`file://`, `blob:`, `http(s)://`, `data:`, `asset://`).
2. **Strategy-Based Sinks via `MediaEngineRegistry`:** Ensure `IRMasterRenderer` resolves its video frame sinks and decoders through `MediaEngineRegistry.get('mediabunny-client')` (Web) rather than tight coupling to any single concrete sink class.
3. **Dedicated Zero-Block Export Worker:** Isolate the full render loop, WebCodecs hardware encoding, audio mixdown, and direct OPFS scratch stream writing inside a dedicated background worker (`export.worker.ts`), keeping the browser main UI thread 100% smooth at 60fps with instant `AbortSignal` cancellation.

---

## 2. Architectural Decisions & Consensus (from /grill-me)
- **Audio Pipeline:** Pass `DecoupledAudioMixResult` to `sink.finalize(audioResult)` where `MediabunnyClientSink` muxes AAC/PCM audio tracks alongside H.264 video.
- **Media Engine Decoupling:** `IRMasterRenderer` invokes sinks polymorphically via `MediaEngineRegistry.get(engineType).createVideoSink()` rather than instantiating `MediabunnyClientSink` directly.
- **Isomorphic Asset Decoding:** Refactor `IRMasterRenderer.preloadAssets` to delegate asset resolution to `AssetProtocolRegistry` with unified `ContentCacheRegistry` caching.
- **Worker Execution Architecture:** Execute the entire export pipeline inside `export.worker.ts`, writing MP4 bytes directly to OPFS `FileSystemWritableFileStream` and returning the completed Blob/file reference to the main thread.

---

## 3. Mermaid Topology & Worker Pipeline

```mermaid
flowchart TD
    subgraph MainThread["Main UI Thread (Studio App / Titlebar)"]
        UI["User clicks 'Export MP4'"]
        Orchestrator["ClientExportOrchestrator.exportToMp4()"]
        Bridge["ExportWorkerBridge\n(postMessage & AbortController)"]
        Modal["ExportProgressModal\n(Real-time 60fps progress & Cancel)"]
        Download["downloadExportedMp4(fileBlob)"]
    end

    subgraph WebWorker["Dedicated Web Worker (export.worker.ts)"]
        EngineReg["MediaEngineRegistry\n(resolves 'mediabunny-client')"]
        ProtocolReg["AssetProtocolRegistry\n(resolves fetch / blob / cache)"]
        MasterRenderer["IRMasterRenderer(timeline)"]
        Sink["MediabunnyClientSink\n(WebCodecs H.264 + AAC Audio)"]
        OPFS["OPFS Scratch Stream\n(export_*.mp4 FileSystemWritableFileStream)"]
    end

    UI --> Orchestrator
    Orchestrator --> Bridge
    Bridge -->|INIT_EXPORT { irState, options }| WebWorker
    WebWorker --> ProtocolReg
    ProtocolReg --> MasterRenderer
    EngineReg --> Sink
    MasterRenderer -->|Phase 1: preloadAssets| ProtocolReg
    MasterRenderer -->|Phase 2: consumeFrame(f, rgba)| Sink
    Sink -->|Write chunks| OPFS
    MasterRenderer -->|Phase 3: finalize(audioResult)| Sink
    WebWorker -.->|PROGRESS { percent, frame }| Bridge
    Bridge -.-> Modal
    Sink -->|EXPORT_COMPLETE { opfsBlob }| Bridge
    Bridge --> Download
    Modal -.->|CANCEL_EXPORT (terminate worker)| Bridge
```

---

## 4. Concrete Proposed Changes

### Phase 1: Isomorphic `AssetProtocolRegistry` & `IRMasterRenderer` Asset Loading
#### [MODIFY] `packages/core-isomorphic/src/protocol/AssetProtocolRegistry.ts` (or create if absent)
- Define `IAssetProtocolResolver` interface (`canHandle(uri: string): boolean; resolve(uri: string): Promise<Uint8Array | Blob | CanvasImageSource>`).
- Implement default resolvers:
  - `HttpProtocolResolver` (`http://`, `https://`) via `fetch`
  - `BlobProtocolResolver` (`blob:`)
  - `DataUriProtocolResolver` (`data:`)
  - `NodeFileProtocolResolver` (`file://`, absolute/relative paths in Node/Bun)
- Wire into `ContentCacheRegistry` for transparent caching.

#### [MODIFY] `packages/ir/src/renderer/IRMasterRenderer.ts`
- Refactor `preloadAssets()` to use `AssetProtocolRegistry.resolve(assetDef.src)` instead of raw `process.versions.node` file checks.
- Add `signal?: AbortSignal` to `HeadlessRenderOptions` with immediate loop abortion and scope cleanup.

### Phase 2: MediaEngineRegistry Parity & MediabunnyClientSink Audio
#### [MODIFY] `packages/core-web/src/media-engine/MediabunnyClientSink.ts`
- Ensure `MediabunnyClientSink.finalize(audioResult)` cleanly handles `DecoupledAudioMixResult` (Float32Array stereo PCM channels) alongside `MediaAudioMixResult`.
- Ensure it conforms to `IIRFrameSink` contract.

### Phase 3: Export Web Worker & Bridge
#### [NEW] `apps/studio/src/renderer/workers/export.worker.ts`
- Dedicated worker listening for `START_EXPORT`, `CANCEL_EXPORT`.
- Registers `MediabunnyClientStrategy` with `MediaEngineRegistry`.
- Executes `IRMasterRenderer.render({ engine: 'mediabunny-client', sink, onProgress, signal })`.
- Streams output directly to OPFS `writableStream`.
- Posts `EXPORT_PROGRESS` and `EXPORT_COMPLETE` back to main thread.

#### [NEW] `apps/studio/src/renderer/workers/ExportWorkerBridge.ts`
- Manages export worker lifecycle, progress subscriptions, and `terminate()` on cancellation.

### Phase 4: Refactor `ClientExportOrchestrator.ts`
#### [MODIFY] `apps/studio/src/lib/export/ClientExportOrchestrator.ts`
- Delegate the entire export execution to `ExportWorkerBridge`.
- Retain `downloadExportedMp4()` helper.
- Delete obsolete ~180 lines of manual frame readback, manual `IRPreviewEngine` stepping, and manual PCM audio mixing.

---

## 5. Verification Plan

### Automated Tests
Run existing and new automated tests:
```bash
bun test autogenerated-tests/headless_scoped_resource_engine.test.ts autogenerated-tests/ir_renderer_web_server_parity.test.ts autogenerated-tests/continuous_playback_memory_soak.test.ts autogenerated-tests/plugin_zero_alloc_loop.test.ts autogenerated-tests/native_resource_scope_raii.test.ts
```

### New Formal Test Suite
- `autogenerated-tests/asset_protocol_registry.test.ts`: Verify `AssetProtocolRegistry` resolves HTTP, Data URIs, and Blobs into `ContentCacheRegistry`.
- `autogenerated-tests/isomorphic_master_renderer_export.test.ts`: Verify `IRMasterRenderer` preloads assets via `AssetProtocolRegistry` and completes export with zero placeholders.

### Manual Verification in Studio UI
1. Start Studio dev server (`pnpm --filter @acc/studio dev`).
2. Add image and video clips to timeline.
3. Click "Export MP4". Verify that progress increments smoothly, UI remains interactive, and the downloaded MP4 renders full-fidelity video with **zero placeholder graphics**.
4. Test clicking "Cancel Export" at 50% to verify immediate termination and memory cleanup.
