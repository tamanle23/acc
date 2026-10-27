# [052] Isolated Pipeline Architecture - Phase 1

**1. Context & Problem Statement**: 
Following the new `ARCHITECTURE_VISION.md`, the monolithic `src/renderer.ts` file was highly coupled, meaning failures in optional features (like AI Upscaling or 3D Depth) could crash the entire rendering job. We needed to transition towards an isolated pipeline using plugins and an immutable asset registry to guarantee zero-regression stability.

**2. Implementation Plan**: 
- Implement a centralized `Logger` class.
- Define `IPlugin`, `RenderContext`, and `AssetContext` to manage immutable state and assets.
- Extract upscaling logic into `UpscalerPlugin` which wraps everything in safe `try/catch` blocks, falling back to original assets if the upscaler fails (e.g. download failures or execution errors).
- Wrap `renderDepth3DScene` inside `renderer.ts` with a `try/catch` that gracefully falls back to `renderSingleScene` (2D render) if 3D mesh generation fails.
- Migrate `renderer.ts` to orchestrate this new Pipeline and fetch from the Asset Registry.

**3. Changes Made**: 
- Added `src/core/logger.ts` for standardized `[Timestamp] [Namespace] Message` logging.
- Added `src/core/AssetContext.ts` and `src/core/IPlugin.ts` to define the middleware structures.
- Added `src/plugins/UpscalerPlugin.ts` migrating inline logic out of the renderer.
- Modified `src/renderer.ts`:
  - Removed in-place mutations (e.g. `scene.resolvedImage = ...`).
  - Added the plugin execution loop.
  - Cloned the `scene` object during rendering (`sceneToRender = { ...scene }`) to inject the preferred asset without mutating the source configuration.
  - Implemented 3D Depth fallback to 2D rendering.

**4. Verification & Walkthrough**: 
- TypeScript checks passed for the modified files.
- The pipeline securely manages assets without destructive mutation.
- The system is now fault-tolerant to upscaler or 3D depth failure.
