# 414: Video Resolution Standards and Aspect Ratio Presets

## Problem
Previously, projects relied on arbitrary, preconfigured canvas dimensions (`width` and `height` in `meta.canvasSize`). This caused multiple architectural and user-experience issues:
1. Users were exposed to arbitrary pixel width/height inputs without alignment to industry delivery standards.
2. Core renderers (`IRCanvasCompositor`) were conflating preview virtual LOD scaling with logical sequence coordinate math via internal scale state (`scaleX`, `scaleY`, `isVirtualScaled`).
3. Modifier pixel coordinates (like translation in `TransformModifierPlugin` or dimensions in `ShapeModifierPlugin`) did not scale proportionally when exporting or rendering at different delivery resolutions (e.g. 1080p vs 4K UHD).
4. Export configurations and safe guides lacked native aspect ratio awareness and platform-specific danger zones (e.g., TikTok/Reels UI zones vs broadcast safe frames).

## Plan
1. **Industry Aspect Ratio Standards Catalog**:
   - Establish strict 7 industry aspect ratios (`16:9`, `9:16`, `1:1`, `4:5`, `21:9`, `4:3`, `2.39:1`).
   - Define canonical 1080p-class dimensions and export delivery presets (Full HD, 2K QHD, 4K UHD, etc.).
   - Implement `withTargetCanvasSize(timeline, w, h)` for O(1) shallow-cloned execution without mutating timeline state.
2. **VideoIR Schema 8-Point Synchronization**:
   - Add `aspectRatio?: StandardAspectRatio` to `IRMeta` in `VideoIR.ts` and `video-ir.schema.json`.
   - Update `VideoIRSchemaValidator.ts` with auto-migration to infer aspect ratio for legacy documents.
   - Synchronize `docs/ir/1. video_(IR)_specification.md`.
3. **Decouple Core Renderer from LOD / Virtual Scaling**:
   - Refactor `IRCanvasCompositor.ts` to operate purely 1:1 on provided `canvasSize`.
   - Remove virtual scaling properties from compositor context.
   - Preview LOD scaling passes adapted input configurations (`withTargetCanvasSize`) so the compositor remains ignorant of LOD.
4. **Render-Time Proportional Coordinate Scaling**:
   - In `TransformModifierPlugin` and `ShapeModifierPlugin`, scale pixel offsets relative to canonical reference dimensions (`getReferenceDimensionsForCanvas`).
5. **Studio UI & Export Pipeline Modernization**:
   - Replace arbitrary width/height inputs in `ProjectInspector` with a visual 7-preset Aspect Ratio Grid with wireframe silhouettes.
   - Add clickable Base Aspect Ratio badge in `Titlebar` linking to project settings.
   - Build auto-adaptive `ViewportSafeGuides` (16:9 Title/Action Safe vs 9:16 TikTok/Reels Social frame).
   - Modernize `ExportConfigModal` with native aspect ratio presets, bitrate guidance, and WebCodecs dispatch.

## Changes

### 1. IR Core & Video Standards Catalog
- `packages/ir/src/standards/VideoStandardsCatalog.ts`:
  - Created catalog with `ASPECT_RATIO_PRESETS`, `VIDEO_EXPORT_PRESETS`.
  - Implemented `getCanonicalCanvasSize`, `inferAspectRatioFromCanvasSize`, `getReferenceDimensionsForCanvas`, `getExportPresetsForAspectRatio`, and `withTargetCanvasSize`.
- `packages/ir/src/types/VideoIR.ts`: Added `aspectRatio?: StandardAspectRatio` to `IRMeta`.
- `schema/video-ir.schema.json`: Added `aspectRatio` enum schema validation under `IRMeta`.
- `docs/ir/1. video_(IR)_specification.md`: Documented `aspectRatio` metadata and migration behavior.
- `packages/ir/src/schema/VideoIRSchemaValidator.ts`: Added auto-migration in `migrateDocument()` and validation in `validate()`.
- `packages/ir/src/renderer/shared/IRCanvasCompositor.ts`: Cleaned up rendering to operate purely 1:1 without LOD/virtual scaling state.
- `packages/ir/src/plugins/transform/TransformModifierPlugin.ts`: Scaled motion translations proportionally relative to reference canvas dimensions.
- `packages/ir/src/plugins/shape/ShapeModifierPlugin.ts`: Scaled geometry offsets and dimensions relative to reference canvas dimensions.
- `packages/ir/src/plugins/index.ts` & `packages/ir/src/index.ts`: Re-exported standards catalog and plugins.

