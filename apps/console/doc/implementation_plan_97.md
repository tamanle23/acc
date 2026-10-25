# Implementation Plan 97: Phase 34 - Live Console API Client, Dual-Mode Studio & SSE Execution Stream

## 1. Goal & Architectural Overview
Phase 34 implements the end-to-end bridge connecting the `@acc/console` frontend and the Spring Boot backend (`acc-ms-aio`) / Unified Sandbox Platform via resilient Server-Sent Events (SSE) telemetry and interactive DAG execution visualization:

1. **Spring Boot SSE Real-Time Execution Stream (`WorkflowExecutionController.java`)**:
   - Add endpoint `GET /api/v1/workflow/executions/{id}/events` producing `MediaType.TEXT_EVENT_STREAM_VALUE`.
   - Maintain a registry of active `SseEmitter`s per execution instance.
   - When tasks transition (`TASK_SCHEDULED`, `TASK_IN_PROGRESS`, `TASK_COMPLETED`, `TASK_FAILED`, `WORKFLOW_COMPLETED`), broadcast event payloads to connected emitters.
2. **Unified Sandbox Real-Time Mock Stream Adapter (`packages/sandbox/src/handlers/workflow-handler.ts`)**:
   - Support `GET /api/v1/workflow/executions/{id}/events` simulation.
   - Emit simulated events with configurable jitter, smoothly moving tasks from `SCHEDULED` -> `IN_PROGRESS` -> `COMPLETED`.
   - Implement `GET /api/v1/workflow/executions/{id}` snapshot endpoint for polling fallback.
3. **TanStack Query & SSE Hooks (`apps/console/src/features/workflows/api/`)**:
   - `useWorkflowDefinitions()`: Fetch list of workflow definitions.
   - `useWorkflowDefinition(key)`: Fetch specific workflow definition IR and layout metadata.
   - `useSaveWorkflowDefinition()`: Mutation saving definition to `/api/v1/workflow/definitions`.
   - `useToggleWorkflowStatus()`: Mutation enabling/disabling workflow definition.
   - `useDeleteWorkflowDefinition()`: Mutation deleting workflow definition.
   - `useStartWorkflowExecution()`: Mutation triggering new execution instance (`/api/v1/workflow/executions`).
   - `useWorkflowExecutionStatus(executionId)`: Polling fallback hook.
   - `useWorkflowExecutionStream(executionId)`: SSE hook with automatic adaptive polling fallback and node state emitter.
4. **Enterprise Workflow Definitions Catalog Landing (`apps/console/src/features/workflows/`)**:
   - Main `/workflows` landing view transforms into a definitions catalog:
     - Search & filter by status / tags.
     - Table / Card view displaying Key, Name, Version, Node Count, Status (Active/Disabled), and Last Updated.
     - Actions: "Create New", "Import IR JSON", "Design / Open Studio" (opens Designer Mode), "Enable/Disable", "Delete".
5. **Dual-Mode Visual DAG Studio (`apps/console/src/features/metadata/components/studio/`)**:
   - **Designer Mode** (opened from `/workflows`): Pure definition authoring, draggable palette, parameter editing, cycle validation, saving.
   - **Live Execution Stream Mode** (opened from `/tasks` when inspecting an execution row): Read-only canvas with active glowing animations on nodes matching execution state.
6. **Execution Run Drawer (`apps/console/src/features/workflows/components/execution-run-drawer.tsx`)**:
   - Bottom slide-over sheet / drawer on the canvas with collapsible/minimizable tabs:
     - Timeline & Step progress.
     - Live task output logs and event feed.
     - Input & Output payload JSON inspector.
     - Error diagnostics & trace viewer.
7. **Verification**:
   - Spring Boot controller tests for `SseEmitter` event streaming.
   - Vitest tests for TanStack hooks and SSE stream fallback.
   - Vitest tests in `@acc/sandbox`.

---

## 2. Target Files & Changes
- `apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowExecutionController.java`
- `apps/backend/acc-ms-aio/src/test/java/com/acc/aio/controller/workflow/WorkflowEngineRestApiTest.java`
- `packages/sandbox/src/handlers/workflow-handler.ts`
- `packages/sandbox/src/__tests__/workflow-sandbox.test.ts`
- `apps/console/src/features/workflows/api/workflow-api.ts`
- `apps/console/src/features/workflows/hooks/use-workflow-execution-stream.ts`
- `apps/console/src/features/workflows/components/execution-run-drawer.tsx`
- `apps/console/src/features/workflows/components/workflow-catalog-table.tsx`
- `apps/console/src/features/workflows/components/workflow-create-dialog.tsx`
- `apps/console/src/features/workflows/index.tsx`
- `apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`
- `apps/console/src/features/metadata/components/studio/dag-node.tsx`
- `apps/console/src/features/tasks/components/tasks-columns.tsx`
- `apps/console/doc/implementation_plan_97.md`
- `apps/console/doc/walkthrough_97.md`
- `docs/history/104_phase_34_live_console_api_client_and_sse_execution_stream.md`
