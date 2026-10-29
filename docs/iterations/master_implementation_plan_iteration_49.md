# Master Implementation Plan - Iteration 49
## `@acc/studio`: Comprehensive Refactoring, Strict Typing, Dead Code Pruning, Worker Pipeline Consolidation & React UI Performance Tuning

---

### Executive Summary
`@acc/studio` is the high-performance non-linear video editing (NLE) web workstation of ACC, operating on React 19, Vite, Tailwind CSS v4, WebCodecs, Web Audio, and Web Workers. Over 42 iterative sprint cycles, the project has built rich capabilities (offscreen rendering, Mediabunny asset reading, procedural sound design, visual IR debugging). However, rapid feature development has led to:
1. **Module & Case Resolution Inconsistencies**: Duplicate re-exports in `src/components/index.ts` referencing both PascalCase and lowercase paths (`./Preview` vs `./preview`, `./Timeline` vs `./timeline`), breaking strict TS compiler environments.
2. **Duplicated Worker Infrastructure**: Concurrent existence of legacy `IRPreviewEngine.worker.ts` alongside modern `workers/preview.worker.ts` and `PreviewWorkerBridge.ts`, creating confusion in worker lifecycle management.
3. **Type Looseness & `any` Escapes**: Multiple unsafe casts (`as any`, `unknown as Record<string, unknown>`) across coordinator and strategy modules that bypass domain safety.
4. **Vite Bundle Bloat & Static/Dynamic Hybrid Import Warnings**: Direct monolithic bundle size warnings (>2.4 MB index bundle) due to ONNX runtime models and Hugging Face transformer static imports in renderer sidecars.
5. **Timeline & Viewport Render Cascades**: Un-memoized selector subscriptions triggering full track DOM tree re-renders during high-frequency playhead movements (60 FPS scrub).

This plan outlines a zero-regression, comprehensive improvement roadmap to make `@acc/studio` clean, strictly typed, performant, and maintainable.

---

### Trade-off & Architectural Decision Matrix

| Dimension | Current State | Target State | Trade-off / Rationale |
| :--- | :--- | :--- | :--- |
| **Component Barrel Exports** | Mixed casing exports in `src/components/index.ts` | Clean single-casing barrel exports matching on-disk components | **Win:** Eliminates TS1149 casing collisions across case-insensitive filesystems (Windows/macOS). |
| **Worker Architecture** | Two preview worker implementations (`IRPreviewEngine.worker.ts` vs `workers/preview.worker.ts`) | Consolidate onto single `preview.worker.ts` orchestrated by `PreviewWorkerCoordinator` | **Win:** Single source of truth for OffscreenCanvas decoding; removes 250+ lines of duplicate logic. |
| **Type Integrity & RootDir** | Permissive tsconfig without `noImplicitAny` & external relative imports | Explicit typings, elimination of `as any` in renderer strategies, clean tsconfig boundaries | **Win:** Zero compiler regressions, true enterprise clean code. |
| **Vite Bundle & Code Splitting** | Monolithic index bundle (2.5 MB) importing heavy AI sidecars | Dynamic `manualChunks` in `vite.config.ts` separating ONNX/Transformers and Shiki JSON highlighter | **Win:** Drastic reduction of initial load latency; isolates AI vision weight chunks until requested. |
| **Playhead & Scrubber React Renders** | Direct DOM-linked playhead state causing component tree reconciliations | RAF-driven decoupled transform styling for ruler & scrubber with memoized track bars | **Win:** Stable 60 FPS playback on 4K timelines without React main thread jank. |

---

### Mermaid Topology: Consolidated Engine & UI Boundary

```mermaid
flowchart TD
    subgraph UI_Layer [React 19 Pure Presentation]
        Titlebar[Titlebar (Action Handlers)]
        LeftSidebar[LeftSidebar (Lazy Drawer Tabs)]
        PreviewViewport[Preview Viewport (Direct Canvas Surface)]
        TimelineDOM[Virtualized Timeline (Ruler + Tracks)]
    end

    subgraph Reactive_Bridge [Reactive Store & Command Dispatch]
        Store[useSyncExternalStore (Segmented Slices)]
        CommandHistory[Command Stack (Undo / Redo)]
        MasterClock[SMPTE Master Clock (RAF Decoupled)]
    end

    subgraph Renderer_Facade [Renderer Pipeline Boundary]
        IRPreviewEngine[IRPreviewEngine (Single Facade)]
        RenderStrategy[WorkerRenderStrategy (Default) / MainThreadFallback]
        Coordinator[PreviewWorkerCoordinator (Singleton)]
    end

    subgraph Worker_Tier [Consolidated Worker Runtime]
        PreviewWorker[workers/preview.worker.ts]
        DecoderPool[WebCodecsDecoderPool]
        MemoryManager[PreviewFrameMemoryManager]
    end

    TimelineDOM -.->|High-frequency scrubbing (60fps)| MasterClock
    MasterClock -.->|Direct RAF Timestamp| IRPreviewEngine
    IRPreviewEngine --> RenderStrategy
    RenderStrategy --> Coordinator
    Coordinator --> PreviewWorker
    PreviewWorker --> DecoderPool
    PreviewWorker --> MemoryManager
    Store --> IRPreviewEngine
    CommandHistory --> Store
```

