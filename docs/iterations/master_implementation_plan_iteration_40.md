# Master Implementation Plan - Iteration 40: Studio Viewport Pipeline & Architecture Modernization

## 1. Executive Summary & Context

The `apps/studio` viewport subsystem is the interactive core for rendering, visual composition, direct manipulation, and timeline playback. Over several feature releases (OffscreenCanvas Web Worker pipeline, Sidecar AI preflight inference, 3D Pop-Out depth warping, 2D Vector Gizmo handles, dynamic safe guides, and WebAudio integration), incremental implementation has led to architectural entropy:
1. **Duplicate Texture Caches**: Two conflicting implementations of `AssetTextureCache.ts` (`src/renderer/` vs `src/lib/textures/`).
2. **Monolithic God Component (`Preview.tsx`)**: ~852 lines coupling 5 orthogonal domains (worker lifecycle, canvas transfer, playhead tick coalescing, `@dnd-kit` gizmo calculations, and fallback rendering).
3. **Split Worker Topologies**: Viewport compositor worker (`src/lib/worker/preview.worker.ts`) vs AI preflight worker (`src/renderer/IRPreviewEngine.worker.ts`) with differing message wrappers and scattered utility workers.
4. **Scattered Render Strategies**: Ad-hoc `if (workerRef.current) ... else ...` branching distributed across React effects.

This iteration establishes a clean, enterprise-grade architecture adhering to:
- **Enterprise Clean Code**: SOLID principles, Single Responsibility Principle (SRP), Strategy Pattern, Factory Pattern, and explicit lifecycle resource management.
- **UI/UX Design Systems**: WCAG 2.2 AA accessibility, Fitts's Law touch/click target geometry, 5-state component resilience, non-blocking 60 FPS viewport compositing, and Liquid Glass design tokens.
- **Polyglot & Multi-Thread Architecture**: Isomorphic contracts, decoupled Web Workers, zero-alloc transferable memory (`ImageBitmap`), and safe main-thread fallback negotiation.

---

## 2. Target System Architecture

```mermaid
graph TD
    subgraph UI_Presentation_Layer["UI Presentation Layer (apps/studio/src/components/)"]
        PreviewHost["Preview.tsx (~140 lines)\nDeclarative Composition Host"]
        
        subgraph Modular_Overlays["Co-located Overlays (src/components/preview/)"]
            CanvasLayer["ViewportCanvasLayer\n(Base Video Canvas + Guide Overlay Canvas)"]
            ControlBar["ViewportControlBar\n(Zoom, Passes, Safe Guides, Telemetry)"]
            GizmoOverlay["TransformGizmoOverlay\n(Bounding Box, Handles, Action Pill)"]
            LightGizmo["LightGizmoOverlay\n(3D Point Light Manipulator)"]
            HitOverlay["UniversalCanvasHitOverlay\n(Polymorphic Hit Detection)"]
            DropOverlay["StagingDropTargetOverlay\n(Asset Drag-and-Drop Staging)"]
            TelemetryCard["TelemetryCompanionCard\n(Dockable Viewport Diagnostics)"]
            TextEditorModal["InlineTextEditorModal\n(Floating Text/Subtitle Editor)"]
        end
        
        PreviewHost --> CanvasLayer
        PreviewHost --> ControlBar
        PreviewHost --> GizmoOverlay
        PreviewHost --> LightGizmo
        PreviewHost --> HitOverlay
        PreviewHost --> DropOverlay
        PreviewHost --> TelemetryCard
        PreviewHost --> TextEditorModal
    end

    subgraph Domain_Hooks_Layer["Domain Hooks (src/components/preview/hooks/)"]
        HookRender["useViewportRenderStrategy\nStrategy Lifecycle, Texture Sync & Frame RPC"]
        HookGizmo["useGizmoTransform\n@dnd-kit Sensors, Drag/Rotate Math & Snap Guides"]
        HookPanZoom["useViewportPanZoom\nFit/Ratio Zoom, Spacebar Panning & Offsets"]
        HookHotkeys["usePreviewHotkeys\nGlobal Keybindings (Space, V, Ctrl+D, Del, Esc)"]
    end

    subgraph Strategy_Abstraction_Layer["Render Strategy Abstraction (src/renderer/strategies/)"]
        IStrategy["<<interface>>\nIPreviewRenderStrategy\n- init(canvas)\n- updateTimeline(timeline, ...)\n- syncTextures(activeSeqs, ...)\n- renderFrame(frame, opts)\n- resize(w, h)\n- dispose()"]
        WorkerStrategy["WorkerRenderStrategy\n(OffscreenCanvas + PreviewWorkerBridge)"]
        MainThreadStrategy["MainThreadRenderStrategy\n(IRPreviewEngine + IRCanvasCompositor)"]
        StrategyFactory["createPreviewRenderStrategy()\nAuto-Negotiation & Capability Check"]

        IStrategy <|.. WorkerStrategy
        IStrategy <|.. MainThreadStrategy
        StrategyFactory --> IStrategy
    end

    subgraph Engine_Infrastructure_Layer["Engine & Worker Infrastructure"]
        AuthoritativeCache["Authoritative AssetTextureCache\n(Singleton in src/lib/textures/)"]
        AdapterCache["AssetTextureCache Adapter\n(Adapter in src/renderer/AssetTextureCache.ts)"]
        CompositorWorker["preview.worker.ts\n(60 FPS Viewport Frame Compositing)"]
        SidecarCoordinator["StudioSidecarCoordinator\n(Background AI Vision Preflight)"]
        SidecarWorker["IRPreviewEngine.worker.ts\n(ONNX WebGPU Depth & Vision Inference)"]
    end

    PreviewHost --> HookRender
    PreviewHost --> HookGizmo
    PreviewHost --> HookPanZoom
    PreviewHost --> HookHotkeys

    HookRender --> StrategyFactory
    HookRender --> AuthoritativeCache
    HookRender --> SidecarCoordinator

    WorkerStrategy --> CompositorWorker
    MainThreadStrategy --> AuthoritativeCache
    SidecarCoordinator --> SidecarWorker
    AdapterCache --> AuthoritativeCache
```

