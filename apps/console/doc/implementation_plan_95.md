# Implementation Plan 95: Refactor /tasks into Workflow Execution Units & Visual DAG Studio Alignment

## 1. Goal & Architectural Overview
Refactor the existing `/tasks` screen, data schema, and routes in `@unipost/console` so that **a Task is fundamentally modeled and presented as an Execution Unit of a Workflow Definition / Plan**, establishing complete consistency with the **Visual DAG Studio** (`/workflows`).

### Current Problem
- `/tasks` currently renders an isolated, generic Kanban/Todo-style table (`TASK-8782`, `Bug`, `Feature`, `Todo`, `In Progress`, `Done`) disconnected from the Workflow Orchestration Engine and Visual DAG Studio.
- Tasks in the distributed workflow engine (`TaskInstance`, `task_queue`, `TaskSnapshot`) carry rich orchestration semantics:
  - `workflowExecutionId` / `workflowKey` (the parent workflow plan instance)
  - `taskReferenceName` (node key in the DAG)
  - `taskType` (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `WAIT`, `DO_WHILE`)
  - Execution states (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `TIMED_OUT`)
  - Worker lease information (`leaseOwner`, `visibleAtEpochMs`, `attempt`, `retryCount`)
  - Input/Output data payloads & duration telemetry
- When an operator views `/tasks`, they should see the active and historical execution units dispatched by workflow DAGs, with direct one-click navigation to inspect the parent workflow's visual execution graph in the **Visual DAG Studio**.

```
+-----------------------------------------------------------------------------------+
|                            Visual DAG Studio (/workflows)                         |
|   Workflow Definition Plan: "order-fulfillment-v1"                                |
|   [inventoryCheck] ---> [routeShipping] ---> [expressCourier] ---> [dispatch]     |
+------------------------------------------+----------------------------------------+
                                           | triggers execution
                                           v
+-----------------------------------------------------------------------------------+
|                        Execution Units Ledger (/tasks)                            |
|                                                                                   |
|  Task ID       Workflow Plan Ref     Type       Worker Lease      Status          |
|  -------------------------------------------------------------------------------  |
|  tsk_9102_1    order-fulfillment-v1  SIMPLE     worker-node-1     COMPLETED  [>]  |
|  tsk_9102_2    order-fulfillment-v1  SWITCH     engine-decider    COMPLETED  [>]  |
|  tsk_9102_3    order-fulfillment-v1  SIMPLE     worker-node-2     IN_PROGRESS[>]  |
+-----------------------------------------------------------------------------------+
```

---

## 2. User Review Required
> [!IMPORTANT]
> **Backward Compatibility & Dual Mode**:
> To ensure seamless transition, `/tasks` will support a dual view:
> 1. **Workflow Tasks (Default)**: Real execution units linked to Workflow Definitions with execution state badges, worker lease indicators, retry metrics, and direct link to the Visual DAG Studio execution graph.
> 2. **Manual / Backlog Tasks**: Existing ad-hoc operator tasks can still be viewed or filtered under a dedicated tab.

> [!NOTE]
> **Integration with Unified Sandbox & Real APIs**:
> `tasks-sandbox-handler.ts` and `workflowSandboxHandler` will be harmonized so that starting a workflow in the Visual DAG Studio immediately populates real task execution units in `/tasks`.

---

## 3. Proposed Changes

