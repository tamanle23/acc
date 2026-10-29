# Master Implementation Plan - Iteration 49
## `@acc/studio`: Comprehensive Refactoring, Strict Typing, Dead Code Pruning, Worker Pipeline Consolidation & React UI Performance Tuning

---

### 1. Executive Summary
`@acc/studio` is the high-performance non-linear video editing (NLE) web workstation of ACC, operating on React 19, Vite, Tailwind CSS v4, WebCodecs, Web Audio, and Web Workers. Over 42 iterative sprint cycles, the project has built rich capabilities (offscreen rendering, Mediabunny asset reading, procedural sound design, visual IR debugging). However, codebase analysis and build profiling reveal 5 concrete architectural pain points:
1. **Worker Topology Bifurcation & Redundancy**: `PreviewWorkerCoordinator` spawns a dedicated sidecar worker (`IRPreviewEngine.worker.ts`) for neural/vision modifier preflight, while `PreviewWorkerBridge` spawns `workers/preview.worker.ts` for OffscreenCanvas viewport compositing. However, `IRPreviewEngine.worker.ts` duplicates modifier plugin registrations, loads duplicate bundles (>1.1 MB chunk), and runs in an isolated thread that is disconnected from the main render worker.
2. **Type Looseness & Untyped Escapes**: Pervasive `as any` casts across `PreviewWorkerCoordinator.ts`, `SidecarTypes.ts`, and `ModifierControlStrategies.tsx`, where payload target entities are cast to `any` instead of strictly discriminated unions (`ResolvedTrack | ResolvedSequence`), and `light_vector` is handled at runtime but omitted from `ParamFieldType`.
3. **Canvas Offscreen Transfer Marker**: Monkey-patching `(canvas as any).__transferred = true` on `HTMLCanvasElement` instances directly violates TypeScript type safety and can leak across component unmounts/remounts.
4. **Vite Bundle Bloat & Static/Dynamic Chunk Pollution**: Heavy AI inference dependencies (`@huggingface/transformers` and `onnxruntime-web`) are bundled directly into the main index chunk (2,156 kB minified) due to mixed static/dynamic imports across vision strategies, triggering Rollup chunk warnings.
5. **Timeline Re-Render Overhead**: In `SequenceInspector.tsx`, historical references to `time` instead of `startFrame` / `durationFrames` cause type safety degradations, and non-memoized inspectors trigger full tree re-evaluations during playhead movement.

This master implementation plan establishes an enterprise-grade, clean, strictly typed, zero-regression roadmap adhering to `enterprise-clean-coder`, `typescript-coding`, and `react-shadcn-tailwind` invariants.

---

### 2. Trade-off & Architectural Decision Matrix

| Dimension | Current State | Target State | Trade-off / Architectural Rationale |
| :--- | :--- | :--- | :--- |
| **Worker Topology & Protocol Unification** | Two distinct workers: `IRPreviewEngine.worker.ts` (AI preflight) and `workers/preview.worker.ts` (Viewport compositor) | Unified single worker: Merge sidecar task handling into `preview.worker.ts`, re-point `PreviewWorkerCoordinator`, delete `IRPreviewEngine.worker.ts` | **Win:** Eliminates duplicate modifier plugin registrations, prevents double-loading heavy WASM runtimes (saves >1.1 MB worker chunk), ensures single coordinator lifecycle. |
| **Canvas Transferred Tracking** | `(canvas as any).__transferred = true` monkey-patched onto DOM element | `WeakSet<HTMLCanvasElement>` encapsulation (`CanvasTransferTracker` in `@acc/core-web`) | **Win:** Zero DOM pollution, pure garbage collection on canvas detachment, strict TypeScript compliance without `any`. |
| **Type Discriminated Unions** | `targetEntity: Record<string, unknown>` & `payload.targetEntity as any` | Discriminated union `SidecarTargetEntity = ResolvedTrack \| ResolvedSequence` with type predicates `isResolvedTrack` / `isResolvedSequence` | **Win:** Compile-time exhaustiveness checking, eliminates runtime undefined access, strictly adheres to `typescript-coding` guidelines. |
| **ParamFieldType Alignment** | `light_vector` used in `ModifierControlStrategies.tsx` but missing from `ParamFieldType` | Synchronize `ParamFieldType` in `packages/ir/src/plugins/ModifierPluginRegistry.ts` | **Win:** Seamless schema-to-UI binding, eliminates type casting in modifier property inspectors. |
| **Vite Manual Chunking** | Monolithic index bundle (2.15 MB) containing AI vision & transformers | Dynamic `manualChunks` isolating `vendor-ai` (`@huggingface/transformers`, `onnxruntime-web`) and `vendor-framework` (`react`, `react-dom`) | **Win:** Decreases initial page load payload by >55%; isolates heavy neural network WASM assets until vision modifiers are actively rendered. |
| **Component Memoization & Styling** | Mixed inline styles and unmemoized HUD cards | Strictly typed `cn()` Tailwind v4 utilities, `React.memo` with shallow parameter comparison on HUD cards | **Win:** Guarantees 60 FPS transport scrubbing without main thread drops. |