---

## 3. Four Core Architectural Pillars

### Pillar 1: Unification of Asset Texture Caches
- **Decision Alignment**: Drop ContentCacheRegistry integration for now to preserve direct synchronous `CanvasImageSource` / `HTMLCanvasElement` / `ImageBitmap` in-memory references and avoid serialization overhead on 60 FPS playback.
- **Problem**: `apps/studio/src/renderer/AssetTextureCache.ts` is an outdated 95-line class wrapping object URLs. `apps/studio/src/lib/textures/AssetTextureCache.ts` is the active, feature-rich 436-line engine handling HTMLImageElement, HTMLVideoElement, Canvas, SVG, thumbnail generation, procedural HUDs, and event listeners.
- **Action**:
  1. Standardize on `apps/studio/src/lib/textures/AssetTextureCache.ts` as the single authoritative singleton.
  2. Transform `apps/studio/src/renderer/AssetTextureCache.ts` into a lightweight backward-compatible adapter that re-exports and delegates to `src/lib/textures/AssetTextureCache.ts`. It will support:
     - `new AssetTextureCache()` in test suites (`autogenerated-tests/studio_ir_preview_engine_phase1.test.ts`).
     - `AssetTextureCache.getInstance()` in UI components.
  3. Ensure thread-safe texture transfer (`createImageBitmap`) and disposal mechanisms remain pristine without memory leaks.

---

