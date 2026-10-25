# 090: Hexagonal Engine, Single-Column Lease Queue & Storage Adapters (Phase 28)

**Date**: 2026-10-14  
**Author**: Lead Systems Architect  
**Category**: feat(backend)  
**Scope**: `apps/backend/workflow-engine`

---

## 1. Problem Statement
Phase 28 of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/acc/docs/integration_master_plan_iteration_3.md) requires:
1. Defining Hexagonal Architecture ports (`PersistencePort`, `UnitOfWork`, `WorkerTransportPort`).
2. Implementing relational schemas with a single-column lease queue (`visible_at_epoch_ms`).
3. Developing dual storage adapters (`InMemoryPersistenceAdapter`, `SqliteJdbcPersistenceAdapter` with WAL mode, `PostgresJdbcPersistenceAdapter` with `FOR UPDATE SKIP LOCKED`).
4. Building `WorkflowEngineService` with transactional execution and automatic lease sweeping.
5. Verifying storage adapters against an abstract contract test suite.

---

## 2. Plan
1. Add `org.xerial:sqlite-jdbc` to `workflow-engine/pom.xml`.
2. Define `UnitOfWork`, `PersistencePort`, and `WorkerTransportPort` interfaces in `com.acc.workflow.ports`.
3. Author `schema-sqlite.sql` and `schema-postgres.sql`.
4. Implement `InMemoryPersistenceAdapter`, `SqliteJdbcPersistenceAdapter`, and `PostgresJdbcPersistenceAdapter`.
5. Implement `InProcessTransportAdapter` and `WorkflowEngineService`.
6. Write abstract `PersistenceContractTest` with concrete `InMemoryPersistenceTest` and `SqlitePersistenceTest`.
7. Write `WorkflowEngineServiceTest` testing end-to-end execution and lease sweeper recovery.

---

## 3. Changes Made
- [`apps/backend/workflow-engine/pom.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/pom.xml): Added `sqlite-jdbc`.
- [`PersistencePort.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/ports/PersistencePort.java), [`UnitOfWork.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/ports/UnitOfWork.java), [`WorkerTransportPort.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/ports/WorkerTransportPort.java): Core hexagonal ports.
- [`schema-sqlite.sql`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/resources/db/schema-sqlite.sql), [`schema-postgres.sql`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/resources/db/schema-postgres.sql): DDL definitions.
- [`InMemoryPersistenceAdapter.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/InMemoryPersistenceAdapter.java), [`SqliteJdbcPersistenceAdapter.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/SqliteJdbcPersistenceAdapter.java), [`PostgresJdbcPersistenceAdapter.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/PostgresJdbcPersistenceAdapter.java): Storage adapters.
- [`InProcessTransportAdapter.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/transport/InProcessTransportAdapter.java): Transport adapter.
- [`WorkflowEngineService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/WorkflowEngineService.java): Imperative shell.
- Tests: `PersistenceContractTest.java`, `InMemoryPersistenceTest.java`, `SqlitePersistenceTest.java`, `WorkflowEngineServiceTest.java`.
- Documentation: [`apps/backend/doc/implementation_plan_32.md`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/doc/implementation_plan_32.md), [`apps/backend/doc/walkthrough_32.md`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/doc/walkthrough_32.md).

---

## 4. Verification
- `mvn test -pl workflow-engine`: **22/22 tests passing in 6.33s**.
