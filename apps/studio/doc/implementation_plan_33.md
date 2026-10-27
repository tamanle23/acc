# Implementation Plan 33 - Depth3DPlugin Sequence Asset Resolution and Inference Fix

## Problem
In Studio, `Depth3DPlugin` was failing to trigger depth estimation and neural subject cutout inference for sequences because:
1. Video IR sequences define media assets in `timeline.assets` via `sequence.assetId`, while `Depth3DPlugin.execute()` only checked `params.imagePath`. Since `params.imagePath` was undefined, preflight inference was completely bypassed.
2. `Depth3DPlugin.execute()` gated depth estimation behind `mode === 'depth_map_3d' || mode === 'mesh_displacement' || params.autoDepth`, skipping common 3D modes like `frame_breaker`, `parallax_25d`, etc.
3. Cache lookup in `renderClipSpace()` only looked at `params.imagePath` rather than candidate keys including `sequence.assetId` and `sequence.id`.
4. `IRPreviewEngine.worker.ts` did not forward `payload.assets` into `ModifierContext`.

## Proposed Solution
1. **ModifierContext & Worker Bridge**: Pass `assets` through `ModifierContext` across both in-process and background worker execution.
2. **Effective Image Path Resolution**: In `Depth3DPlugin.execute()`, resolve effective image path from `params.imagePath || assetDef?.src || seq?.src || assetId`.
3. **Broadened 3D Depth Trigger**: Ensure depth map generation triggers across all 3D modes (`frame_breaker`, `parallax_25d`, `depth_map_3d`, `volumetric_sandwich`, etc.).
4. **Multi-Key Cache Retrieval**: Store cutouts, depth layers, particle arrays, and background plates under `[imagePath, assetId, seq.id]` and look up against any available candidate key during `renderClipSpace()`.
5. **Node/Bun Worker Guard**: Guard `new Worker` in `StudioSidecarCoordinator` to avoid Web Worker thread exit crashes in headless test runners.