### Pillar 2: Viewport Strategy Pattern (`IPreviewRenderStrategy`)
- **Problem**: Conditional checks (`if (workerRef.current) ... else if (mainThreadEngine.current) ...`) pollute component lifecycle across mounting, timeline updates, texture sync, and frame rendering.
- **Solution**: Implement the GoF Strategy Pattern:
  ```typescript
  export interface IPreviewRenderStrategy {
    readonly id: 'worker' | 'main-thread';
    readonly isReady: boolean;
    init(canvas: HTMLCanvasElement): Promise<boolean>;
    updateTimeline(
      timeline: ResolvedTimeline,
      totalFrames: number,
      fps: number,
      assets: Record<string, any>
    ): void;
    syncTextures(
      activeSeqs: ResolvedSequence[],
      assets: Record<string, any>,
      currentFrame: number,
      fps: number
    ): Promise<void>;
    renderFrame(frame: number, options?: WorkerRenderOptions): void;
    resize(width: number, height: number): void;
    dispose(): void;
  }
  ```
  - **`WorkerRenderStrategy`**: Uses `HTMLCanvasElement.transferControlToOffscreen()` + `PreviewWorkerBridge.ts` (60 FPS non-blocking Web Worker).
  - **`MainThreadRenderStrategy`**: Uses `IRPreviewEngine` + `IRCanvasCompositor` directly on the main thread (for headless tests, legacy Safari, or restricted WebViews).
  - **`createPreviewRenderStrategy()`**: Factory that automatically negotiates capabilities (detecting `HTMLCanvasElement.prototype.transferControlToOffscreen` and Web Worker availability) with seamless fallback.

---

### Pillar 3: Decomposition of `Preview.tsx` (God Component)
`Preview.tsx` will be refactored from ~852 lines down to ~140 lines by extracting orthogonal concerns into co-located hooks:

| Target File | Extracted Concern | Description |
| :--- | :--- | :--- |
| `src/components/preview/useViewportRenderStrategy.ts` | Strategy Lifecycle & RPC | Manages `IPreviewRenderStrategy`, auto-negotiation, fallback, texture sync (`createImageBitmap`), and frame dispatch. |
| `src/components/preview/useGizmoTransform.ts` | Gizmo & Snapping Math | Handles `@dnd-kit` pointer sensors, normalized bounding boxes, magnetic grid snapping via `Gizmo2DTransformation`, and commits to `IRStateManager`. |
| `src/components/preview/useViewportPanZoom.ts` | Pan & Zoom Navigation | Handles zoom levels (`fit`, `0.5x`, `1.0x`, `2.0x`), spacebar pan activation, mouse drag offsets, and centering calculations. |
| `src/components/preview/usePreviewHotkeys.ts` | Global Keyboard Ergonomics | Handles keyboard shortcuts (`Space` for pan/play, `Shift+V` pass cycle, `Ctrl/Cmd+D` duplicate, `Del/Backspace` remove, `Esc` deselect). |
| `src/components/Preview.tsx` | Declarative Host | Composes the hooks and mounts the existing UI layers (`ViewportCanvasLayer`, `TransformGizmoOverlay`, `LightGizmoOverlay`, `ViewportControlBar`, `TelemetryCompanionCard`, `InlineTextEditorModal`). |

---

### Pillar 4: UI/UX & Liquid Glass Design System Integrity
- **Design Tokens & Visual Style**: Ensure all overlays and control bars maintain `glass-panel`, `liquid-ambient-mesh`, `glass-pill`, and specular border styling (`border-white/20 dark:border-white/10`).
- **5-State Component Resilience**:
  - *Default*: Clean 16:9 canvas with background checkerboard / black canvas.
  - *Interactive*: Hover, active drag handles, snapping line feedback (`activeGuides`).
  - *Loading*: OffscreenCanvas transfer placeholder / skeleton preview state.
  - *Empty State*: Helpful staging drop target indicator with clear drag guidance.
  - *Error*: Graceful main-thread fallback banner if Web Worker initialization fails.
- **Accessibility & Ergonomics (WCAG 2.2 AA)**:
  - Fitts's law compliance: Adequate hit targets for transform handles and action pills.
  - High-contrast visual snapping guides with distinct dashed lines.
  - Keyboard focus rings and aria attributes on all interactive overlay triggers.

---

## 4. Step-by-Step Implementation Plan

### Phase 1: Texture Cache Consolidation
1. Transform `apps/studio/src/renderer/AssetTextureCache.ts` into a backward-compatible adapter delegating to `apps/studio/src/lib/textures/AssetTextureCache.ts`.
2. Ensure both `new AssetTextureCache()` and `AssetTextureCache.getInstance()` share the same underlying texture pool.
3. Verify test suites: `bun test autogenerated-tests/studio_texture_cache.test.ts autogenerated-tests/studio_ir_preview_engine_phase1.test.ts`.

