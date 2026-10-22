# 184. Decompose Visual DAG Studio Monolith & Reorganize Workflow Subgroups

## Problem Statement
`visual-dag-studio.tsx` in `apps/console/src/features/workflows/components/studio/` grew into a 2,367-line giant component mixing canvas orchestration, node/edge state handling, undo/redo snapshots, auto-layout algorithms, SSE execution synchronization, timeline scrubber intervals, diffing logic, and numerous modals/drawers. Furthermore, `apps/console/src/features/workflows/components` had a flat, unorganized structure mixing catalog tables, execution drawers, and migration modals directly in the parent directory.

## Plan & Architecture
1. **Subgroup Domain Decomposition**:
   - Reorganize `apps/console/src/features/workflows/components/` into `catalog/`, `execution/`, `migration/`, and `studio/`.
   - Reorganize `studio/` into modular subdirectories: `canvas/`, `toolbar/`, `palette/`, `inspectors/`, `timeline/`, `modals/`, `hooks/`, and `utils/`.
   - Maintain backward-compatible barrel exports across `components/index.ts` and `studio/index.ts`.
2. **Component & Hook Extraction**:
   - Extract `DagHeaderCommandBar`, `DagDebuggerSubpill`, and `DagValidationBanner` to `studio/toolbar/`.
   - Extract state management and keyboard shortcuts to `useDagStudioState`.
   - Extract SSE execution stream synchronization and time-travel replay logic to `useDagExecutionSync`.
   - Extract sample and initial graph datasets to `dag-sample-data.ts`.
3. **Refactor Orchestrator**:
   - Rewrite `visual-dag-studio.tsx` to compose the extracted hooks and presentational subcomponents, shrinking the file by over 61% (from 2,367 down to 909 lines).

## Changes Made
- `apps/console/src/features/workflows/components/catalog/`:
  - `workflow-catalog-columns.tsx`, `workflow-catalog-table.tsx`, `workflow-create-dialog.tsx`, `index.ts`.
- `apps/console/src/features/workflows/components/execution/`:
  - `execution-run-drawer.tsx`, `execution-time-travel-scrubber.tsx`, `payload-diff-viewer.tsx`, `index.ts`.
- `apps/console/src/features/workflows/components/migration/`:
  - `fleet-migration-modal.tsx`, `hot-migration-modal.tsx`, `index.ts`.
- `apps/console/src/features/workflows/components/studio/toolbar/`:
  - `dag-header-command-bar.tsx`, `dag-debugger-subpill.tsx`, `dag-validation-banner.tsx`, `index.ts`.
- `apps/console/src/features/workflows/components/studio/hooks/`:
  - `use-dag-studio-state.ts`, `use-dag-execution-sync.ts`, `index.ts`.
- `apps/console/src/features/workflows/components/studio/utils/`:
  - `dag-sample-data.ts`, `workflow-ir-converter.ts`, `index.ts`.
- `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`:
  - Cleaned and refactored orchestrator.
- `apps/console/src/features/workflows/components/studio/index.ts`:
  - Barrel re-exporting all submodules.
- `apps/console/src/features/workflows/components/index.ts`:
  - Root barrel export.
- `apps/console/src/features/workflows/index.tsx`:
  - Updated subgroup imports.

## Verification
- `pnpm --filter @unipost/console test -- src/features/workflows/`: 19 test files passed, 83/83 tests green.
- `pnpm --filter @unipost/console exec tsc --noEmit`: 0 type errors.

## Walkthrough & Artifacts
- Plan: `apps/console/doc/implementation_plan_146.md`
- Walkthrough: `apps/console/doc/walkthrough_146.md`
