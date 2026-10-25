# Walkthrough 32: Hexagonal Engine, Single-Column Lease Queue & Storage Adapters (Phase 28)

## 1. Overview
Executed **Phase 28** of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/acc/docs/integration_master_plan_iteration_3.md):
- Established Hexagonal ports: `PersistencePort`, `UnitOfWork`, `WorkerTransportPort`.
- Authored production relational DDL for SQLite (`schema-sqlite.sql`) and PostgreSQL (`schema-postgres.sql`) with multi-tenant partitioning and single-column lease queues (`visible_at_epoch_ms`).
- Implemented storage adapters:
  - `InMemoryPersistenceAdapter`: Thread-safe concurrent storage for lightning-fast testing.
  - `SqliteJdbcPersistenceAdapter`: Pure JDBC adapter with `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;`.
  - `PostgresJdbcPersistenceAdapter`: Multi-tenant RLS-ready PostgreSQL adapter with atomic `FOR UPDATE SKIP LOCKED`.
- Implemented transport adapter: `InProcessTransportAdapter`.
- Implemented imperative shell: `WorkflowEngineService` with `startWorkflow`, `reportTaskResult`, and background `sweepExpiredTasks` lease recovery.
- Verified 100% test pass on all 22 test cases across unit, contract, and service suites.

## 2. Changes Made

### 2.1 Hexagonal Ports
- [`PersistencePort.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/ports/PersistencePort.java): Database-agnostic workflow execution and lease queue contracts.
- [`UnitOfWork.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/ports/UnitOfWork.java): Transaction boundary contract.
- [`WorkerTransportPort.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/ports/WorkerTransportPort.java): Worker communication protocol (`pollBatch`, `reportTaskResult`, `heartbeat`).

### 2.2 Relational Hybrid Schemas
- [`schema-sqlite.sql`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/resources/db/schema-sqlite.sql): SQLite schema with `idx_queue_poll`.
- [`schema-postgres.sql`](file:///c:/Users/Admin/workflow-engine/src/main/resources/db/schema-postgres.sql): PostgreSQL schema with JSONB payloads and multi-tenant lease indexes.

### 2.3 Storage & Transport Adapters
- [`InMemoryPersistenceAdapter.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/InMemoryPersistenceAdapter.java): In-memory adapter with `ReentrantLock`.
- [`SqliteJdbcPersistenceAdapter.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/SqliteJdbcPersistenceAdapter.java): SQLite WAL adapter with batched queue updates.
- [`PostgresJdbcPersistenceAdapter.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/PostgresJdbcPersistenceAdapter.java): PostgreSQL adapter with `FOR UPDATE SKIP LOCKED`.
- [`InProcessTransportAdapter.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/transport/InProcessTransportAdapter.java): In-process worker transport.

### 2.4 Imperative Shell
- [`WorkflowEngineService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/WorkflowEngineService.java): Coordinates `UnitOfWork` transactions, `PureDecider`, and lease sweeper.

### 2.5 Verification Suite
- [`PersistenceContractTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/test/java/com/acc/workflow/adapters/PersistenceContractTest.java): Abstract contract suite.
- [`InMemoryPersistenceTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/test/java/com/acc/workflow/adapters/InMemoryPersistenceTest.java): Contract tests on InMemory adapter.
- [`SqlitePersistenceTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/test/java/com/acc/workflow/adapters/SqlitePersistenceTest.java): Contract tests on real SQLite WAL file.
- [`WorkflowEngineServiceTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/test/java/com/acc/workflow/application/WorkflowEngineServiceTest.java): End-to-end multi-step workflow execution and lease sweeper timeout recovery.

## 3. Verification Results
- Ran `mvn test -pl workflow-engine`:
  - **22/22 tests passing in 6.33s with 0 failures, 0 errors, and 0 skipped**.
