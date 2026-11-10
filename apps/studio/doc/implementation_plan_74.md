# Implementation Plan 74: Studio Browser Export Video Decoder Parity & Isomorphic Asset Protocol (Grill-Me Aligned)

## 1. Executive Summary
This local Studio companion plan addresses video and audio decoding capability in browser Web Workers during MP4 timeline export. While Studio's interactive preview utilizes [`MediabunnyWorkerReader.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/MediabunnyWorkerReader.ts), the client MP4 export worker ([`export.worker.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/export.worker.ts)) instantiates `IRMasterRenderer` with `MediaEngineRegistry.get(MediaEngineType.MediabunnyClient)`.

Because [`MediabunnyClientStrategy`](file:///c:/Users/Admin/workspace/git/acc/packages/core-web/src/media-engine/MediabunnyClientStrategy.ts) lacked `createVideoDecoder()`, video sequences could not be decoded during browser MP4 exports. Furthermore, `MediabunnyServerStrategy` hardcoded `fs.existsSync` in both video and audio decoding pipelines, breaking virtual `cache://` and `blob:` URIs. Code review also uncovered unclosed `Input` instances in audio decoders, unoptimized intermediate canvas scaling, Windows `file:///C:/...` path normalization bugs, and multi-track frame deletion dropouts in `IRMasterRenderer.ts`.

Following the `/grill-me` alignment, `MediabunnyWorkerReader` will be refactored to compose `MediabunnyClientVideoDecoder`, unifying client decoding under one single source of truth while preserving Studio's interactive scrub-throttling and sequential ping-pong cache.

---

## 2. Scope & Boundaries
- **Unify `MediabunnyWorkerReader`**: Studio interactive preview reader composes `MediabunnyClientVideoDecoder` from `@acc/core-web`, delegating core decoding while retaining its dedicated viewport features (scrub throttling, sequential circular ping-pong buffer, poster caching, memory manager integration).
- **Add `createVideoDecoder` to `MediabunnyClientStrategy`**: Provide `MediabunnyClientVideoDecoder` conforming to `IVideoDecoder` in `@acc/core-web` (strictly WinterTC compliant, returning zero-copy pool canvas directly).
- **Universal Asset Resolution**: Decoders accept `cache://`, `blob:`, `http:`, and `file:` URIs through [`AssetProtocolRegistry`](file:///c:/Users/Admin/workspace/git/acc/packages/core-isomorphic/src/assets/AssetProtocolRegistry.ts).
- **Windows Path Normalization**: Normalize `file:///` URLs on Windows to eliminate false negative existence checks.
- **Resource Cleanup**: Explicitly call `input.dispose()` in both client and server decoders on `close()`, `[Symbol.dispose]`, and `[Symbol.asyncDispose]`.
- **Multi-Track Integrity**: Eliminate premature frame deletion in `IRMasterRenderer.onAssetDrawn`.

---

## 3. Implementation Steps
1. **Refactor `packages/core-isomorphic`**:
   - Normalize Windows paths in `AssetProtocolRegistry.resolve()`.
   - Add dimensions, `[Symbol.dispose]`, and `[Symbol.asyncDispose]` to `IVideoDecoder`.
2. **Refactor `packages/ir/src/renderer/IRMasterRenderer.ts`**:
   - Prevent premature deletion of active frames in `onAssetDrawn`.
3. **Refactor `packages/core/src/media-engine/strategies/MediabunnyServerStrategy.ts`**:
   - Replace raw `fs.existsSync` in `MediabunnyVideoDecoder` and `createAudioDecoder` with `AssetProtocolRegistry.getInstance().resolve(...)`.
   - Pass `{ width, height, fit: 'fill', poolSize: 2 }` to `CanvasSink`.
   - Call `this.input?.dispose()` on `close()` and explicit disposal symbols.
4. **Implement `MediabunnyClientVideoDecoder` in `packages/core-web/src/media-engine/MediabunnyClientStrategy.ts`**:
   - Conforms to `IVideoDecoder` (`open()`, `close()`, `readNextFrame()`, `seekTimestamp()`).
   - Implements `createVideoDecoder` on `MediabunnyClientStrategy`.
   - Wrap `createAudioDecoder` with `input.dispose()`.
5. **Refactor `apps/studio/src/renderer/workers/MediabunnyWorkerReader.ts`**:
   - Compose `MediabunnyClientVideoDecoder` as the underlying decoder.
6. **Verify with automated tests**:
   - Verify strategy instantiation, URI resolution, Windows path normalization, and `export.worker.ts` compatibility.
   - Run `pnpm --filter @acc/studio build`.
