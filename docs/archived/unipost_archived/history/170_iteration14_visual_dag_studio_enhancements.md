# History Log 170 — Iteration 14: Visual DAG Studio & Execution Inspector Enhancements

## Problem Statement
While Visual DAG Studio provided robust design and execution time-travel playback, developers and operators experienced several UX bottlenecks:
1. Navigating from `/workflow-executions` to inspect individual execution graphs required a disruptive full-page transition, breaking table scanning context.
2. In large decision trees and DAG branches, distinguishing which execution paths were traversed versus which branches were skipped or bypassed required manual inspection of individual node states.
3. Parallel tasks (`FORK_JOIN`, `DYNAMIC_FORK`) were rendered topologically as separate node branches without clear timing, latency, or concurrency visualization.
4. Authors in the visual designer had no zero-side-effect way to dry-run test a newly designed workflow topology with mock inputs before publishing to production.

## Plan & Architecture
Execute `docs/integration_master_plan_iteration14.md`:
1. **Workstream 1**: Master-detail slide-over execution inspection drawer on `/workflow-executions` table row click, and traversed-path lighting (`stroke-emerald-500` glowing edges) / dead-branch dimming on DAG canvas.
2. **Workstream 2**: Concurrency flamegraph and Gantt timeline view for parallel execution branches with bidirectional cross-hover synchronization between timeline bars and DAG nodes.
3. **Workstream 3**: Zero-side-effect in-memory designer dry-run simulation harness (`POST /api/v1/workflow/definitions/simulate` on backend, `WorkflowDryRunModal` on console).

## Changes Made

### 1. Master-Detail Execution Drawer & Path Lighting
- **`apps/console/src/components/data-table/data-table.tsx`**: Added `onRowClick?: (row: TData) => void` callback support to standard `DataTable`.
- **`apps/console/src/features/workflow-executions/components/workflow-executions-table.tsx`**: Wired `onRowClick` to set the clicked row as active and trigger the inspection drawer.
- **`apps/console/src/features/workflow-executions/components/workflow-execution-detail-drawer.tsx`**: Built slide-over inspection drawer embedding `VisualDagStudio` in `mode="execution"` with live SSE streaming.
- **`apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`**: Added `decoratedEdges` memo computing traversed paths (illuminated emerald stroke with pulse animation) versus bypassed branches (30% opacity dashed lines).

### 2. Concurrency Flamegraph & Gantt Timeline
- **`apps/console/src/features/metadata/components/studio/workflow-execution-flamegraph.tsx`**: Created flamegraph component plotting scheduled, wait, and execution durations with status badges and synchronized hover events.
- **`apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`**: Added Graph vs. Timeline view toggle buttons in the execution mode toolbar, rendering either `ReactFlow` or `WorkflowExecutionFlamegraph`.

### 3. Designer Dry-Run Simulator Harness
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/WorkflowEngineService.java`**: Implemented `simulateExecution(WorkflowDefinition definition, Map<String, Object> inputPayload, long nowEpochMs)` evaluating execution logic purely in-memory without persistence calls.
- **`apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowDefinitionController.java`**: Added `POST /api/v1/workflow/definitions/simulate` endpoint.
- **`apps/console/src/features/workflows/api/workflow-api.ts`**: Added `useSimulateWorkflowDefinition` TanStack Query mutation hook.
- **`apps/console/src/features/metadata/components/studio/workflow-dry-run-modal.tsx`**: Created simulation modal with `VisualJsonEditor` for mock input payloads.
- **`apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`**: Added "Dry Run" button (`data-testid="dag-dry-run-btn"`) in authoring toolbar and wired simulation results to update canvas node states.

## Verification
- `pnpm --filter @acc/console exec tsc --noEmit` exited `0`.
- `pnpm --filter @acc/console test:run` passed 100% (73 test files, 338 tests passing).
- `node mvnw.cjs test-compile -pl workflow-engine,acc-ms-aio -q` exited `0`.
