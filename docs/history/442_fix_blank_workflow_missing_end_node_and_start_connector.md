# 442 - Backend Canonical Blank Workflow Initialization & Connector Handle Fix

## Problem
In the workflow orchestration subsystem:
1. When creating a new workflow definition, `WorkflowCreateDialog` in the console was attempting to construct initial node payloads in the frontend instead of relying on the backend as the single source of truth.
2. In the backend and unified sandbox, submitting a new workflow definition with empty tasks did not initialize canonical boundary nodes (`workflow_start` and `workflow_end`).
3. In `visual-dag-studio.tsx`, `decoratedNodes` calculated `isStartNode = degIn === 0` and `isEndNode = degOut === 0`. Because a start node had 0 outgoing edges before connection, `isEndNode` evaluated to `true`, which suppressed its source handle (`{!data.isEndNode && <Handle type="source" />}`).

## Changes
- `apps/api/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowDefinition.java`:
  - Added factory method `WorkflowDefinition.createBlank(key, name, description)` to initialize standard `workflow_start` and `workflow_end` boundary tasks and layout metadata.
- `apps/api/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowDefinitionController.java`:
  - In `registerDefinition()`, automatically initializes blank workflow definitions using `WorkflowDefinition.createBlank(...)` when tasks list is null or empty.
- `apps/api/acc-ms-aio/src/test/java/com/acc/aio/controller/workflow/WorkflowEngineRestApiTest.java`:
  - Added `@Test testRegisterBlankWorkflowInitializesStartAndEndNodes()` verifying `POST /api/v1/workflow/definitions` with empty tasks generates both Start and End boundary nodes.
- `packages/sandbox/src/handlers/workflow-handler.ts`:
  - Implemented offline sandbox parity: `WorkflowSandboxRepository.saveDefinition()` automatically initializes canonical `workflow_start` and `workflow_end` nodes when tasks are empty.
- `apps/console/src/features/workflows/components/catalog/workflow-create-dialog.tsx`:
  - Cleaned up `handleCreate()` to send metadata `{ workflowKey, name, description, tasks: [] }` directly to backend, delegating initialization to backend.
- `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`:
  - Fixed `decoratedNodes` so that explicit start nodes (`workflow_start`, `node-start`, `data.isStartNode`) enforce `isEndNode = false`, ensuring the right source handle is always rendered.

## Verification
- `pnpm --filter @acc/api exec node mvnw.cjs -am -pl acc-ms-aio test "-Dtest=WorkflowEngineRestApiTest"` (2/2 passed, BUILD SUCCESS).
- `pnpm --filter @acc/sandbox test` (11 test files, 103 passed).
- `pnpm --filter @acc/console exec vitest run src/features/workflows` (24 test files, 112 passed).
- `pnpm --filter @acc/console exec tsc --noEmit` (0 errors).
