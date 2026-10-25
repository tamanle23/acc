# 180. Clean Migration of Visual DAG Studio to Workflows Domain

## Problem
Visual DAG Studio components (`visual-dag-studio.tsx`, `dag-node.tsx`, `dag-palette.tsx`, `workflow-ir-converter.ts`, etc.) were historically nested inside `apps/console/src/features/metadata/components/studio/` alongside metadata entity schema designers. Because DAG workflows represent Conductor orchestration models and operational workflows rather than entity-attribute-relationship metadata schemas, this created architectural coupling and confusion between the Metadata and Workflows domains.

## Plan
1. Move all 27 Visual DAG Studio files from `apps/console/src/features/metadata/components/studio/` to `apps/console/src/features/workflows/components/studio/` via `git mv`.
2. Create `apps/console/src/features/workflows/components/studio/index.ts` consolidating exports for all DAG components.
3. Clean `apps/console/src/features/metadata/components/studio/index.ts` of all DAG exports with zero re-export aliases.
4. Update all consumers across `@acc/console` to import directly from `@/features/workflows/components/studio`.
5. Run full TypeScript compilation and test suites to verify 0 regressions.

## Changes
- **Moved Files**: 27 files (components, edges, inspectors, dialogs, and tests) migrated to `apps/console/src/features/workflows/components/studio/`.
- **Barrel Files**:
  - `apps/console/src/features/workflows/components/studio/index.ts`: Exporting `VisualDagStudio`, `DagNodeComponent`, `DagPalette`, `WorkflowIrConverter`, `WorkflowExecutionFlamegraph`, `WorkflowDryRunModal`, `WorkflowVariableWatchDrawer`, `DagSelectionToolbar`, `DagQuickInsertPopover`, `TaskTelemetryInspector`, `TimeTravelScrubber`, `DagConditionEdge`, `DagEdgeConditionModal`, and all node types/enums.
  - `apps/console/src/features/metadata/components/studio/index.ts`: Retains strictly `visual-schema-studio.tsx`, `attribute-palette.tsx`, `dynamic-form-live-preview.tsx`, `fsm-workflow-designer.tsx`, and composite bento studio components.
- **Consumers Updated**:
  - `apps/console/src/features/workflow-executions/components/workflow-execution-detail-drawer.tsx`
  - `apps/console/src/features/workflow-executions/components/workflow-execution-stream-modal.tsx`
  - `apps/console/src/features/workflows/api/workflow-api.ts`
  - `apps/console/src/features/workflows/components/workflow-catalog-table.tsx`
  - `apps/console/src/features/workflows/components/workflow-create-dialog.tsx`
  - `apps/console/src/features/workflows/hooks/use-workflow-execution-stream.ts`
  - `apps/console/src/features/workflows/index.tsx`

## Verification
- `pnpm --filter @acc/console test -- src/features/workflows/components/studio/`: 12 test files passed, 53 tests passed.
- `pnpm --filter @acc/console test -- src/features/metadata/components/studio/`: 3 test files passed, 15 tests passed.
- `git grep -n "features/metadata/components/studio" apps/console/src/`: 0 references found in source code.
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.

## Walkthrough
Refer to [`walkthrough_142.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/walkthrough_142.md) for details.