---

### 3. Mermaid Topology: Consolidated Engine & UI Boundary

```mermaid
flowchart TD
    subgraph UI_Presentation_Tier [React 19 Pure Presentation]
        Titlebar[Titlebar (Action Handlers & File IO)]
        LeftSidebar[LeftSidebar (Lazy Drawer Tabs & Presets)]
        PreviewViewport[Preview Viewport (Direct Canvas Surface)]
        TimelineDOM[Virtualized Timeline (Ruler + Track Lanes)]
        SequenceInspector[Sequence & Track Inspector (Context-Aware)]
    end

    subgraph Reactive_Store_Bridge [Zustand / useSyncExternalStore Bridge]
        StudioStore[Studio State (IR Document & Timeline)]
        PlayheadCtrl[StudioPlayheadController (High-Frequency Direct RAF)]
        CanvasTracker[CanvasTransferTracker (WeakSet Memory Safe)]
    end

    subgraph Coordinator_Facade [Renderer Pipeline Boundary]
        IRPreviewEngine[IRPreviewEngine (Single Facade)]
        RenderStrategy[WorkerRenderStrategy (Default) / MainThreadRenderStrategy]
        PreviewWorkerCoordinator[PreviewWorkerCoordinator (Sidecar Preflight Task Queue)]
    end

    subgraph Unified_Worker_Runtime [Unified Web Worker: preview.worker.ts]
        CompositorRouter["Message Router (Compositor + Sidecar)"]
        DecoderPool[WebCodecsDecoderPool]
        MemoryManager[PreviewFrameMemoryManager]
        ModifierExecutor["ModifierPluginRegistry (In-Worker Execution)"]
    end

    TimelineDOM -.->|60 FPS Direct Scrub| PlayheadCtrl
    PlayheadCtrl -.->|Direct RAF Needle Transform| TimelineDOM
    PlayheadCtrl -->|Frame Sync| IRPreviewEngine
    PreviewViewport -->|Mount HTMLCanvasElement| CanvasTracker
    CanvasTracker -->|Validate Transfer Safety| RenderStrategy
    RenderStrategy --> CompositorRouter
    IRPreviewEngine --> PreviewWorkerCoordinator
    PreviewWorkerCoordinator --> CompositorRouter
    CompositorRouter --> DecoderPool
    CompositorRouter --> MemoryManager
    CompositorRouter --> ModifierExecutor
    StudioStore --> IRPreviewEngine
```

---

### 4. Mathematical & Performance Specifications

1. **Scrub Latency Budget**:
   $$\Delta t_{\text{scrub}} = t_{\text{seek\_dispatch}} + t_{\text{worker\_decode}} + t_{\text{frame\_blit}} \le 16.67\,\text{ms}\quad (\text{guaranteeing } 60\text{ FPS})$$
2. **VRAM Ceiling Formula**:
   $$\text{MaxFrames}_{\text{cached}} = \min\left(48,\; \left\lfloor \frac{256 \times 10^6}{\text{width} \times \text{height} \times 4} \right\rfloor\right)$$
   Guarantees memory overhead under 256MB across all decoded transient video frames.
3. **Bundle Chunk Size Targets**:
   - `vendor-ai` (`@huggingface/transformers` + `onnxruntime-web`): isolated chunk $\approx 1.2\,\text{MB}$.
   - `vendor-shiki` (debugger syntax highlight): isolated chunk $\approx 195\,\text{kB}$.
   - `vendor-ui-primitives` (`@radix-ui/*`, `lucide-react`): isolated chunk $\approx 176\,\text{kB}$.
   - `index` (Studio Application Core): $< 900\,\text{kB}$ minified.

---

### 5. Concrete File & Class Signatures

