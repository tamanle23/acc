# Backend Implementation Plan - Iteration 164: Decouple Task Definitions from Workers & Versioned Catalog

## Problem Statement
Task Definitions were previously coupled to runtime Task Workers via `WorkerRegistry.taskCatalog`. If workers were stopped or initializing, the system had no task definition catalog, preventing authoring in the Visual DAG Studio. Furthermore, Task Definitions lacked append-only versioning, lifecycle tracking (`DRAFT`, `ACTIVE`, `DEPRECATED`), and schema validation authority.

## Proposed Changes

### 1. Database & Persistence Layer
- `apps/api/acc-db/src/main/resources/db/acc/changelog-000.000.00021.xml`:
  - Create table `workflow_task_definitions` with composite key `(tenant_id, name, version)`.
  - Add nullable columns `task_def_name` and `task_def_version` to `task_executions`.
- Register changelog 21 in `changelog-master.xml`.
- Update `schema-postgres.sql` and `schema-sqlite.sql`.
- Create Java model `TaskDefinitionRecord.java`.
- Add contracts to `PersistencePort.java`.
- Implement in `PostgresJdbcPersistenceAdapter`, `SqliteJdbcPersistenceAdapter`, and `InMemoryPersistenceAdapter`.

### 2. Task Definition Application Registry
- Create `com.acc.workflow.application.TaskDefinitionRegistry.java`:
  - Hard-fork semantics: editing active version creates `MAX(version) + 1` in `DRAFT`.
  - Promotion logic: promoting draft to `ACTIVE` marks previous active as `DEPRECATED`.
  - Seed domain task definitions (`validateOrder`, `checkInventory`, `chargePayment`, `expressCourier`, `groundPostal`, `cancelCourierBooking`).

### 3. REST Controllers & Worker Decoupling
- Create `TaskDefinitionController.java` (`/api/v1/workflow/task-definitions`).
- Refactor `TaskContractController.java`: Load contracts directly from `TaskDefinitionRegistry`.
- Refactor `WorkerRegistry.java`: Strip schemas, focus on worker capacity and SemVer capability declarations.
- Refactor `SimpleTaskWorkerRegistrar.java`: Wire execution listeners with capability patterns without passing schemas.

### 4. Engine Core Models & Decider Validation
- Update `TaskDefinition.java` with `taskDefName` and `taskDefVersion`.
- Update `TaskSnapshot.java` with `taskDefName` and `taskDefVersion`.
- Update `SimpleTaskStrategy.java` to validate inputs against authoritative registry definitions.

## Verification
- Unit & integration tests in `TaskDefinitionPersistenceTest.java`, `TaskDefinitionRegistryTest.java`, and `TaskContractControllerTest.java`.
- Execute with Maven Surefire.
