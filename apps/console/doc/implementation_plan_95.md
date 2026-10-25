# Implementation Plan 95: Refactor /tasks into Workflow Executions Ledger & Visual DAG Studio Alignment

## 1. Goal & Architectural Overview
Refactor the existing `/tasks` screen, data schema, and routes in `@acc/console` so that **a Task is fundamentally modeled and presented as an Execution Unit of a Workflow Execution Instance**, establishing complete consistency with the **Visual DAG Studio** (`/workflows`).

### Architectural Taxonomy
1. **Workflow Definition**: The authored DAG blueprint designed in the **Visual DAG Studio** (`/workflows`).
2. **Workflow Execution**: A runtime instance of a workflow definition, tracked by `workflowId` / `workflowExecutionId`, maintaining lifecycle status (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`), timestamps, and total progress.
3. **Execution Units / Tasks**: The discrete schedulable units belonging to the workflow execution instance, leased and processed by workers.

```
+-----------------------------------------------------------------------------------+
|                            Visual DAG Studio (/workflows)                         |
|   Workflow Definition: "order-fulfillment-v1"                                     |
|   [inventoryCheck] ---> [routeShipping] ---> [expressCourier] ---> [dispatch]     |
+------------------------------------------+----------------------------------------+
                                           | triggers execution instance
                                           v
+-----------------------------------------------------------------------------------+
|                        Workflow Executions Ledger (/tasks)                        |
|                                                                                   |
|  Execution Unit ID    Workflow Definition    Type       Worker Lease      Status  |
|  -------------------------------------------------------------------------------  |
|  wf_exec_9101_inv     order-fulfillment-v1   SIMPLE     worker-jvm-01     DONE [>]|
|  wf_exec_9101_route   order-fulfillment-v1   SWITCH     decider-engine    DONE [>]|
|  wf_exec_9101_courier order-fulfillment-v1   SIMPLE     worker-fastlane   RUN  [>]|
+-----------------------------------------------------------------------------------+
```

---

## 2. Architectural Decisions
> [!IMPORTANT]
> **Complete Removal of Synthetic Demo Data**:
> - We eliminate the legacy synthetic lorem-ipsum tasks from `tasks-mock.json`.
> - The `/tasks` route is 100% dedicated to **Workflow Executions**.
> - The tab switcher directly filters execution lifecycle states:
>   1. **All Executions**
>   2. **In Progress / Running**
>   3. **Completed**
>   4. **Failed / Action Required**

---

## 3. Changes Implemented

### Component 1: Task Schema & Data Models (`apps/console/src/features/tasks/`)
- `apps/console/src/features/tasks/data/schema.ts`: `workflowTaskExecutionSchema` and `taskExecutionStatusSchema`.
- `apps/console/src/features/tasks/data/tasks.ts`: Pure workflow execution instances (`order-fulfillment-v1`, `checkout-pipeline-v2`, `invoice-billing-v1`, `batch-etl-v3`, `subscription-billing-v1`).

### Component 2: Execution Ledger Table & Inspector Dialog
- `apps/console/src/features/tasks/index.tsx`: Rebranded to **Workflow Executions** with execution lifecycle tabs (**All**, **In Progress**, **Completed**, **Failed**).
- `apps/console/src/features/tasks/components/tasks-columns.tsx`: Display `Execution Unit / ID`, `Workflow Definition` badges linking to `/workflows`, and worker lease telemetry.
- `apps/console/src/features/tasks/components/task-payload-inspector-dialog.tsx`: Workflow Execution Instance Details dialog.
- `apps/console/src/features/tasks/components/data-table-row-actions.tsx`: "Inspect Execution" and "View in Visual DAG".

### Component 3: Navigation & Locale Synchronization
- `apps/console/src/components/layout/data/sidebar-data.ts`: Renamed sidebar item to **Workflow Executions**.
- `apps/console/src/locales/en/console.json` & `vi/console.json`: Synchronized `workflowExecutions` translation keys.
