# Walkthrough 39 - Phase 38: Backend Dead-Letter Queue (DLQ), Resilient Lease Queue & Priority Queuing

## Summary
Phase 38 delivers production-grade enterprise resilience to the distributed workflow task engine:
1. **Dedicated DLQ Storage & Lifecycle**: Introduced `task_dlq` table in PostgreSQL and SQLite, tracking poisoned tasks with error messages, full stack traces, and complete input payload snapshots.
2. **Aged Priority Scheduling & Starvation Prevention**: PostgreSQL and SQLite queue polling now dynamically elevate priority by `+1` per 5 seconds of queue wait time (`priority + FLOOR((EXTRACT(EPOCH FROM (NOW() - created_at_ms / 1000.0))) / 5)`).
3. **Zombie Worker Lease Sweeper**: Enhanced `sweepExpiredTasks()` to reclaim abandoned task leases, incrementing attempts and quarantining orphaned tasks that exceed `maxRetries` to DLQ.
4. **Task Replay & Discard APIs**: Added `/api/v1/workflow/dlq` REST endpoints supporting listing, filtering, task replay (with payload overrides, resetting retries to 1 and priority to 100), and soft-discard.

---

## Changes
- **Schemas**:
  - `apps/backend/workflow-engine/src/main/resources/db/schema-postgres.sql`: Added `created_at_ms` to `task_queue`, created `task_dlq` table, added indexes on tenant and status.
  - `apps/backend/workflow-engine/src/main/resources/db/schema-sqlite.sql`: Mirror schema with SQLite types and indices.
- **Domain & Ports**:
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/TaskDlqRecord.java`: Immutable domain record with JSON payload serialization helpers.
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/ports/PersistencePort.java`: Added DLQ CRUD contracts (`quarantineTaskToDlq`, `listDlqTasks`, `getDlqTask`, `updateDlqStatus`, `deleteDlqTask`).
- **Persistence Adapters**:
  - `InMemoryPersistenceAdapter.java`: In-memory thread-safe concurrent store with dynamic age calculation.
  - `SqliteJdbcPersistenceAdapter.java`: SQLite implementation with aged priority queries.
  - `PostgresJdbcPersistenceAdapter.java`: PostgreSQL atomic `FOR UPDATE SKIP LOCKED` query with dynamic age calculation and DLQ persistence.
- **Engine Logic**:
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/application/WorkflowEngineService.java`:
    - Updated `updateTaskStatus` to isolate fatal or retries-exhausted tasks to DLQ.
    - Enhanced `sweepExpiredTasks` to reclaim leases or isolate dead-worker tasks to DLQ.
    - Implemented `replayDlqTask` and `discardDlqTask`.
- **REST Controller**:
  - `apps/backend/unipost-ms-aio/.../WorkflowDlqController.java`: Exposed `/api/v1/workflow/dlq`, `/dlq/{dlqId}`, `/dlq/{dlqId}/replay`, and `/dlq/{dlqId}`.

---

## Verification Results
- **Unit & Contract Tests**:
  - `PersistenceContractTest.testDeadLetterQueueOperations`: Passed on in-memory and SQLite adapters.
  - `WorkflowEngineServiceTest.shouldQuarantineTaskToDlqWhenRetriesExhaustedAndSupportReplay`: Verified automated DLQ isolation and replay re-enqueuing.
  - `WorkflowEngineServiceTest`: 3/3 passed.
  - `WorkflowDlqRestApiTest`: 2/2 passed (verified REST contract, query params, discard, task failure quarantine, and replaying with payload overrides).
  - Total `workflow-engine` test suite: 45 tests, 0 failures, 0 errors.