#### 5.1 `CanvasTransferTracker` (`packages/core-web/src/canvas/CanvasTransferTracker.ts`)
```ts
export class CanvasTransferTracker {
  private static readonly transferred = new WeakSet<HTMLCanvasElement | object>();

  public static markTransferred(canvas: HTMLCanvasElement | object): void {
    if (canvas && typeof canvas === 'object') {
      this.transferred.add(canvas);
    }
  }

  public static isTransferred(canvas: HTMLCanvasElement | object): boolean {
    if (!canvas || typeof canvas !== 'object') {
      return false;
    }
    return this.transferred.has(canvas);
  }
}
```

#### 5.2 Strict Entity Type Predicates (`apps/studio/src/renderer/SidecarTypes.ts`)
```ts
import type { ResolvedTrack, ResolvedSequence, ModifierNode, AssetDefinition } from '@acc/ir';

export type SidecarTargetEntity = ResolvedTrack | ResolvedSequence;

export interface ExecuteModifierPayload {
  taskId: string;
  targetType: 'track' | 'sequence';
  targetId: string;
  targetEntity: SidecarTargetEntity;
  rawEntity?: unknown;
  modifier: ModifierNode;
  assets?: Record<string, AssetDefinition | { src: string; type?: string }>;
  fps: number;
  canvas: { width: number; height: number };
}

export function isResolvedTrack(entity: SidecarTargetEntity | unknown): entity is ResolvedTrack {
  return typeof entity === 'object' && entity !== null && 'sequences' in entity && Array.isArray((entity as ResolvedTrack).sequences);
}

export function isResolvedSequence(entity: SidecarTargetEntity | unknown): entity is ResolvedSequence {
  return typeof entity === 'object' && entity !== null && 'startFrame' in entity && 'durationFrames' in entity;
}
```

#### 5.3 Unified Worker Message Protocol (`apps/studio/src/renderer/SidecarTypes.ts` & `preview.worker.ts`)
```ts
export type SidecarMessage =
  | { type: 'WARMUP' }
  | { type: 'EXECUTE_MODIFIER'; payload: ExecuteModifierPayload }
  | { type: 'CANCEL_TASK'; taskId: string; targetId?: string }
  | { type: 'RESET' };

export type SidecarResponse =
  | { type: 'WARMED_UP' }
  | {
    type: 'MODIFIER_EXECUTED';
    taskId: string;
    targetId: string;
    modifierType: string;
    state?: Record<string, unknown>;
  }
  | { type: 'TASK_CANCELED'; taskId: string; targetId?: string }
  | { type: 'ERROR'; taskId?: string; targetId?: string; error: string };
```

---

### 6. Phased Implementation Roadmap

#### Phase 1: Type Synchronization & Invariant Hardening [COMPLETED]
- [x] Target 1: `packages/ir/src/plugins/ModifierPluginRegistry.ts`
  - Added `'light_vector'` to `ParamFieldType`.
- [x] Target 2: `apps/studio/src/renderer/SidecarTypes.ts`
  - Strongly typed `SidecarTargetEntity = ResolvedTrack | ResolvedSequence` with `rawEntity?: unknown`.
  - Added type predicates `isResolvedTrack` and `isResolvedSequence`.
  - Strongly typed `modifier` as `ModifierNode`.
- [x] Target 3: `apps/studio/src/renderer/PreviewWorkerCoordinator.ts`
  - Removed unsafe `payload.targetEntity as any` casts.
  - Replaced `(window as any).requestIdleCallback` with global `Window` augmentation in `apps/studio/src/types/globals.d.ts`.
- [x] Target 4: `packages/ir/src/renderer/audio/UniversalAudioMixer.ts`
  - Added null-safe navigation `timeline.meta?.globalFps || 30` to eliminate test mock crashes.

#### Phase 2: Canvas Memory Safety & WeakSet Transfer Tracker [COMPLETED]
- [x] Target 1: `packages/core-web/src/canvas/CanvasTransferTracker.ts`
  - Created `CanvasTransferTracker` utilizing `WeakSet<HTMLCanvasElement | object>`.
  - Exported via `packages/core-web/src/index.ts`.
- [x] Target 2: `apps/studio/src/renderer/workers/PreviewWorkerBridge.ts`
  - Replaced `(canvas as any).__transferred = true` with `CanvasTransferTracker.isTransferred(canvas)` and `markTransferred(canvas)`.
  - Added `dispose()` method.
- [x] Target 3: `autogenerated-tests/timeline_worker_and_virtualization.test.ts`
  - Migrated test to assert `CanvasTransferTracker.isTransferred(mockCanvas) === true`.