### Phase 2: Render Strategy Abstraction
1. Create `apps/studio/src/renderer/strategies/IPreviewRenderStrategy.ts`.
2. Implement `apps/studio/src/renderer/strategies/WorkerRenderStrategy.ts` wrapping `PreviewWorkerBridge`.
3. Implement `apps/studio/src/renderer/strategies/MainThreadRenderStrategy.ts` wrapping `IRPreviewEngine`.
4. Create factory `apps/studio/src/renderer/strategies/index.ts` with capability negotiation.
5. Add unit tests for render strategies in `autogenerated-tests/studio_render_strategy.test.ts`.

### Phase 3: Domain Hooks Extraction
1. Implement `apps/studio/src/components/preview/useViewportPanZoom.ts`.
2. Implement `apps/studio/src/components/preview/useGizmoTransform.ts`.
3. Implement `apps/studio/src/components/preview/usePreviewHotkeys.ts`.
4. Implement `apps/studio/src/components/preview/useViewportRenderStrategy.ts`.
5. Export hooks from `apps/studio/src/components/preview/index.ts`.

### Phase 4: `Preview.tsx` Refactoring & Decomposition
1. Refactor `apps/studio/src/components/Preview.tsx` to consume the new domain hooks.
2. Verify all overlays (`ViewportCanvasLayer`, `ViewportControlBar`, `TransformGizmoOverlay`, `LightGizmoOverlay`, `UniversalCanvasHitOverlay`, `TelemetryCompanionCard`, `InlineTextEditorModal`) mount cleanly.
3. Validate strict line-count target (< 200 lines, down from 852 lines).

### Phase 5: Verification & Zero-Regression Parity
1. Run test suite: `bun test autogenerated-tests/studio_*.test.ts`.
2. Run TypeScript build check: `pnpm --filter @acc/studio check-types`.
3. Verify visual parity:
   - 60 FPS viewport playback without main-thread frame drops.
   - Vector gizmo dragging, aspect-ratio locking, and magnetic grid snapping.
   - 3D Depth Map and vision pass cycling (`Shift+V`).
   - Staging drop preset insertion from catalog.

---

## 5. Architectural Decision Records (ADRs)

| Decision | Rationale | Alternatives Considered |
| :--- | :--- | :--- |
| **Keep 2 Separate Workers** (Compositor vs Preflight) | Decouples high-frequency 60 FPS viewport rendering from compute-heavy AI inference (ONNX WebGPU depth/segmentation). If AI inference spikes, the preview playback does not drop frames. | Merging into a single mega-worker (rejected due to frame stalling during model loading/inference). |
| **Consolidate Texture Cache to `src/lib/textures/` & Drop ContentCacheRegistry for now** | The singleton in `src/lib/textures/` is already heavily integrated with Timeline, App, and Preview, supporting video thumbnails, procedural HUD, and direct `CanvasImageSource` references. `ContentCacheRegistry` operates on raw `Uint8Array` binary bytes and would incur serialization overhead on high-frequency 60 FPS frames. | Forcing ContentCacheRegistry conversion or maintaining duplicate classes. |
| **Strategy Pattern (`IPreviewRenderStrategy`) with Auto-Negotiation** | Enables seamless switching between Web Worker (`OffscreenCanvas` 60 FPS non-blocking) and Main-Thread (`IRPreviewEngine` fallback for headless tests or unsupported environments). | Hardcoding worker branches in React components. |
| **Co-locate Preview Hooks in `src/components/preview/`** | Colocating `useViewportRenderStrategy`, `useGizmoTransform`, `useViewportPanZoom`, and `usePreviewHotkeys` alongside `ViewportCanvasLayer` and `TransformGizmoOverlay` keeps viewport-domain logic organized without scattering. | Generic `src/hooks/` root. |
| **Extract Gizmo Math to Hook** | Keeps UI rendering declarative and allows unit-testing drag/snap/scale math in isolation. | Retaining gizmo math inside `Preview.tsx` (violates SRP, leads to 852-line files). |
