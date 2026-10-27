# 108. Phase 35.4: Polyglot End-to-End Orchestration & Automated Saga Verification

**Date:** 2026-10-15  
**Scope:** `apps/backend/workflow-engine`, `apps/backend/acc-ms-aio`, `packages/worker`  
**Status:** Completed  

---

## 1. Problem
In distributed microservices, failures after partial task completion cannot simply roll back a database transaction. Instead, an orchestrator must execute a distributed Saga, rolling back completed tasks in reverse topological sequence. We needed to verify end-to-end polyglot orchestration spanning Java Virtual-Thread workers and TypeScript `@acc/worker` tasks with fault injection, automated reverse compensation, and deterministic CI test coverage.

## 2. Plan
1. Add `COMPENSATED_FAILED` to `WorkflowStatus`.
2. Wire `SagaCompensator` into `WorkflowEngineService.reportTaskResult` so unrecoverable failures trigger reverse compensation automatically.
3. Update `SagaCompensator` to pass runtime resolved input payloads (`executedSnapshot.inputData()`) into compensation commands.
4. Add `POST /api/v1/workflow/executions/{id}/compensate` endpoint in `WorkflowExecutionController`.
5. Author full end-to-end integration test `WorkflowSagaPolyglotIntegrationTest.java` in `acc-ms-aio`.
6. Author polyglot contract test `saga-compensation.test.ts` in `@acc/worker`.
7. Verify all suites pass.

## 3. Changes
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowStatus.java`**:
  - Added `COMPENSATED_FAILED` terminal status.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/WorkflowEngineService.java`**:
  - Automatic `SagaCompensator` invocation upon workflow failure, scheduling compensating tasks and setting `COMPENSATED_FAILED`.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/SagaCompensator.java`**:
  - Enriched compensation task inputs with resolved runtime inputs from `executedSnapshot.inputData()`.
- **`apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowExecutionController.java`**:
  - Added `POST /{id}/compensate` endpoint.
- **Tests & Artifacts**:
  - Created `WorkflowSagaPolyglotIntegrationTest.java` in `acc-ms-aio`.
  - Created `saga-compensation.test.ts` in `@acc/worker`.
  - Created `apps/backend/doc/implementation_plan_38.md` and `apps/backend/doc/walkthrough_38.md`.

## 4. Verification
- `cd apps/backend; ./mvnw.cmd test -pl acc-ms-aio`: 5/5 test classes passed (including `WorkflowSagaPolyglotIntegrationTest`).
- `cd apps/backend; ./mvnw.cmd test -pl workflow-engine`: 42/42 unit tests passed.
- `pnpm --filter @acc/worker test`: 6/6 tests passed.
- `pnpm --filter @acc/console test`: 43/43 test files passed (206/206 tests).

## 5. Walkthrough
- Started polyglot fulfillment workflow with `itemSku: IPHONE-16-PRO`.
- Step 1 (Java worker) reserved inventory $\to$ completed.
- Step 2 (TypeScript worker) dispatched package $\to$ completed.
- Step 3 (Billing worker) failed permanently with `PaymentDeclinedException`.
- Engine transitioned workflow status to `COMPENSATED_FAILED`.
- Engine scheduled compensation tasks in reverse order:
  - 1st compensation: `cancel-packing-worker` polled by TypeScript worker and acknowledged.
  - 2nd compensation: `release-inventory-worker` polled by Java worker and acknowledged.

## 6. Tasks
- [x] Add `COMPENSATED_FAILED` status.
- [x] Wire `SagaCompensator` into `WorkflowEngineService`.
- [x] Expose `/compensate` REST endpoint.
- [x] Implement and pass polyglot end-to-end integration test.
- [x] Implement and pass TypeScript worker contract test.
- [x] Document implementation plan, walkthrough, and history entry.

## 7. Next Steps
- Phase 35 is now 100% complete across all 4 sub-phases (High, Medium, Low task types, and polyglot Saga verification).
