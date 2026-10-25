# Walkthrough 34: Phase 33 - Spring Boot REST Engine Bridge & Enterprise Persistence Wiring

## 1. Overview
In Phase 33, we promoted `workflow-engine` from a standalone Java module into the primary runtime environment of `apps/backend/acc-ms-aio`. We created the Spring Boot autowiring configuration, REST API endpoints for workflow definitions, execution orchestration, and worker polling, and verified the complete end-to-end lifecycle.

## 2. Key Components Implemented

### 2.1 Spring Configuration (`WorkflowEngineConfiguration.java`)
- Declared bean `PersistencePort`: checks for active `DataSource`, configuring `PostgresJdbcPersistenceAdapter` when available with automatic fallback to thread-safe `InMemoryPersistenceAdapter`.
- Declared bean `PureDecider`: stateless workflow decision engine.
- Declared bean `WorkflowDefinitionRegistry`: in-memory tenant-isolated definition catalog.
- Declared bean `WorkflowEngineService`: application service handling scheduling, dispatching, state transitions, and cancellation.
- Declared bean `ScheduledLeaseSweeper`: background task sweeper running `@Scheduled(fixedDelay = 5000)` invoking `service.sweepExpiredTasks()`.

### 2.2 REST API Controllers (`com.acc.aio.controller.workflow`)
- **`WorkflowDefinitionController`**:
  - `POST /api/v1/workflow/definitions`: registers a new DAG definition, validating uniqueness and acyclicity.
  - `GET /api/v1/workflow/definitions/{key}`: fetches a registered workflow definition.
  - `GET /api/v1/workflow/definitions`: lists all workflow definitions for the active tenant.
- **`WorkflowExecutionController`**:
  - `POST /api/v1/workflow/executions`: starts a workflow execution, initializing state and scheduling root tasks.
  - `GET /api/v1/workflow/executions/{id}`: returns real-time snapshot and execution status.
  - `POST /api/v1/workflow/executions/{id}/terminate`: terminates an active workflow execution.
- **`TaskWorkerController`**:
  - `GET /api/v1/workflow/tasks/poll`: allows workers to poll for scheduled tasks by taskType and domain.
  - `POST /api/v1/workflow/tasks/{id}/result`: workers report task completion or failure, triggering decider progression.
  - `POST /api/v1/workflow/tasks/{id}/heartbeat`: workers renew leases to prevent task re-dispatch.

### 2.3 Workflow Key Preservation Fix
- In `WorkflowEngineService.java`, resolved an issue where `definition.name()` was being passed into `saveWorkflowExecution` instead of `definition.workflowKey()`. This fix ensures `WorkflowSnapshot.workflowKey()` faithfully preserves the registry key so subsequent task completions properly resolve the parent definition and trigger child tasks.

## 3. Verification & Testing
- Executed `WorkflowEngineRestApiTest` via `.\mvnw.cmd test -pl acc-ms-aio -Dtest=WorkflowEngineRestApiTest`.
- All steps passed:
  1. Workflow definition registration.
  2. Workflow execution start.
  3. Worker polling for task 1 (`inventory-check`).
  4. Task 1 heartbeat renewal.
  5. Task 1 completion with output payload.
  6. Worker polling for task 2 (`payment-charge`).
  7. Task 2 completion.
  8. Workflow completion verification (`COMPLETED` status).
  9. Workflow termination endpoint check (`TERMINATED` status).
