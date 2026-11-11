# Master Implementation Plan: Iteration 77
# Studio Memory Minimization & Multi-FPS Smooth Playback Optimization

## 1. Executive Summary
During profiling of `@acc/studio`, the renderer process memory footprint in Chrome Task Manager was measured at **~180MB to 220MB**. While not leaking, this working set is driven by eager static bundling of ONNX Runtime and Transformers.js on the main UI thread (~45MB), high PCM audio buffer allocations in `AudioAssetCache` (~64MB), an oversized $1920\times 1080$ `#studio-overlay-canvas` (~25MB at 2x DPR), redundant main-thread `HTMLVideoElement` allocations in `AssetTextureCache` (~20MB), and eager loading of developer modals (~10MB).

Iteration 77 executes a comprehensive, zero-regression optimization that slashes total memory consumption by **over 55%** (down to **~65MB–80MB**) while maintaining **0ms slot swaps and uninterrupted 24, 25, 30, and 60 FPS playback cadence** using the circular ping-pong buffer in `SequentialVideoReader`.

## 2. Trade-Off Matrices

| Architectural Vector | Existing Architecture | Iteration 77 Optimized Architecture | Trade-Off & Invariant Justification |
| :--- | :--- | :--- | :--- |
| **Neural Vision Strategies** | Static import of `@acc/effect-engines` in `packages/core-web`. Main bundle bundles ONNX + Transformers.js (~1.2 MB minified). | Lightweight proxy strategies (`LazyNeuralDepthStrategy`, `LazyNeuralSegmentationStrategy`) dynamically import `@acc/effect-engines` on demand. | Zero impact on UI inspector strategy selection; saves ~45MB V8 heap on initial load; faster GC scavenge cycles ($<1\text{ ms}$). |
| **Overlay Canvas Sizing** | Hardcoded to project resolution ($1920\times 1080$ or $3840\times 2160$ on 2x DPR) via `options.timelineWidth`. | Sized dynamically to active virtual resolution ($960\times 540$ at 0.5x) and completely bypassed during playback. | 75% smaller Skia GPU buffer (8.3MB down to 2.07MB); zero CPU/GPU overhead during playback when guides are inactive. |
| **Audio PCM Buffer Ceiling** | `MAX_TOTAL_PCM_BYTES = 64MB`; eager 10s lookahead preloads all proximate audio tracks on startup. | `MAX_TOTAL_PCM_BYTES = 16MB`; lookahead window tuned to 6s ($~2.1\text{ MB}$ per track). | 16 MB stores ~2.3 minutes of continuous stereo audio; more than enough for seamless real-time playback with LRU recycling. |
| **Main-Thread Video Decoding** | `AssetTextureCache.hotVideoLRU` creates `<video preload="auto">` elements that buffer whole video files. | Completely eliminated. All video decoding is strictly confined to WebCodecs within `preview.worker.ts`. | Chrome media pipeline buffers removed from UI thread; saves 15–25MB RAM with zero loss of functionality. |
| **Developer Modals Bundling** | `Titlebar.tsx` statically imports `IrVisualEditorModal` (pulling in `shiki/core`), `OpfsExplorerModal`, and `ShortcutsModal`. | Code-split using SolidJS `lazy()` and wrapped in `<Suspense fallback={<ModalProgressFallback />}>`. | Instant initial load, saves ~10MB, gives sleek progressive loading indicator on modal open. |

## 3. Mermaid Topology

