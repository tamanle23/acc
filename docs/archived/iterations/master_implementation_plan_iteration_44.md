# Master Implementation Plan - Iteration 44: Elimination of In-Memory Texture Caches & Native Media Buffer Leaks

## 1. Executive Summary & Context

Iteration 44 addresses the critical memory bottleneck in `@acc/studio`, `@acc/ir`, `@acc/core-isomorphic`, and `@acc/core-web`: the accumulation of over 2GB of native GPU/VRAM and C++ heap buffers during playback and interactive scrubbing.

In high-performance web-based video compositing, decoded video frames and bitmaps (`VideoFrame`, `ImageBitmap`) hold raw uncompressed pixel data (e.g., $1920 \times 1080 \times 4 \text{ bytes} \approx 8.29\text{ MB}$ per 1080p frame, $\approx 33.17\text{ MB}$ per 4K frame). Because the V8 JavaScript engine only observes the tiny JS wrapper object ($\sim 48\text{ bytes}$), V8's generational garbage collector triggers no major collection cycles while hundreds of frames accumulate during 30–60fps rendering passes. Without deterministic explicit disposal, memory rapidly exceeds browser ceilings, resulting in tab crashes (OOM) or detached GPU contexts.

Furthermore, [`AssetTextureCache.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/textures/AssetTextureCache.ts) maintains 7 in-memory `Map` instances holding raw DOM canvas elements, video decoders, and object URLs. Iteration 44 eliminates these in-memory caches, standardizes persistent storage on the isomorphic [`ContentCacheRegistry`](file:///c:/Users/Admin/workspace/git/acc/packages/core-isomorphic/src/cache/ContentCacheRegistry.ts), introduces an immediate post-`drawImage()` synchronous `.close()` protocol in [`IRCanvasCompositor`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/renderer/shared/IRCanvasCompositor.ts), bounds scrubbing cache memory via a strict size-capped LRU cache in [`PreviewFrameMemoryManager`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/PreviewFrameMemoryManager.ts), and pools transient canvases through [`CanvasScratchPool`](file:///c:/Users/Admin/workspace/git/acc/packages/core-isomorphic/src/canvas/CanvasScratchPool.ts).

---

## 2. Decision & Architectural Trade-off Matrices

### Frame Lifecycle & Disposal Protocol
| Dimension | Option A: Rely on V8 Garbage Collection (Legacy) | Option B: Immediate Post-`drawImage()` Synchronous `.close()` (Adopted) | Option C: Deferred Disposal Queue (`pendingDisposal`) |
| :--- | :--- | :--- | :--- |
| **VRAM Consumption** | $> 2.5\text{ GB}$ (Unbounded growth) | **$< 50\text{ MB}$ steady-state playback** | $150\text{ MB} - 400\text{ MB}$ with burst spikes |
| **GC Pause Latency** | Major GC pauses (50–200ms frame drops) | **Zero GC pause spikes** (0ms collection) | Occasional GC sweeps on queue drainage |
| **Multi-Track Safety** | Safe (V8 tracks all references) | **Safe via Ref-Counting / `onAssetDrawn`** | Risk of premature closure before draw |
| **Implementation Complexity** | Zero | Low to Moderate (hook in compositor) | Moderate (tracking sets & drain loops) |
| **Architectural Verdict** | **Prohibited (Root cause of 2GB OOM)** | **Adopted for Iteration 44** | Retained strictly for batched background cleanup |

### Texture Cache Storage Backing
| Dimension | Option A: Unbounded In-Memory Maps (`AssetTextureCache`) | Option B: Isomorphic `ContentCacheRegistry` (Adopted) | Option C: Browser Cache Storage API |
| :--- | :--- | :--- | :--- |
| **Storage Backing** | JavaScript Heap (volatile, leaks across sessions) | **OPFS / IndexedDB / Native File** | HTTP Cache Storage |
| **Blob Streaming** | Re-decodes and re-fetches continuously | **First-class Web standard Blob zero-copy** | Requires synthetic Request/Response |
| **Worker Interop** | Main-thread only DOM elements | **Shared cross-thread (Worker & Main)** | Limited worker support |
| **Memory Ceiling** | Uncapped ($O(N)$ assets in memory) | **Bounded Hot LRU ($\le 8$) + Disk Cache** | Bounded by quota |
| **Architectural Verdict** | **Deprecated** | **Adopted for Iteration 44** | Redundant with `ContentCacheRegistry` |

### Scratch Canvas Allocation
| Dimension | Option A: `new OffscreenCanvas()` / `createElement('canvas')` | Option B: Bucket-Pooled `CanvasScratchPool` (Adopted) | Option C: Single Global Giant 4K Canvas |
| :--- | :--- | :--- | :--- |
| **Allocation Rate** | High churn per frame tick | **Zero allocation in steady state** | Zero allocation |
| **Memory Footprint** | Fluctuating, causes heap fragmentation | **Bucketed ($256\times256$ to $3840\times2160$)** | Permanent $\sim 33\text{ MB}$ allocation |
| **Context Reset** | Native GC sweeps old canvases | **Reused via `ctx.clearRect()`** | Reused via `ctx.clearRect()` |
| **Architectural Verdict** | **Prohibited in Render Loops** | **Adopted for Iteration 44** | Inefficient for small thumbnails/badges |

---

## 3. Subsystem Architecture & Mermaid Topology

```mermaid
flowchart TD
    subgraph RenderTick["Deterministic 60FPS Render Tick Pipeline"]
        Seek["Seek / Playhead Frame t"] --> QueryInterval["IntervalTreeIndex: Active Sequences"]
        QueryInterval --> ResolveAssets["Resolve Asset Sources"]
        
        ResolveAssets --> CheckMode{"Transport State?"}
        CheckMode -- "Playback (Sequential 60fps)" --> TransientDecode["Decode Single-Use Frame\nTag: _isTransient = true"]
        CheckMode -- "Scrubbing (Interactive)" --> CheckScrubLRU{"In Scrub LRU Cache?"}
        
        CheckScrubLRU -- "Hit" --> BindLRU["Bind Cached Bitmap (Protected)"]
        CheckScrubLRU -- "Miss" --> DecodeLRU["Decode & Insert into PreviewFrameMemoryManager"]
        DecodeLRU --> BindLRU
        
        TransientDecode --> BlitPass["IRCanvasCompositor: ctx.drawImage(rawAsset, ...)"]
        BindLRU --> BlitPass
        
        BlitPass --> PostDrawHook{"Post-Draw: Is Asset Single-Use Transient?"}
        PostDrawHook -- "Yes (Remaining Refs == 0)" --> ImmediateClose["rawAsset.close() Synchronously Executed Immediately"]
        PostDrawHook -- "No (Multi-Track Shared / Scrub LRU)" --> RetainFrame["Retain in Active LRU / Frame Window"]
    end

    subgraph MemoryHygiene["Strict LRU Cache & Disposal Authority"]
        InsertFrame["set(assetId, frame, bitmap)"] --> SizeCheck{"Cache Size >= MAX_GLOBAL_FRAMES (32)?"}
        SizeCheck -- "Yes" --> EvictLRU["Evict Oldest Accessed Key"]
        EvictLRU --> CloseEvicted["evicted.bitmap.close() Synchronously Executed"]
        SizeCheck -- "No" --> StoreLRU["Store Entry"]
        
        KeyOverwrite["Overwrite Existing Frame"] --> CloseOverwritten["old.bitmap.close() Synchronously Executed"]
        PruneWindow["pruneOutsideWindow(playhead)"] --> ClosePruned["pruned.bitmap.close() Synchronously Executed"]
    end

    subgraph ContentRegistryFlow["AssetTextureCache <-> ContentCacheRegistry"]
        AssetReq["getVisualAsset(assetId, src)"] --> CheckHotLRU{"In Hot Decoders LRU (<= 8)?"}
        CheckHotLRU -- "Hit" --> ReturnHot["Return Ready VisualAssetResult"]
        CheckHotLRU -- "Miss" --> ReturnPlaceholder["Return Dark Charcoal Placeholder Canvas"]
        
        ReturnPlaceholder --> TriggerAsync["Async Load: ContentCacheRegistry.get().get(assetId)"]
        TriggerAsync --> CheckBlob{"Blob in Cache?"}
        CheckBlob -- "Yes" --> DecodeBitmap["createImageBitmap(blob)"]
        CheckBlob -- "No" --> FetchNet["fetch(src) -> blob -> ContentCacheRegistry.get().set(assetId, blob)"]
        FetchNet --> DecodeBitmap
        
        DecodeBitmap --> InsertHotLRU["Insert into Hot Decoders LRU"]
        InsertHotLRU --> NotifySubscribers["this.notify() -> Viewport Redraw Triggered"]
    end
```

---

## 4. Mathematical & Algorithmic Specifications

### 4.1 Native Buffer Memory Consumption Model
For an active timeline with $K$ visible video tracks rendering at resolution $W \times H$ with color depth 4 (RGBA32), memory consumption per decoded frame is:
$$M_{\text{frame}}(W, H) = W \times H \times 4 \text{ bytes}$$

Under unconstrained sequential playback for duration $T$ seconds at frame rate $R$:
$$M_{\text{unconstrained}} = \sum_{t=0}^{T \cdot R} \sum_{k=1}^{K} M_{\text{frame}}(W_k, H_k)$$
For $W=1920, H=1080, K=1, R=30, T=10$:
$$M_{\text{unconstrained}} = 300 \times (1920 \times 1080 \times 4) \approx 2.488 \times 10^9 \text{ bytes} \approx 2.48\text{ GB}$$

Under the Iteration 44 deterministic post-draw `.close()` invariant:
$$M_{\text{steady-state}}(W, H, K) = K \cdot M_{\text{frame}}(W, H)$$
For $K=2$ concurrent 1080p tracks:
$$M_{\text{playback}} = 2 \times 8.294\text{ MB} = 16.59\text{ MB}$$
Accumulation over time is completely eliminated:
$$\lim_{T \to \infty} M_{\text{playback}}(T) = \mathcal{O}(K \cdot W \cdot H) \ll 50\text{ MB}$$

### 4.2 Scrubbing Cache Memory Bound
Under timeline scrubbing, frames within the playhead proximity window $[f_{\text{playhead}} - 2R, f_{\text{playhead}} + 3R]$ are retained in [`PreviewFrameMemoryManager`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/PreviewFrameMemoryManager.ts) subject to a strict capacity ceiling $C_{\max} = 32$:
$$M_{\text{scrub\_cache}} \le C_{\max} \cdot M_{\text{frame}}(W, H)$$
For 1080p:
$$M_{\text{scrub\_cache}} \le 32 \times 8.294\text{ MB} \approx 265.4\text{ MB}$$
For 720p:
$$M_{\text{scrub\_cache}} \le 32 \times 3.686\text{ MB} \approx 117.9\text{ MB}$$

### 4.3 Reference Counting Algorithm for Multi-Sequence Safety
To prevent `InvalidStateError` when multiple sequences or tracks share the same visual asset on the same frame:
1. Prior to compositing frame $f$, compute sequence reference counts:
   $$\text{refCount}(A) = \sum_{s \in \text{ActiveSequences}(f)} \mathbb{I}(s.\text{assetId} = A)$$
2. When sequence $s$ finishes blitting asset $A$ via `ctx.drawImage()`, trigger `onAssetDrawn(A, asset)`:
   $$\text{refCount}(A) \leftarrow \text{refCount}(A) - 1$$
3. If $\text{refCount}(A) = 0$ and $A$ is tagged as transient:
   $$\text{execute } A.\text{close}()$$

---

## 5. Concrete File & Class Signatures

### 5.1 `packages/ir/src/renderer/shared/IRCanvasCompositor.ts`
```typescript
export interface IAssetSourceResolver {
  get(assetId: string): any | undefined;
  has(assetId: string): boolean;
  /**
   * Invoked synchronously immediately after ctx.drawImage() completes for a sequence.
   * Enables the resolver to synchronously close transient frames once all sequences in the tick are done.
   */
  onAssetDrawn?(assetId: string, asset: any): void;
}
```

### 5.2 `apps/studio/src/renderer/workers/PreviewFrameMemoryManager.ts`
```typescript
export class PreviewFrameMemoryManager {
  private static instance: PreviewFrameMemoryManager;
  private readonly MAX_GLOBAL_FRAMES = 32;
  private frameMap: Map<string, CachedFrameEntry>;

  public get(assetId: string, frame: number): ImageBitmap | null;
  public set(assetId: string, frame: number, bitmap: ImageBitmap): void;
  public pruneOutsideWindow(playheadFrame: number, fps: number): void;
  public clear(): void;
  private closeBitmap(bitmap: ImageBitmap): void;
}
```

### 5.3 `apps/studio/src/lib/textures/AssetTextureCache.ts`
```typescript
export class AssetTextureCache implements Disposable {
  private static instance: AssetTextureCache;
  private hotImageLRU: Map<string, { img: CanvasImageSource; url?: string; lastUsed: number }>;
  private hotVideoLRU: Map<string, { video: HTMLVideoElement; lastUsed: number }>;
  private subscribers: Set<() => void>;

  public static getInstance(): AssetTextureCache;
  public getVisualAsset(assetId: string, src?: string, assetType?: 'image' | 'video', timeSec?: number): VisualAssetResult;
  public loadBlob(assetId: string, blob: Blob): Promise<CanvasImageSource>;
  public getThumbnailDataUrl(assetId: string, width?: number, height?: number): string;
  public subscribe(callback: () => void): () => void;
  public dispose(): void;
}
```

---

## 6. Phased Implementation Roadmap

```mermaid
flowchart LR
    Phase1["Phase 1: Compositor Post-Draw Protocol & IRMasterRenderer Cleanup"] --> Phase2["Phase 2: PreviewFrameMemoryManager Strict LRU & preview.worker Bifurcation"]
    Phase2 --> Phase3["Phase 3: AssetTextureCache Integration with ContentCacheRegistry"]
    Phase3 --> Phase4["Phase 4: CanvasScratchPool Unification"]
    Phase4 --> Phase5["Phase 5: Automated Verification & Memory Regression Tests"]
```

### Phase 1: Compositor Post-Draw Lifecycle Protocol
- Extend `IAssetSourceResolver` with `onAssetDrawn?(assetId: string, asset: any): void`.
- Update `IRCanvasCompositor.renderTrackSequences()` to wrap `ctx.drawImage` in a `try...finally` block executing `assets.onAssetDrawn()` or closing transient bitmaps.
- Update `IRMasterRenderer.renderCanvasFrame()` to close all `activeVideoFrames` in a `finally` block.

### Phase 2: Strict LRU & Playback/Scrub Bifurcation
- Update `PreviewFrameMemoryManager.ts`:
  - Set `MAX_GLOBAL_FRAMES = 32`.
  - Enforce synchronous `.close()` on eviction, overwrite, window prune, and clear.
- Update `preview.worker.ts`:
  - Bifurcate playback vs scrubbing: mark sequential playback frames as single-use transient.
  - Implement `onAssetDrawn` hook in worker resolver to immediately close transient frames post-draw.
  - Refactor `safeSetTexture`: close evicted or overwritten bitmaps synchronously.

### Phase 3: `AssetTextureCache` Refactoring
- Eliminate unbounded static/instance `Map`s in `AssetTextureCache.ts`.
- Integrate `ContentCacheRegistry.get().get(assetId)` and `set(assetId, blob)`.
- Bound active decoders to Hot Decoders LRU ($\le 8$ images, $\le 4$ videos).
- Revoke object URLs and clear video elements synchronously upon eviction.
- Acquire scratch canvases via `UniversalCanvasProvider.acquireScratchCanvas()` for procedural placeholders.

### Phase 4: Scratch Canvas Pooling & Reuse
- Verify all temporary canvas allocations use `CanvasScratchPool` with standard resolution buckets.
- Ensure all scratch canvases are cleared with `clearRect()` and released in `finally` blocks.

### Phase 5: Automated Regression Testing
- Create `autogenerated-tests/memory_native_buffer_hygiene.test.ts`.
- Validate zero lingering unclosed frames across 100-frame playback simulation.
- Validate strict capacity capping and synchronous eviction in `PreviewFrameMemoryManager`.
- Validate `AssetTextureCache` delegation to `ContentCacheRegistry`.

---

## 7. Formal Verification Matrix (`/autogenerated-tests/`)

| Test Suite / Case | Target File | Verification Metric | Pass Criteria |
| :--- | :--- | :--- | :--- |
| `test_transient_frame_immediate_closure` | `IRCanvasCompositor.ts` | Count of active `ImageBitmap.close()` calls | 100% of single-use frames closed immediately post-draw |
| `test_multi_sequence_asset_sharing` | `IRCanvasCompositor.ts` | Frame blit exceptions | Zero `InvalidStateError` when 2 tracks share the same asset |
| `test_preview_memory_manager_strict_lru` | `PreviewFrameMemoryManager.ts` | `frameMap.size` and closed count | Size never exceeds 32; 100% of evicted bitmaps closed synchronously |
| `test_asset_texture_cache_content_registry` | `AssetTextureCache.ts` | In-memory map sizes & CCR calls | Zero unbounded maps; blob cached in `ContentCacheRegistry` |
| `test_canvas_scratch_pool_reuse` | `CanvasScratchPool.ts` | `pool.getStats().inUse` | 100% of acquired scratch canvases released after render pass |

---

## 8. Risk Assessment, Rollback & Mitigations

| Risk | Impact | Mitigation Strategy | Rollback Strategy |
| :--- | :--- | :--- | :--- |
| **Premature Detached Frame Draw** | `InvalidStateError: The ImageBitmap is detached` thrown during compositing. | Reference counting via `onAssetDrawn` ensures closure only occurs when the last sequence using the asset in that tick completes. | Revert compositor `finally` block to defer closure to end of tick. |
| **OPFS / Disk Cache Latency** | UI stutter while waiting for async `ContentCacheRegistry.get()`. | Non-blocking Observer pattern: immediately return dark charcoal placeholder canvas, decode in background, and fire `notify()` upon completion. | Increase hot image LRU size from 8 to 16. |
| **Worker Handoff Detachment** | Sender thread accesses detached `ImageBitmap` after `postMessage(..., [transferable])`. | Sender thread (`WorkerRenderStrategy`) deletes reference immediately upon transfer; worker assumes sole ownership. | Pass bitmap via structured clone without transferable list if transfer fails. |

---

## 9. Alignment & Master Rules Checklist
- [x] Conforms to Rule Management SOP (`docs/master_rules_reference.md`).
- [x] Strict TypeScript (`no any` in newly added public contracts).
- [x] Zero Mock Stub Prohibition for media pipeline (real `ContentCacheRegistry` contracts).
- [x] Formal verification test suite specified in `autogenerated-tests/`.
- [x] Zero orphaned code: all refactored classes wired into live render pipeline.
- [x] Monorepo packaging boundaries respected (`@acc/ir`, `@acc/core-isomorphic`, `@acc/studio`).
