# Implementation Plan 43: `@acc/studio` Codebase Cleanliness, Typing & Performance Consolidation

## Executive Overview
Complementing [master_implementation_plan_iteration_49.md](file:///c:/Users/Admin/workspace/git/acc/docs/iterations/master_implementation_plan_iteration_49.md), this plan details app-specific cleanup tasks within `apps/studio`:

1. **Remove Casing Inconsistencies & Duplicate Exports**:
   - Clean `apps/studio/src/components/index.ts` to remove colliding duplicate exports (`preview`, `timeline`).
2. **Consolidate Web Worker Runtime**:
   - Retire obsolete `IRPreviewEngine.worker.ts` in favor of unified `workers/preview.worker.ts`.
3. **Strict TypeScript & Zero Unchecked Casts**:
   - Remove `as any` and `unknown as Record<string, unknown>` from `PreviewWorkerCoordinator.ts` and renderer strategies.
   - Fix inspector type signatures in `ModifierControlStrategies.tsx` and `KeyframeDiamondButton.tsx`.
4. **Vite Bundle Chunking & Optimization**:
   - Configure code splitting in `apps/studio/vite.config.ts` for heavy third-party libs (`shiki`, Radix UI, Wavesurfer).
5. **Timeline Render Performance Tuning**:
   - Memoize track sequences to prevent full tree reconciliation during playhead scrub.
