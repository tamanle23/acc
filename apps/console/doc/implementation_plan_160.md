# Console Implementation Plan - Iteration 160: Visual DAG Studio Modularization, Performance Tuning & Unified Execution Contracts

## 1. Problem & Context
1. `visual-dag-studio.tsx` is over 1,000 lines long; frequent SSE ticks trigger full-tree re-evaluations.
2. In `workflow-execution-stream-modal.tsx`, `workflowExecution.workflowId` is incorrectly passed as `workflowKey`, resulting in 404 definition lookups.
3. In `apps/console/src/features/workflow-executions/api/use-workflow-executions.ts`, the query points to `/api/workflow/executions` rather than the standard `/api/v1/workflow/executions`.
4. Canvas nodes lack edge-aware keyboard navigation for WCAG 2.2 AA accessibility.

## 2. Proposed Changes
- **`apps/console/src/features/workflows/components/studio/`**:
  - Decompose `visual-dag-studio.tsx` into:
    - `DagCanvasContainer.tsx`
    - `DagCommandBar.tsx`
    - `DagDebuggerBar.tsx`
    - `DagModalsContainer.tsx`
  - Memoize `DagWorkflowNodeComponent` with `React.memo` and shallow comparator.
  - Implement edge-aware keyboard navigation (Arrow keys along graph edges, Enter to open Inspector) and ARIA live regions.
- **`apps/console/src/features/workflow-executions/`**:
  - Fix definition key resolution in `workflow-execution-stream-modal.tsx`.
  - Harmonize `use-workflow-executions.ts` to call `/v1/workflow/executions` with graceful sandbox fallback.
- **`packages/sandbox/src/handlers/workflow-handler.ts`**:
  - Add support for `/api/v1/workflow/executions` with pagination.

## 3. Verification Plan
- `pnpm --filter @acc/console test -- src/features/workflows`
- `pnpm --filter @acc/console test -- src/features/workflow-executions`
- `pnpm --filter @acc/sandbox test`
- `pnpm --filter @acc/console check-types`