```mermaid
graph TD
  subgraph MainThread ["Main Thread (Browser UI Process)"]
    UI["SolidJS UI & Titlebar"]
    TitlebarLazy["Lazy Modals: Shiki / OPFS / Shortcuts"]
    Overlay["Overlay Canvas (960x540 / Inactive on Play)"]
    AudioCache["AudioAssetCache (16MB PCM Budget)"]
    ProxyAI["Lazy Proxy Vision Strategies (0MB Startup)"]
  end

  subgraph WorkerThread ["Web Worker Process (preview.worker.ts)"]
    Compositor["IRCanvasCompositor & Back Buffer"]
    PingPong["SequentialVideoReader (Slot A / Slot B Ping-Pong)"]
    Decoders["WebCodecsDecoderPool (Cap: 4 Hardware Decoders)"]
    WorkerTex["Worker Texture Cache (Cap: 8 Textures)"]
    SidecarAI["On-Demand Neural Models (@acc/effect-engines)"]
  end

  UI -->|Low-Freq State Ticks| Overlay
  UI -.->|On-Demand Click| TitlebarLazy
  UI --> AudioCache
  UI --> ProxyAI
  MainThread -->|transferControlToOffscreen| Compositor
  Compositor --> PingPong
  PingPong --> Decoders
  Compositor --> WorkerTex
  ProxyAI -.->|Execute Modifier Event| SidecarAI

  style MainThread fill:#f8fafc,stroke:#0284c7,stroke-width:2px
  style WorkerThread fill:#f8fafc,stroke:#10b981,stroke-width:2px
```

## 4. Mathematical & Algorithmic Specifications

### 4.1 Canvas Pixel Memory
For an uncompressed RGBA canvas context:
$$\text{Memory}_{\text{canvas}} = W \times H \times 4 \times \text{DPR}^2 \text{ bytes}$$
- **Old Overlay Canvas**: $1920 \times 1080 \times 4 \times 1.0 = 8,294,400\text{ bytes} \approx 8.3\text{ MB}$ (or $33.2\text{ MB}$ at $\text{DPR} = 2.0$).
- **Optimized Overlay Canvas**: $960 \times 540 \times 4 \times 1.0 = 2,073,600\text{ bytes} \approx 2.07\text{ MB}$ (or $8.3\text{ MB}$ at $\text{DPR} = 2.0$).
$$\Delta \text{Memory} = -75\%$$

### 4.2 Audio PCM Buffer Budget
For uncompressed 32-bit float stereo audio at $F_s = 44,100\text{ Hz}$:
$$\text{Bitrate}_{\text{PCM}} = 44,100 \times 2 \times 4 = 352,800\text{ bytes/sec} \approx 0.353\text{ MB/sec}$$
At a 16 MB ceiling:
$$T_{\text{max}} = \frac{16 \times 1024 \times 1024}{352,800} \approx 47.5\text{ track-seconds per channel} \approx 2.37\text{ minutes of stereo audio}$$
For a 6-second lookahead window:
$$\text{Memory}_{\text{lookahead}} = 6 \times 0.353\text{ MB} \approx 2.12\text{ MB per active track}$$
Even with 4 simultaneous active audio tracks, the lookahead consumes only $\sim 8.5\text{ MB}$, fitting comfortably within the 16 MB budget with zero risk of buffer underrun.

## 5. Concrete File & Class Signatures

### 5.1 `packages/core-web/src/index.ts`
```ts
export class LazyNeuralDepthStrategy implements IDepthEstimationStrategy {
  public readonly id = DepthStrategyId.DepthAnythingV2Small;
  public readonly name = 'depth-anything-v2-small';
  public readonly isSupported = true;
  private delegate: IDepthEstimationStrategy | null = null;
  public async estimateDepth(input: any, options?: any): Promise<any>;
}

export class LazyNeuralSegmentationStrategy implements ISubjectSegmentationStrategy {
  public readonly id = SegmentationStrategyId.Rmbg;
  public readonly name = 'rmbg';
  public readonly isSupported = true;
  private delegate: ISubjectSegmentationStrategy | null = null;
  public async segmentSubject(input: any, options?: any): Promise<any>;
}
```

### 5.2 `apps/studio/src/lib/audio/AudioAssetCache.ts`
```ts
export class AudioAssetCache {
  private readonly MAX_CACHE_ENTRIES = 4;
  private readonly MAX_TOTAL_PCM_BYTES = 16 * 1024 * 1024; // 16 MB ceiling
  ...
}
```

