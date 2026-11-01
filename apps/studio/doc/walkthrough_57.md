# Studio Companion Walkthrough - Walkthrough 57
# Studio Preview Canvas Dimensions & Decoupled Level of Detail (LOD) Architecture

## 1. Overview
This document specifies the exact architectural contracts, coordinate pipelines, and execution flows for:
1. How `#studio-canvas` receives its physical pixel buffer width/height vs its CSS viewport display bounds.
2. How the Level of Detail (LOD) scaling system operates dynamically across playback and parked states.
3. How the core Video IR rendering engine (`IRCanvasCompositor`) remains strictly decoupled from LOD scaling.

---

## 2. Canvas Dimensions Architecture

The `#studio-canvas` element operates across two decoupled layers:

### Layer A: Physical Pixel Buffer Resolution (`canvas.width` & `canvas.height`)
The internal raster buffer dimensions dictate the maximum rendered detail:
1. **Source of Truth**: Defined in the active Video IR Document:
   - `width = irState.doc.meta.canvasSize.w || 1920`
   - `height = irState.doc.meta.canvasSize.h || 1080`
   - Referenced in [`Preview.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Preview.tsx#L67-L68).
2. **Dynamic Virtual Buffer Scaling**:
   - The buffer dimensions are scaled by `activeScale` (LOD):
     ```typescript
     const virtualWidth = Math.max(320, Math.round(width * activeScale));
     const virtualHeight = Math.max(180, Math.round(height * activeScale));
     ```
   - Referenced in [`Preview.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Preview.tsx#L95-L96).
3. **Execution Delivery**:
   - **Web Worker Pipeline (Default)**:
     - The DOM canvas is transferred via `canvas.transferControlToOffscreen()` in [`PreviewWorkerBridge.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/PreviewWorkerBridge.ts#L289).
     - The worker sets `canvas.width = currentWidth` and `canvas.height = currentHeight` on `init` and `resize` messages in [`preview.worker.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/preview.worker.ts#L426-L427).
   - **Main-Thread Pipeline (Fallback)**:
     - When running without OffscreenCanvas, [`MainThreadRenderStrategy.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/renderer/strategies/MainThreadRenderStrategy.ts#L162-L167) directly sets `this.canvas.width = width` and `this.canvas.height = height`.

### Layer B: CSS / DOM Display Dimensions
The visual on-screen size is managed responsively without altering the underlying pixel buffer:
1. **Canvas Element (`#studio-canvas`)**:
   - Styled with `className="w-full h-full object-contain block bg-black"` in [`ViewportCanvasLayer.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/preview/ViewportCanvasLayer.tsx#L19-L28).
   - `object-contain` ensures the canvas fills the viewport container without aspect ratio distortion or stretching.
2. **Responsive Outer Viewport Container**:
   - The container in [`Preview.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Preview.tsx#L306-L324) bounds the canvas:
     ```tsx
     <div
       style={{
         aspectRatio: `${width} / ${height}`,
         maxHeight: '68vh',
         maxWidth: isTelemetryCompanionOpen ? '72vw' : '82vw',
         transform: panZoom.zoomLevel === 'fit'
           ? 'none'
           : `translate(${panZoom.panOffset.x}px, ${panZoom.panOffset.y}px) scale(${panZoom.zoomLevel})`,
       }}
     >
     ```

---

## 3. Level of Detail (LOD) Scaling Architecture

The Preview LOD engine optimizes performance during high-frequency playback while preserving full quality when parked for editing:

### Active Resolution Modes
Configured via `previewResolution` state in [`Preview.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Preview.tsx#L85-L93):

| Mode | Parked State (`!isPlaying`) | Playback State (`isPlaying`) | Hardware Target |
| :--- | :---: | :---: | :--- |
| **`auto`** (Default) | `1.0x` (100% Full) | `0.5x` (50% Half) | Dynamic balance between editing clarity and 60 FPS playback |
| **`1.0`** (Full) | `1.0x` (100% Full) | `1.0x` (100% Full) | Workstations with dedicated discrete GPUs |
| **`0.5`** (Half) | `0.5x` (50% Half) | `0.5x` (50% Half) | Standard laptops and integrated GPUs |
| **`0.25`** (Quarter) | `0.25x` (25% Quarter) | `0.25x` (25% Quarter) | Low-spec or battery-saver environments |

### Pipeline Adaptation
1. **Input Configuration Adaptation**:
   - In [`useViewportRenderStrategy.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/preview/useViewportRenderStrategy.ts#L81), the timeline is shallow-cloned using `withTargetCanvasSize(timeline, width, height)`:
     - Mutates `meta.canvasSize = { w: virtualWidth, h: virtualHeight }` on the clone in $O(1)$ time.
     - Preserves the original `VideoIRDocument` and original `timeline` completely immutable.
2. **Worker GPU Smoothing Optimization**:
   - In [`preview.worker.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/renderer/workers/preview.worker.ts#L235-L238):
     ```typescript
     if (lod < 1.0) {
       backCtx.imageSmoothingEnabled = true;
       backCtx.imageSmoothingQuality = 'low'; // Fast bilinear filtering
     }
     ```
3. **Core Engine Decoupling Invariant**:
   - [`IRCanvasCompositor.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/ir/src/renderer/shared/IRCanvasCompositor.ts) contains **0 references to LOD or virtual scaling**.
   - The core compositor strictly evaluates integer frames and draws at 1:1 scale for whatever canvas size is passed in `timeline.meta.canvasSize`.
   - Both Preview and Headless Export use the exact same canonical `IRCanvasCompositor` code path with 100% mathematical parity.

---

## 4. Verification
- `bun test autogenerated-tests/preview_playback_smoothness.test.ts` (5 pass)
- `bun test autogenerated-tests/video_resolution_standards_and_aspect_presets.test.ts` (11 pass)
- `bun test autogenerated-tests/ir_canvas_compositor_phase2.test.ts` (5 pass)
- `pnpm --filter studio exec vite build` (Built with exit code 0)
