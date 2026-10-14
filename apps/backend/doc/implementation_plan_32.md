# Implementation Plan 32: Hexagonal Engine, Single-Column Lease Queue & Storage Adapters (Phase 28)

## 1. Overview
Execute **Phase 28** of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/integration_master_plan_iteration_3.md):
- Define Hexagonal Ports in `com.unipost.workflow.ports`:
  - `PersistencePort.java`
  - `UnitOfWork.java`
  - `WorkerTransportPort.java`
- Author SQL DDL schemas for hybrid relational execution and single-column lease queue:
  - `schema-sqlite.sql`
  - `schema-postgres.sql`
- Implement storage adapters in `com.unipost.workflow.adapters.storage`:
  - `InMemoryPersistenceAdapter.java` (Thread-safe concurrent data structures)
  - `SqliteJdbcPersistenceAdapter.java` (Pure JDBC with SQLite WAL mode)
  - `PostgresJdbcPersistenceAdapter.java` (Pure JDBC with multi-tenant partitioning & `FOR UPDATE SKIP LOCKED`)
- Implement transport adapter in `com.unipost.workflow.adapters.transport`:
  - `InProcessTransportAdapter.java`
- Implement the Imperative Shell:
  - `WorkflowEngineService.java`: `startWorkflow`, `reportTaskResult`, `sweepExpiredTasks`
- Implement JUnit 5 test suite:
  - `PersistenceContractTest.java`: Abstract contract test suite verifying atomic queue polling, lease timeout extension, and unit of work commit/rollback.
  - `InMemoryPersistenceTest.java`: Executes contract suite against `InMemoryPersistenceAdapter`.
  - `SqlitePersistenceTest.java`: Executes contract suite against `SqliteJdbcPersistenceAdapter`.
  - `WorkflowEngineServiceTest.java`: Tests end-to-end decider execution, lease sweeper timeout recovery, and worker result processing.

## 2. Invariants Followed
- **HEXAGONAL ARCHITECTURE**: Pure core untouched by storage adapters; ports are interfaces only.
- **SINGLE-COLUMN LEASE QUEUE**: `visible_at_epoch_ms` governs scheduling, worker leases, deferrals, and backoffs.
- **ZERO-STUB-PROHIBITION**: Real SQLite WAL and InMemory implementations tested using production contract suites.

## 3. Verification Gate
- Run `mvn test -pl workflow-engine` and verify all contract and service tests pass 100%.