#### Phase 3: Worker Protocol Unification & Dead Worker Retirement
- **Target 1**: `apps/studio/src/renderer/workers/preview.worker.ts`
  - Integrate sidecar message handlers (`WARMUP`, `EXECUTE_MODIFIER`, `CANCEL_TASK`, `RESET`).
  - Wire in-worker `registerCoreModifierPlugins()` to execute modifier preflight tasks and reply with `SidecarResponse`.
- **Target 2**: `apps/studio/src/renderer/PreviewWorkerCoordinator.ts`
  - Change worker initialization URL from `./IRPreviewEngine.worker.ts` to `./workers/preview.worker.ts`.
- **Target 3**: `apps/studio/src/renderer/IRPreviewEngine.worker.ts`
  - Grep monorepo to ensure zero remaining references.
  - Delete `IRPreviewEngine.worker.ts` permanently.
- **Target 4**: Autogenerated Tests Verification
  - Run `studio_sidecar_coordinator.test.ts`, `studio_preview_engine_worker_decoupling.test.ts`, and `studio_offscreen_worker_parity.test.ts`.

#### Phase 4: Vite Bundle Optimization & AI Chunk Splitting
- **Target**: `apps/studio/vite.config.ts`
  - Configure `rollupOptions.output.manualChunks` to split:
    - `vendor-ai`: `@huggingface/transformers`, `onnxruntime-web`.
    - `vendor-framework`: `react`, `react-dom`.
    - `vendor-ui-primitives`: `@radix-ui/`, `@base-ui/`, `lucide-react`.
    - `vendor-syntax`: `shiki`.
    - `vendor-audio`: `wavesurfer.js`.
  - Run `pnpm --filter @acc/studio build` to confirm index chunk size drops below 1,000 kB.

#### Phase 5: UI Inspector & Modifier Control Cleanliness
- **Target 1**: `apps/studio/src/components/inspector/ModifierControlStrategies.tsx`
  - Ensure all control strategies strictly match `ParamFieldType`.
  - Type all handlers and component parameters without `any`.
- **Target 2**: `apps/studio/src/components/inspector/KeyframeDiamondButton.tsx`
  - Fix tooltip attributes conforming strictly to Radix UI / custom Tooltip interface.

#### Phase 6: Formal Verification & Autogenerated Tests Execution
- Run `bun test autogenerated-tests/studio_*.test.ts`.
- Run `bun test autogenerated-tests/modifier_plugin_registry_studio_integration.test.ts`.
- Verify `pnpm --filter @acc/studio build` passes cleanly with optimized chunk boundaries.

---

### 7. Formal Verification Matrix (`/autogenerated-tests/`)

| Test File | Verification Objective | Success Criteria |
| :--- | :--- | :--- |
| `studio_preview_engine_worker_decoupling.test.ts` | Verify `IRPreviewEngine` decupling from `PreviewWorkerCoordinator` | Pass 6/6 assertions without missing `timeline.meta.globalFps` errors |
| `studio_sidecar_coordinator.test.ts` | Verify `PreviewWorkerCoordinator` in-process task execution & worker isolation | Pass 4/4 assertions |
| `studio_offscreen_worker_parity.test.ts` | Verify `preview.worker.ts` protocol and ring buffer execution | Pass 2/2 assertions |
| `timeline_worker_and_virtualization.test.ts` | Verify `CanvasTransferTracker` transfer idempotence | Pass 5/5 assertions |
| `studio_phase3_decomposition_and_60fps.test.ts` | Verify modular component boundaries and 60 FPS timeline memoization | Pass 8/8 assertions |
| `studio_canvas_transform.test.ts` | Verify canvas pan/zoom transforms and coordinate mapping | Pass all assertions |
| `modifier_plugin_registry_studio_integration.test.ts` | Verify `ParamFieldType` alignment including `light_vector` and custom schemas | Pass 5/5 assertions |

---

### 8. Risk Assessment & Rollback Mitigations

| Risk | Probability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| Deleting `IRPreviewEngine.worker.ts` breaks lingering callers | Low | Medium | Strict git grep verification prior to deletion; route all tasks via `workers/preview.worker.ts`. |
| Splitting `vendor-ai` chunk breaks dynamic WASM asset location | Medium | High | Verify `ort-wasm-simd-threaded.asyncify` path resolution remains relative to dist output via Vite's asset URL mechanism. |
| In-worker modifier execution contends with OffscreenCanvas frame loop | Low | Medium | Execute modifiers asynchronously within the worker event loop; heavy neural models remain lazily loaded. |