### 2. Studio Application Components
- `apps/studio/src/lib/commands/UpdateProjectMetaCommand.ts`: Added aspect ratio updating with sequence re-centering.
- `apps/studio/src/components/inspector/ProjectInspector.tsx`: Implemented visual 7-preset Aspect Ratio Grid with Liquid Glass cards and removed arbitrary pixel inputs.
- `apps/studio/src/components/Titlebar.tsx`: Added clickable Base Aspect Ratio Pill next to the project title.
- `apps/studio/src/components/preview/ViewportSafeGuides.tsx`: Added adaptive safe guides rendering 16:9 Title/Action safe lines and 9:16 Reels/TikTok danger zones.
- `apps/studio/src/components/preview/useViewportRenderStrategy.ts`: Fed `withTargetCanvasSize` for virtual preview rendering.
- `apps/studio/src/components/Preview.tsx`: Dynamic container `aspectRatio: ${width} / ${height}` and adaptive safe guides integration.
- `apps/studio/src/components/preview/TransformGizmoOverlay.tsx` & `useGizmoTransform.ts`: Dynamically use active width/height instead of hardcoded 1920x1080.
- `apps/studio/src/components/ExportConfigModal.tsx`: Complete modal with aspect ratio banner, export presets, bitrate calculation, and client export triggering.
- `apps/studio/src/lib/export/ClientExportOrchestrator.ts`: Wrapped export timeline with `withTargetCanvasSize`.
- `apps/studio/src/App.tsx`: Wired `ExportConfigModal` state and user actions.

## Verification
- **Automated Tests**:
  - `bun test autogenerated-tests/video_resolution_standards_and_aspect_presets.test.ts`: **11 passed, 0 failed**.
  - `bun test autogenerated-tests/ir_schema_sync_iteration5.test.ts`: **3 passed, 0 failed**.
  - `bun test autogenerated-tests/architectural_canvas_and_timeline_decoupling.test.ts`: **9 passed, 0 failed**.
- **Production Vite Build**:
  - `pnpm --filter studio exec vite build`: **Built in 11.65s with 0 errors**.

## Walkthrough
1. **Setting Base Aspect Ratio**: When opening the project inspector or clicking the titlebar aspect ratio pill, users choose from 7 industry aspect ratios (`16:9`, `9:16`, `1:1`, `4:5`, `21:9`, `4:3`, `2.39:1`).
2. **Preview Viewport & LOD**: The canvas container adapts dynamically with CSS `aspectRatio`. Virtual preview buffers adapt using `withTargetCanvasSize` while core rendering executes 1:1.
3. **Safe Guides**: Guides dynamically adapt to show broadcast safe areas for widescreen ratios and social danger zones (top header, bottom caption/sound pill, right action buttons) for 9:16 vertical video.
4. **Multi-Resolution Export**: When exporting, `ExportConfigModal` displays the native aspect ratio with "Optimal Quality" indicator, listing matched resolution presets from 720p draft to 4K UHD. Modifiers scale proportionally between 1080p and 4K without coordinate skew.

## Tasks
- [x] Create `VideoStandardsCatalog` with 7 aspect ratios and delivery presets.
- [x] Update VideoIR schema and validator with auto-migration.
- [x] Decouple `IRCanvasCompositor` from LOD/virtual scaling.
- [x] Implement proportional render-time coordinate scaling in transform and shape plugins.
- [x] Update ProjectInspector with Aspect Ratio Grid and remove arbitrary pixel inputs.
- [x] Add clickable titlebar aspect ratio badge.
- [x] Implement adaptive ViewportSafeGuides.
- [x] Create ExportConfigModal with WebCodecs export dispatch.
- [x] Verify via automated test suite and production build.

## Enhancement
- Future enhancement: Support custom crop/letterbox conform modes (e.g. pan-and-scan vs fit/pillarbox) when migrating existing sequences between disparate aspect ratios (e.g. 16:9 to 9:16).
