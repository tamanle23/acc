# History Log 104: Phase 34 - Live Console API Client, Dual-Mode Studio & SSE Execution Stream

## 1. Problem
While Phase 33 wired the distributed workflow engine into Spring Boot and exposed REST endpoints, `@acc/console` lacked a live client integration, an enterprise catalog landing page for workflow definitions, real-time telemetry streaming for active execution runs, and visual node state feedback on the React Flow canvas.

## 2. Plan
1. Add `ExecutionStreamBroadcaster` in `apps/backend/acc-ms-aio` and expose `GET /api/v1/workflow/executions/{id}/events` producing `SseEmitter` event streams.
2. Upgrade `workflowSandboxHandler` in `@acc/sandbox` to simulate real-time SSE stream events and support execution snapshots and definition CRUD.
3. Author TanStack Query and SSE hooks in `@acc/console`:
   - `useWorkflowDefinitions()`, `useWorkflowDefinition()`, `useSaveWorkflowDefinition()`, `useToggleWorkflowStatus()`, `useDeleteWorkflowDefinition()`.
   - `useWorkflowExecutionStream()` with automatic fallback to adaptive polling.
4. Redesign `/workflows` into a Workflow Definitions Catalog landing view with search, status toggles, deletion, and Create dialog.
5. Support **Dual-Mode Visual DAG Studio**:
   - Designer Mode: graph authoring, palette drag-and-drop, and saving.
   - Execution Mode: read-only canvas with real-time glowing node border animations and bottom `ExecutionRunDrawer`.
6. Add "Live Execution Stream" action to Workflow Executions (`/tasks`) rows opening the `TaskExecutionStreamModal`.
7. Author comprehensive unit and integration tests across backend, sandbox, and console.

## 3. Changes
- **Spring Boot Backend (`apps/backend/acc-ms-aio`)**:
  - `ExecutionStreamBroadcaster.java`: Thread-safe multi-client `SseEmitter` registry.
  - `WorkflowExecutionController.java`: Added `/api/v1/workflow/executions/{id}/events` and lifecycle broadcast.
  - `TaskWorkerController.java`: Broadcast `TASK_IN_PROGRESS`, `TASK_COMPLETED`, and `TASK_FAILED`.
  - `WorkflowEngineRestApiTest.java`: Verified SSE emitter subscription and event dispatch.
- **Unified Sandbox (`packages/sandbox` & `@acc/console`)**:
  - `workflow-handler.ts`: Implemented `WorkflowSandboxRepository` with multi-tenant partitioning, seeded realistic enterprise workflow definitions (`order-fulfillment-v1`, `checkout-pipeline-v2`, `invoice-billing-v1`), full REST CRUD matching (`/workflow/definitions`, `/workflow/definitions/{key}` with `GET`, `POST`, `PUT`, `DELETE`), execution lifecycle and SSE event stream generator.
  - `sandbox-dock.tsx`: Connected `workflowSandboxRepo.reset()` into `handleResetAllData()`.
  - `sandbox-engine.test.ts`: Added tests for seeded catalog listing, execution lifecycle, SSE stream events, status toggles, and definition deletion.
- **Console Frontend (`apps/console`)**:
  - `src/features/workflows/api/workflow-api.ts`: TanStack Query hooks.
  - `src/features/workflows/hooks/use-workflow-execution-stream.ts`: Resilient SSE stream hook with fallback polling.
  - `src/features/workflows/components/execution-run-drawer.tsx`: Bottom collapsible execution drawer with Timeline, Logs, Payload, and Diagnostics.
  - `src/features/workflows/components/workflow-catalog-table.tsx`: Enterprise definitions catalog table.
  - `src/features/workflows/components/workflow-create-dialog.tsx`: Workflow definition creation dialog.
  - `src/features/workflows/index.tsx`: Catalog landing view with Studio toggle.
  - `src/features/metadata/components/studio/visual-dag-studio.tsx`: Added dual-mode support, definition loading, saving, and drawer mounting.
  - `src/features/metadata/components/studio/dag-node.tsx`: Liquid Glass glowing specular border animations.
  - `src/features/tasks/components/task-execution-stream-modal.tsx`: Modal to stream task execution from `/tasks`.
  - `src/features/tasks/components/data-table-row-actions.tsx`: Wired Live Execution Stream menu item.
  - `src/features/tasks/components/tasks-dialogs.tsx`: Mounted stream modal.

## 4. Verification
- `pnpm --filter @acc/console test src/features/workflows`: 2/2 tests passed (SSE stream reception and fallback polling).
- `pnpm --filter @acc/sandbox test`: 6/6 tests passed.
- `.\mvnw.cmd test -pl acc-ms-aio -Dtest=WorkflowEngineRestApiTest`: 1/1 passed with 0 failures and 0 errors.

## 5. Walkthrough
- Navigating to `/workflows` displays the Workflow Definitions Catalog with search and CRUD options.
- Clicking "Design" on any definition opens Visual DAG Studio in Designer Mode with the "Save DAG" button.
- Creating a new definition opens the dialog, saves to the catalog, and enters Studio.
- From `/tasks` (Workflow Executions), clicking "Live Execution Stream" on any execution opens the modal and visualizes the running DAG with real-time glowing node transitions and the bottom telemetry drawer.
