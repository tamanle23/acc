# Implementation Plan 34: Phase 33 - Spring Boot REST Engine Bridge & Enterprise Persistence Wiring

## 1. Goal & Architecture Overview
Promote `workflow-engine` from a standalone library into the active Spring Boot runtime graph in `apps/backend/unipost-ms-aio`.
Implement:
1. **Spring Configuration (`WorkflowEngineConfiguration.java`)**:
   - `PersistencePort` bean: autowires `PostgresJdbcPersistenceAdapter` when Postgres DataSource is present, with fallback to SQLite or thread-safe `InMemoryPersistenceAdapter`.
   - `WorkflowEngineService` singleton bean wiring `PersistencePort` and `PureDecider`.
   - `WorkflowDefinitionRegistry` bean storing authored DAG definitions.
   - `ScheduledLeaseSweeper` running background task recovery (`sweepExpiredTasks`) every 5000ms.
2. **REST API Controllers (`com.unipost.aio.controller.workflow`)**:
   - `WorkflowDefinitionController`:
     - `POST /api/v1/workflow/definitions` - Register / validate DAG definition.
     - `GET /api/v1/workflow/definitions/{key}` - Retrieve definition and canvas layout metadata.
     - `GET /api/v1/workflow/definitions` - List definitions for active tenant.
   - `WorkflowExecutionController`:
     - `POST /api/v1/workflow/executions` - Start new execution with input payload.
     - `GET /api/v1/workflow/executions/{id}` - Retrieve execution status and snapshot.
     - `POST /api/v1/workflow/executions/{id}/pause` / `resume` / `terminate`.
   - `TaskWorkerController`:
     - `GET /api/v1/workflow/tasks/poll` - Long-polling endpoint for workers (taskType, domain, workerId, batchSize).
     - `POST /api/v1/workflow/tasks/{id}/result` - Worker completes or fails task.
     - `POST /api/v1/workflow/tasks/{id}/heartbeat` - Lease extension heartbeat.
3. **Multi-Tenant Context Preservation**:
   - Extract tenant and workspace context using `TenantContextHolder` and headers (`X-Tenant-Id`, `X-Workspace-Id`).
4. **Verification**:
   - MockMvc integration tests verifying definition registration, execution lifecycle, worker polling, and lease recovery.

---

## 2. Proposed Changes
- `apps/backend/unipost-ms-aio/pom.xml`: Add `workflow-engine` and `spring-boot-starter-test`.
- `apps/backend/unipost-ms-aio/src/main/java/com/unipost/aio/config/WorkflowEngineConfiguration.java`
- `apps/backend/unipost-ms-aio/src/main/java/com/unipost/aio/controller/workflow/WorkflowDefinitionController.java`
- `apps/backend/unipost-ms-aio/src/main/java/com/unipost/aio/controller/workflow/WorkflowExecutionController.java`
- `apps/backend/unipost-ms-aio/src/main/java/com/unipost/aio/controller/workflow/TaskWorkerController.java`
- `apps/backend/unipost-ms-aio/src/test/java/com/unipost/aio/controller/workflow/WorkflowEngineRestApiTest.java`
- `apps/backend/doc/implementation_plan_34.md`
- `apps/backend/doc/walkthrough_34.md`
- `docs/history/103_phase_33_spring_boot_rest_engine_bridge.md`
- `docs/history/README.md`
