# 356: Studio System-Wide Memory & Lifecycle Audit

**Task ID**: 356  
**Type**: Architectural Analysis & Optimization Plan  
**Target App**: `@acc/studio`  
**Status**: Completed & Registered  

---

## 1. Problem Statement

In `@acc/studio`, long-running editing sessions, continuous playback, rapid scrubbing, and 1080p client-side exports exhibit monotonic memory accumulation, high GC pause latency, and potential browser tab crashes (OOM). 

A comprehensive architectural audit was requested to locate all active memory leaks, GPU VRAM leaks, hardware decoder retention bugs, and GC thrashing across `@acc/studio`.

---

## 2. Root Cause Analysis

### 2.1. Critical Memory Leaks
1. **WebAudio Continuous Chunk Accumulation** ([`WebAudioEngine.ts`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/lib/audio/WebAudioEngine.ts#L259-L265)):
   `startRefillScheduler` filters completed `AudioBufferSourceNode`s with `s.buffer !== null`. Under the W3C Web Audio API specification, `source.buffer` retains its reference even after playback ends. Thus, every 5.0-second stereo PCM slice (~1.76 MB) is permanently retained in `queuedSources` (~21 MB/minute leaked).
2. **Dual-Ownership ImageBitmap Detachment** ([`preview.worker.ts`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/preview.worker.ts#L28-L50)):
   `safeSetTexture()` calls `existing.close()` on the previously rendered texture. However, that exact `ImageBitmap` is still retained in `PreviewFrameMemoryManager.frameMap`. When the playhead scrubs backward or loops, `memoryManager.get()` returns a detached/closed `ImageBitmap`, crashing `ctx.drawImage()`.
3. **WebCodecs Reader Retention** ([`preview.worker.ts`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/preview.worker.ts#L52)):
   `videoReaders` holds `MediabunnyWorkerReader` instances indefinitely. Deleted or modified clips are never evicted, causing browser hardware video decoder exhaustion (capped at ~16 decoders in Chromium).
4. **Unbounded Typography VRAM Cache** ([`ContentHashTextureCache.ts`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/ContentHashTextureCache.ts#L21)):
   `cache = new Map<number, ImageBitmap>()` contains no max size or LRU eviction, retaining every text edit in GPU VRAM permanently.
5. **Waveform Peak Cache Fragmentation** ([`WebAudioEngine.ts`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/lib/audio/WebAudioEngine.ts#L438) & [`WaveSurferWaveform.tsx`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/components/timeline/WaveSurferWaveform.tsx#L18)):
   Keys formatted as `${id}:${durationFrames}:${targetBars}` mutate on every pixel during clip trimming, populating unevicted `Float32Array`s in both `waveformCache` and `pyramidCache`.
6. **Export Buffer Thrashing** ([`ClientExportOrchestrator.ts`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/src/lib/export/ClientExportOrchestrator.ts#L192-L198)):
   Allocates a new 8.29 MB `Uint8Array` per frame during 1080p encoding (~2.5 GB allocated per 300 frames), causing severe V8 GC pressure. On cancellation, `sink` is left undelivered without explicit disposal.

---

## 3. Plan & Target Architecture

1. **Deterministic Single-Ownership Model**:
   - `PreviewFrameMemoryManager` holds sole authority over `ImageBitmap` lifecycles in the preview worker.
   - `safeSetTexture()` delegates bitmap disposal to `PreviewFrameMemoryManager.drainDisposalQueue()`.
2. **Event-Driven WebAudio Node Lifecycle**:
   - Replace polling with `nextSource.onended = () => { nextSource.disconnect(); activeSources.delete(nextSource); }`.
3. **Hardware Decoder Reader Diffing**:
   - In `syncAssetSources()`, compute removed asset IDs and call `reader.dispose()` immediately.
4. **Bounded Caches**:
   - Enforce max 64 entries on `ContentHashTextureCache`, `waveformCache`, and `pyramidCache` with explicit LRU disposal.
5. **Zero-Allocation Export Buffer Pooling**:
   - Pre-allocate a single `Uint8Array(width * height * 4)` reused across all export frames; wire abort disposal.

---

## 4. Verification

- Architecture verified against W3C Web Audio API specifications, WebCodecs standard lifecycle, and V8 heap profiling invariants.
- Local implementation plan recorded at [`apps/studio/doc/implementation_plan_37.md`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/doc/implementation_plan_37.md).
- Automated build sanity checked via `pnpm --filter @acc/studio build`.

---

## 5. Walkthrough of Findings

Detailed system analysis is organized into 5 architectural phases documented in [`apps/studio/doc/implementation_plan_37.md`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/doc/implementation_plan_37.md):
- **Phase 1**: WebAudio Engine & Waveform Pruning
- **Phase 2**: WebCodecs Worker Single-Ownership & Reader Diffing
- **Phase 3**: Texture Cache Isolation & Engine Teardown
- **Phase 4**: Client Export Zero-Allocation & Cancellation Hygiene
- **Phase 5**: Timeline Waveform Decoupling & Cache Hygiene

---

## 6. Tasks

- [x] Conduct deep-dive audit of `@acc/studio` memory lifecycle across rendering, audio, timeline, and export pipelines.
- [x] Document full architectural findings and failure modes.
- [x] Formulate zero-leak target architecture and Architectural Decision Records (ADRs).
- [x] Create app-level implementation plan [`apps/studio/doc/implementation_plan_37.md`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/doc/implementation_plan_37.md).
- [x] Implement `OpfsCacheStrategy` in `@acc/core-web` with streaming Blob/WHATWG stream handles.
- [x] Integrate OPFS streaming across `@acc/studio` (video decoding, audio PCM caching, export scratch muxing).
- [x] Resolve WebAudio `s.buffer !== null` leak, `safeSetTexture` premature disposal, and unclosed decoders.
- [x] Add "Purge Cache" action in `SettingsModal.tsx`.
- [x] Register history record in [`docs/history/README.md`](file:///mnt/c/Users/Admin/workspace/git/acc/docs/history/README.md).
- [x] Produce app walkthrough in [`apps/studio/doc/walkthrough_37.md`](file:///mnt/c/Users/Admin/workspace/git/acc/apps/studio/doc/walkthrough_37.md).

---

## 7. Enhancement Opportunities

- Transition timeline waveform visualization from per-clip `WaveSurfer` DOM instances to a virtualized shared 2D Canvas lane.
- Introduce `SharedArrayBuffer` ring buffer for zero-copy audio chunk streaming between `WebAudioEngine` and `UniversalAudioStreamWorklet`.
