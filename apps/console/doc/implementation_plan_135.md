# Implementation Plan: Iteration 14 — Visual DAG Studio Dual-Mode Architecture & Runtime Operations Experience

## Goal Description
Elevate the **Visual DAG Studio** across both **Workflow Definition Authoring (`/workflows`)** and **Workflow Execution Operations (`/workflow-executions`)**. Decouple authoring from runtime operations, add inline master-detail execution inspection with traversed-path highlighting, provide a concurrency flamegraph/Gantt timeline for parallel task profiling, implement an authoring dry-run simulation harness, and provide single-click failure remediation.

---

## User Review Required

> [!IMPORTANT]
> - **Dual Operational Modes**: Authoring Mode (`mode="full"`, `executionId=undefined`) completely hides debugger controls and node breakpoint circles to ensure a clean canvas during workflow design.
> - **Zero Stubs in Dry-Run**: The dry-run simulation harness in Phase 3 executes the pure decider logic in memory (`WorkflowEngineService.simulateExecution`) without writing dirty execution records to PostgreSQL, keeping production databases clean while providing realistic evaluation of decision trees and input expressions.
> - **No Breaking Changes**: Existing REST APIs, SSE endpoints, and data table layouts maintain 100% backward compatibility.

---

## Proposed Changes

### Workstream 1: Workflow Execution Inline Master-Detail & Path Highlighting

#### [NEW] `apps/console/src/features/workflow-executions/components/workflow-execution-detail-drawer.tsx`
- Slide-over drawer embedding `VisualDagStudio` in `mode="execution"` with live SSE streaming (`useWorkflowExecutionStream`).
- Displays execution status, tenant, run duration, and real-time logs alongside the graph.

#### [MODIFY] `apps/console/src/features/workflow-executions/components/workflow-executions-table.tsx`
- Add single-click row inspection opening the detail drawer directly from the table.

#### [MODIFY] `apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`
- Compute traversed vs. dead/bypassed branches using node execution states and switch decision outputs.
- Style traversed edges with animated glowing pulses (`stroke-emerald-500` / `stroke-sky-500`) and dim untraversed branches (30% opacity, dashed strokes).

---

### Workstream 2: Concurrency Flamegraph & Gantt Timeline View

#### [NEW] `apps/console/src/features/metadata/components/studio/workflow-execution-flamegraph.tsx`
- Horizontal waterfall bars plotting tasks by start timestamp.
- Displays worker lease acquisition, queue wait time (striped pattern), execution duration (solid fill), and retry attempts.
- Interactive cross-highlighting: hovering over a bar in the flamegraph highlights the matching node on the DAG canvas.

#### [MODIFY] `apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`
- Add a view switcher toggle in the execution toolbar: `Graph View` vs. `Timeline View`.

---

### Workstream 3: Designer Dry-Run Simulation Harness

#### [MODIFY] `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/application/WorkflowEngineService.java`
- Implement `simulateExecution(WorkflowDefinition definition, Map<String, Object> inputPayload)`:
  - Runs pure decider steps in-memory.
  - Returns simulated node statuses and variable maps without invoking database `saveWorkflowExecution`.

#### [MODIFY] `apps/backend/unipost-ms-aio/src/main/java/com/unipost/aio/controller/workflow/WorkflowDefinitionController.java`
- Expose `POST /api/v1/workflow/definitions/simulate` accepting workflow IR and mock input parameters.

#### [NEW] `apps/console/src/features/metadata/components/studio/workflow-dry-run-modal.tsx`
- Modal in authoring mode allowing designers to enter test input JSON via `VisualJsonEditor` and launch a local dry-run.
- Renders simulated paths directly on the canvas as an ephemeral preview.

---

### Workstream 4: Contextual Variable Autocomplete & Failed Task Remediation

#### [NEW] `apps/console/src/features/metadata/components/studio/dag-variable-autocomplete.tsx`
- Popover that analyzes topological ancestor nodes of the active task.
- Suggests available dot-paths (`${workflow.input.*}`, `${taskRef.output.*}`) when editing input parameters.

#### [NEW] `apps/console/src/features/metadata/components/studio/task-remediation-dialog.tsx`
- Inline dialog on failed nodes (`FAILED` state).
- Shows failure stack trace, allows inline JSON input parameter adjustment, and dispatches `POST /api/v1/workflow/executions/{id}/tasks/{ref}/rerun`.

---

## Verification Plan

### Automated Tests
```bash
# 1. Backend tests for simulate execution
cd apps/backend && node mvnw.cjs test -pl workflow-engine,unipost-ms-aio -q

# 2. Console unit tests across studio and execution components
pnpm --filter @unipost/console exec vitest run src/features/metadata/components/studio/
pnpm --filter @unipost/console exec vitest run src/features/workflow-executions/

# 3. TypeScript compilation check
pnpm --filter @unipost/console exec tsc --noEmit
```

### Manual Verification
1. **Design Mode (`/workflows`)**:
   - Open a workflow definition. Verify toolbar contains only authoring tools (`Auto-Layout`, `Validate`, `Dry Run`, `Save DAG`).
   - Click "Dry Run", enter sample JSON input, and verify the simulated execution route lights up on the canvas.
2. **Execution Mode (`/workflow-executions`)**:
   - Click any execution row. Verify the slide-over drawer opens with the live DAG and active SSE status.
   - Verify traversed edges glow green while unvisited/bypassed branches are dimmed.
   - Switch to "Timeline View" tab and verify the concurrency flamegraph renders task bars with hover synchronization.