---

### Mathematical & Performance Specifications

1. **Scrub Latency Bound**:
   $$\Delta t_{\text{scrub}} = t_{\text{seek\_dispatch}} + t_{\text{worker\_decode}} + t_{\text{frame\_blit}} \le 16.67\,\text{ms}\quad (\text{guaranteeing } 60\text{ FPS})$$
2. **VRAM Ceiling Formula**:
   $$\text{MaxFrames}_{\text{cached}} = \min\left(48,\; \left\lfloor \frac{256 \times 10^6}{\text{width} \times \text{height} \times 4} \right\rfloor\right)$$
   Guarantees memory overhead under 256MB across all decoded transient video frames.
3. **Bundle Chunk Isolation**:
   - Vendor Chunk 1: `@huggingface/transformers` + `onnxruntime-web` (isolated).
   - Vendor Chunk 2: `shiki` (debugger syntax highlight).
   - Core Studio Chunk: $< 800\,\text{kB}$ minified.

---

### Concrete Implementation Roadmap

#### Phase 1: Clean Component Index & Case Sensitivity Normalization
- Target: `apps/studio/src/components/index.ts`
- Fix duplicate re-exports (`./Preview` vs `./preview`, `./Timeline` vs `./timeline`).
- Ensure all component imports across `src/` reference the exact on-disk casing.

#### Phase 2: Consolidate Worker Infrastructure & Remove Dead Files
- Target: `apps/studio/src/renderer/IRPreviewEngine.worker.ts` & `src/renderer/workers/preview.worker.ts`
- Verify that `IRPreviewEngine.worker.ts` is obsolete and superseded by `workers/preview.worker.ts`.
- Prune `IRPreviewEngine.worker.ts` and consolidate any residual sidecar initialization logic into `PreviewWorkerCoordinator.ts`.
- Clean up unused imports and orphan types in `src/renderer/SidecarTypes.ts`.

#### Phase 3: Enterprise Clean Typing & Removal of `any` Escapes
- Refactor `PreviewWorkerCoordinator.ts`, `MainThreadRenderStrategy.ts`, and `WorkerRenderStrategy.ts`:
  - Replace `payload.targetEntity as any` with discriminated union types from `@acc/ir`.
  - Fix `ModifierControlStrategies.tsx` type definitions (`ParamFieldType`, `ModifierNode` union matching).
  - Clean up `(canvas as any).__transferred` via symbol-keyed internal properties or weak maps (`WeakSet<HTMLCanvasElement>`).

#### Phase 4: Vite Code Splitting & Manual Chunks Optimization
- Target: `apps/studio/vite.config.ts`
- Configure `rollupOptions.output.manualChunks`:
  ```ts
  manualChunks: {
    'vendor-react': ['react', 'react-dom'],
    'vendor-radix': ['radix-ui', '@base-ui/react'],
    'vendor-syntax': ['shiki'],
    'vendor-audio': ['wavesurfer.js'],
  }
  ```
- Suppress or solve externalized Node module warnings (`crypto`, `fs`, `path`) cleanly for client-only builds.

#### Phase 5: Timeline & Viewport Re-Render Performance Optimization
- In `src/components/Timeline.tsx` and `src/components/timeline/`:
  - Verify that scrub movements only mutate CSS transform / SVG playhead paths without triggering re-render of virtual track sequences.
  - Wrap track sequence items in `React.memo` with custom equality checks (`prevProps.sequence === nextProps.sequence && prevProps.zoom === nextProps.zoom`).

#### Phase 6: Formal Verification & Autogenerated Tests Execution
- Run `bun test autogenerated-tests/studio_*.test.ts`.
- Ensure all test suites pass with zero regressions.
- Verify `pnpm --filter @acc/studio build` finishes cleanly.

---

### Risk Assessment & Rollback Mitigations

| Risk | Probability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| Deleting `IRPreviewEngine.worker.ts` breaks legacy callers | Low | Medium | Grep entire codebase for `IRPreviewEngine.worker` references; ensure coordinator routes all worker jobs through `workers/preview.worker.ts`. |
| Rollup manual chunking breaks dynamic WASM loading | Medium | High | Keep `ort-wasm-simd-threaded.asyncify` asset handling intact; test production preview build locally with `vite preview`. |
| Strict type fixes in Inspector surface schema mismatch | Low | Low | Align with latest `VideoIR` type definitions in `packages/ir/src/types/modifiers.ts`. |