### Component 1: Task Schema & Data Models (`apps/console/src/features/tasks/`)
#### [MODIFY] `apps/console/src/features/tasks/data/schema.ts`
- Enhance `taskSchema` to represent both workflow execution units and manual tasks:
  ```typescript
  export const workflowTaskExecutionSchema = z.object({
    id: z.string(),
    taskId: z.string(),
    workflowId: z.string(),
    workflowName: z.string().optional(),
    taskReferenceName: z.string(),
    taskType: z.enum(['SIMPLE', 'SWITCH', 'FORK_JOIN', 'DYNAMIC_FORK', 'WAIT', 'DO_WHILE', 'MANUAL']),
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'TIMED_OUT', 'SKIPPED']),
    leaseOwner: z.string().nullable().optional(),
    attempt: z.number().default(1),
    maxRetries: z.number().default(3),
    pollDomain: z.string().default('default'),
    visibleAtEpochMs: z.number().optional(),
    durationMs: z.number().optional(),
    inputData: z.record(z.unknown()).optional(),
    outputData: z.record(z.unknown()).optional(),
    errorMessage: z.string().optional(),
    startedAt: z.string().optional(),
    completedAt: z.string().optional(),
  });
  ```

#### [MODIFY] `apps/console/src/features/tasks/data/data.tsx`
- Align task status definitions with the Visual DAG Studio:
  - `SCHEDULED` (Clock / Sky blue)
  - `IN_PROGRESS` (Loader2 / Blue pulsing)
  - `COMPLETED` (CheckCircle2 / Emerald)
  - `FAILED` (AlertCircle / Rose)
  - `TIMED_OUT` (TimerOff / Amber)
- Add Task Type badges (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `WAIT`, `DO_WHILE`).

---

### Component 2: Tasks Table & Drawer Components (`apps/console/src/features/tasks/components/`)
#### [MODIFY] `apps/console/src/features/tasks/components/tasks-columns.tsx`
- Display:
  - `Task ID` & `Reference Name` (`checkInventory`, `routeShipping`)
  - `Workflow Plan` (with clickable badge linking to `/workflows?executionId={workflowId}`)
  - `Type` badge (`SIMPLE`, `SWITCH`, etc.) matching DAG node badges
  - `Status` badge with execution color coding
  - `Worker / Lease` (e.g., `worker-jvm-1` or `lease: 12s left`)
  - `Attempt / Retry` count
  - `Actions`: Inspect payload dialog, retry task, open in Visual DAG Studio

#### [NEW] `apps/console/src/features/tasks/components/task-payload-inspector-dialog.tsx`
- Dialog inspecting JSON input parameters, output data, error stack traces, and worker heartbeat telemetry.

#### [MODIFY] `apps/console/src/features/tasks/components/data-table-row-actions.tsx`
- Add action: **"View in Visual DAG Studio"** (navigates to `/workflows` with highlighted task node).

---

### Component 3: Integration with Unified Sandbox & Backend (`apps/console/src/core/sandbox/`)
#### [MODIFY] `apps/console/src/core/sandbox/handlers/tasks-sandbox-handler.ts`
- Synchronize with `mockExecutions` from `packages/sandbox/src/handlers/workflow-handler.ts` so simulated workflow runs in Visual DAG Studio reflect live execution tasks in `/tasks`.

---

### Component 4: Integration Master Plan Update (`docs/integration_master_plan_iteration_4.md`)
#### [MODIFY] `docs/integration_master_plan_iteration_4.md`
- Incorporate this architectural refactor into **Workstream 7: Phase 31 & Phase 32**, formally establishing `/tasks` as the Execution Units Ledger of the Visual DAG Studio workflow engine.

---

## 4. Verification Plan

### Automated Tests
- Run Console Vitest tests:
  ```bash
  pnpm --filter @unipost/console test src/features/tasks
  ```
- Run Visual Studio tests:
  ```bash
  pnpm --filter @unipost/console test src/features/metadata/components/studio
  ```
- Verify TypeScript compilation:
  ```bash
  pnpm --filter @unipost/console build
  ```

### Manual Verification
1. Open `/tasks` in browser $\to$ Verify workflow execution units table renders with Workflow Plan links, task types, and live status badges.
2. Click **"View in Visual DAG Studio"** on any task $\to$ Navigate directly to `/workflows` with the corresponding workflow plan and task focus.
3. Trigger step progression in Visual DAG Studio $\to$ Verify task status in `/tasks` reflects updated execution state.