### 5.3 `apps/studio/src/components/ui/ModalProgressFallback.tsx`
```tsx
export interface ModalProgressFallbackProps {
  title?: string;
}
export function ModalProgressFallback(props: ModalProgressFallbackProps): JSX.Element;
```

## 6. Phased Roadmap

### Phase 1: Core Web Runtime Decoupling
- In `packages/core-web/src/index.ts`, replace static imports of `@acc/effect-engines` with `LazyNeuralDepthStrategy` and `LazyNeuralSegmentationStrategy`.
- Register algorithmic defaults (`HeuristicDepthStrategy`, `GrabCutFallbackStrategy`) as primary.

### Phase 2: Audio Engine & PCM Optimization
- In `apps/studio/src/lib/audio/AudioAssetCache.ts`, set `MAX_TOTAL_PCM_BYTES = 16MB` and `MAX_CACHE_ENTRIES = 4`.
- In `apps/studio/src/lib/audio/WebAudioEngine.ts`, adjust `syncFromIR` proximate lookahead to 6 seconds.

### Phase 3: Canvas Sizing & UI Layer Optimization
- In `apps/studio/src/components/preview/useViewportRenderStrategy.ts`, downscale `overlayCanvas` to `options.width` and `options.height`.
- In `apps/studio/src/components/Preview.tsx`, bypass overlay canvas clearing and guide drawing when `props.isPlaying` is true.
- In `apps/studio/src/lib/textures/AssetTextureCache.ts`, eliminate `hotVideoLRU` and reduce thumbnail/scratch limits.
- Create `apps/studio/src/components/ui/ModalProgressFallback.tsx`.
- In `apps/studio/src/components/Titlebar.tsx`, lazy-load `IrVisualEditorModal`, `OpfsExplorerModal`, and `ShortcutsModal` with `<Suspense>`.

### Phase 4: Worker Pipeline Limits
- In `apps/studio/src/renderer/workers/preview.worker.ts`, reduce `MAX_WORKER_TEXTURES` to 8.
- In `apps/studio/src/renderer/workers/WebCodecsDecoderPool.ts`, reduce default `maxHardwareDecoders` to 4.
- Verify `SequentialVideoReader.ts` circular ping-pong buffer is preserved untouched.

## 7. Formal Verification Matrix (`/autogenerated-tests/`)

| Test Suite File | Invariant Verified | Command |
| :--- | :--- | :--- |
| `studio_preview_playback_cadence.test.ts` | 0ms ping-pong slot swaps across 24, 30, and 60 FPS; seamless frame skips | `bun test autogenerated-tests/studio_preview_playback_cadence.test.ts` |
| `studio_offscreen_worker_parity.test.ts` | Mutex single-flight CanvasSink serialization | `bun test autogenerated-tests/studio_offscreen_worker_parity.test.ts` |
| `studio_render_strategy.test.ts` | Core-web client bootstrap and strategy abstraction | `bun test autogenerated-tests/studio_render_strategy.test.ts` |
| `studio_solid_migration_architecture.test.ts` | Zero React leakage, SolidJS fine-grained state reactivity | `bun test autogenerated-tests/studio_solid_migration_architecture.test.ts` |
| `@acc/studio` Production Build | Code-splitting of vendor-transformers, vendor-onnx, vendor-shiki | `pnpm --filter @acc/studio build` |

## 8. Risk & Rollback Mitigations

| Risk Scenario | Root Cause | Preventive Mitigation | Rollback Action |
| :--- | :--- | :--- | :--- |
| **Audio cache thrashing on rapid scrubs** | 16 MB PCM budget evicted too early | `getAudioChannels` re-decodes on demand via background promise deduplication | Bump `MAX_TOTAL_PCM_BYTES` to 24 MB |
| **Snapping guides misaligned** | Overlay canvas downscaled to $960\times 540$ | `renderGuides` receives `(ctx, virtualWidth(), virtualHeight(), guides)` matching CSS container scale | Scale canvas context with DPR |
| **Async modal load flicker** | Large chunk download delay | Sleek `<ModalProgressFallback />` spinner in Liquid Glass theme prevents blank dialog | Revert modal to static import |
