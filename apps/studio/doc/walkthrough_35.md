# Walkthrough 35: Studio Phase 1 — Dead Code & Pipeline Consolidation

## Summary of Changes
1. **Removed Dead Legacy Sidebar (`Sidebar.tsx`)**: Deleted 1,317 lines of unused code superseded by `LeftSidebar.tsx` and `RightSidebar.tsx`.
2. **Unified Web Worker Preview Pipeline (`src/renderer/workers/`)**:
   - Merged `PreviewWorkerBridge`, `PreviewRenderWorkerCore`, and `DecodedFrameCache` into `apps/studio/src/renderer/workers/PreviewWorkerBridge.ts` with `[Symbol.dispose]()` and duplicate `transferControlToOffscreen` guard.
   - Moved `preview.worker.ts` into `apps/studio/src/renderer/workers/preview.worker.ts` and deleted `src/lib/worker/`, `src/lib/workers/`, and `src/lib/timeline/strategies/`.
3. **Consolidated `AssetTextureCache`**:
   - Unified `IPreviewTextureProvider` methods and bounded eviction (`MAX_CACHE_ENTRIES = 128`) into `apps/studio/src/lib/textures/AssetTextureCache.ts`.
   - Converted `apps/studio/src/renderer/AssetTextureCache.ts` into a pure re-export.
4. **Pruned Unused UI & Shiki Grammars**:
   - Removed unused chat UI components and restricted `apps/studio/src/lib/highlighter.tsx` to `json`, saving >1 MB of bundle output.

## Verification
- Passed 20/20 unit tests across 5 test suites (`bun test`).
- Verified clean Vite production build (`pnpm --filter @acc/studio build` in 15.11s).
