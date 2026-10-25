# History Log 103: Phase 33 - Spring Boot REST Engine Bridge & Enterprise Persistence Wiring

## 1. Problem
The high-performance, DAG-based workflow engine implemented in phases 26–29 existed as an isolated Java module (`apps/backend/workflow-engine`) with zero coupling to Spring Framework. To enable real-world execution, integration testing, and client orchestration from `@acc/console`, the engine needed to be wired into the primary Spring Boot runtime service (`apps/backend/acc-ms-aio`) with production-grade REST APIs, dependency injection, and automated background task lease sweeping.

## 2. Plan
1. Add `workflow-engine` as a project dependency to `apps/backend/acc-ms-aio/pom.xml`.
2. Implement `WorkflowEngineConfiguration` declaring Spring beans:
   - `PersistencePort` (with Postgres DataSource or InMemory thread-safe fallback)
   - `PureDecider`
   - `WorkflowDefinitionRegistry`
   - `WorkflowEngineService`
   - `ScheduledLeaseSweeper` running task lease recovery every 5000ms.
3. Implement REST API controllers under `com.acc.aio.controller.workflow`:
   - `WorkflowDefinitionController`: Register, fetch, and list workflow DAG definitions.
   - `WorkflowExecutionController`: Start, inspect, and terminate workflow executions.
   - `TaskWorkerController`: Worker long-polling, completion/failure reporting, and heartbeat lease renewal.
4. Support multi-tenant headers (`X-Tenant-Id`, `X-Workspace-Id`) and fallback to `TenantContextHolder`.
5. Author integration tests in `WorkflowEngineRestApiTest.java`.
6. Fix any lifecycle discrepancies encountered during end-to-end task execution.

## 3. Changes
- **`apps/backend/acc-ms-aio/pom.xml`**:
  - Added `<dependency><groupId>com.acc</groupId><artifactId>workflow-engine</artifactId></dependency>`.
- **`apps/backend/acc-ms-aio/src/main/java/com/acc/aio/config/WorkflowEngineConfiguration.java`**:
  - Configured `PersistencePort`, `PureDecider`, `WorkflowDefinitionRegistry`, `WorkflowEngineService`, and `ScheduledLeaseSweeper`.
- **`apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/`**:
  - `WorkflowDefinitionController.java`
  - `WorkflowExecutionController.java`
  - `TaskWorkerController.java`
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/WorkflowEngineService.java`**:
  - Fixed workflow execution registration: now passes `definition.workflowKey()` rather than `definition.name()`, ensuring registry lookups succeed during worker callback processing.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskSnapshot.java`**:
  - Added `workflowId()` helper to parse parent execution ID from taskId convention (`{workflowId}_{refName}_{seq}`).
- **`apps/backend/acc-ms-aio/src/test/java/com/acc/aio/controller/workflow/WorkflowEngineRestApiTest.java`**:
  - Full end-to-end REST API controller test covering registration, start, polling, heartbeat, result reporting, and termination.
- **Artifacts**:
  - Created `apps/backend/doc/implementation_plan_34.md` and `apps/backend/doc/walkthrough_34.md`.

## 4. Verification
- `apps/backend/workflow-engine`: compiled and installed via `mvn install -pl workflow-engine -DskipTests`.
- `apps/backend/acc-ms-aio`: executed `.\mvnw.cmd test -pl acc-ms-aio -Dtest=WorkflowEngineRestApiTest`.
  - All test steps executed cleanly with 0 failures, 0 errors, and elapsed time under 0.3s.

## 5. Walkthrough
- Registered DAG `order-pipeline-test` with nodes `inventory-check` and `payment-charge`.
- Started execution, verified task poll delivers `inventory-check`.
- Dispatched heartbeat, completed task with output, verified poll delivers `payment-charge`.
- Completed task 2, confirmed execution transitioned to `COMPLETED`.
- Started second execution, invoked `/terminate`, confirmed transition to `TERMINATED`.

## 6. Tasks
- [x] Wire `workflow-engine` dependency into `acc-ms-aio`.
- [x] Implement Spring configuration and lease sweeper.
- [x] Implement REST controllers for definitions, executions, and task workers.
- [x] Pass unit and integration tests.
- [x] Document implementation plan, walkthrough, and history entry.

## 7. Enhancement / Future Considerations
- Phase 34 will wire this Spring Boot REST engine bridge with real frontend API calls, SSE/WebSocket live telemetry streams, and console execution inspect drawers.
