# Implementation Plan - Phase 35.4: Polyglot End-to-End Orchestration & Automated Saga Verification

Implement and verify end-to-end distributed Saga reverse topological compensation across Java Virtual-Thread workers and TypeScript `@acc/worker` SDK tasks.

## Proposed Changes

### 1. `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowStatus.java`
- Added `COMPENSATED_FAILED` terminal state to represent a workflow whose tasks were successfully reversed after failure.

### 2. `apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/WorkflowEngineService.java`
- Wire `SagaCompensator`: when a task fails permanently (status `FAILED`) causing workflow failure, automatically trigger `SagaCompensator.planCompensation` to schedule compensating tasks in reverse topological order, transitioning workflow to `COMPENSATED_FAILED`.

### 3. `apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/SagaCompensator.java`
- Enriched compensation input payload: uses `executedSnapshot.inputData()` so runtime parameters (e.g. `${workflow.input.sku}`) are preserved in compensation task inputs along with `_originalOutput` and `_originalTaskId`.

### 4. `apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowExecutionController.java`
- Added `POST /api/v1/workflow/executions/{id}/compensate` endpoint allowing manual or external trigger of reverse Saga compensation.

### 5. Automated Tests
- `apps/backend/acc-ms-aio/src/test/java/com/acc/aio/controller/workflow/WorkflowSagaPolyglotIntegrationTest.java`:
  - Full end-to-end integration test executing order fulfillment DAG:
    1. Java worker reserves inventory (with compensation `release-inventory-worker`).
    2. TypeScript worker dispatches package (with compensation `cancel-packing-worker`).
    3. Billing worker triggers fault-injected `PaymentDeclinedException`.
    4. Asserts workflow reaches `COMPENSATED_FAILED`.
    5. Asserts compensation tasks are polled and executed in exact reverse topological sequence (Step 2 $\to$ Step 1).
- `packages/worker/src/__tests__/saga-compensation.test.ts`:
  - Polyglot Vitest contract test verifying `@acc/worker` executes forward task and subsequently handles compensation task with original outputs intact.

## Verification
- `cd apps/backend; ./mvnw.cmd test -pl acc-ms-aio -Dtest=WorkflowSagaPolyglotIntegrationTest`
- `pnpm --filter @acc/worker test`
- `pnpm --filter @acc/console test`
