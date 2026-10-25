# Implementation Plan 39: Enterprise Resilient Lease Queue, Poison DLQ & Priority Queuing (Phase 38 Backend)

Harden the backend single-column lease queue into a resilient, high-throughput, and fair multi-tenant task distribution engine with dead-letter queue isolation, dynamic priority aging, and zombie worker lease reaping.

## Proposed Changes

### 1. DDL & Schema Migrations
- `apps/backend/workflow-engine/src/main/resources/db/schema-postgres.sql`:
  - Add `created_at_ms BIGINT NOT NULL DEFAULT 0` to `task_queue` table if not present.
  - Create table `task_dlq` (`dlq_id`, `task_id`, `workflow_id`, `tenant_id`, `workspace_id`, `task_type`, `domain`, `error_message`, `error_stacktrace`, `payload_snapshot`, `retry_count`, `isolated_at_ms`, `replayed_at_ms`, `status`).
  - Index `idx_task_dlq_tenant` on `(tenant_id, isolated_at_ms DESC)`.
- `apps/backend/workflow-engine/src/main/resources/db/schema-sqlite.sql`:
  - Add `created_at_ms` to `task_queue` and create `task_dlq` table.

### 2. Core Models & Persistence Port
- `TaskDlqRecord.java` in `com.acc.workflow.core.model`:
  - Immutable record for dead-lettered tasks.
- `PersistencePort.java`:
  - Add `quarantineTaskToDlq(TaskDlqRecord record)`
  - Add `listDlqTasks(String tenantId, String status, int limit)`
  - Add `getDlqTask(String dlqId)`
  - Add `updateDlqStatus(String dlqId, String status, Long replayedAtMs)`
  - Add `deleteDlqTask(String dlqId)`
- Update adapters:
  - `PostgresJdbcPersistenceAdapter.java`:
    - Implement DLQ methods.
    - Update `enqueueTask` to insert `created_at_ms`.
    - Update `pollTasks` with dynamic priority aging formula:
      `ORDER BY (priority + CAST((? - created_at_ms) / 5000 AS INT)) DESC, visible_at_epoch_ms ASC`
  - `SqliteJdbcPersistenceAdapter.java`:
    - Implement DLQ methods, dynamic priority aging formula, and `created_at_ms`.
  - `InMemoryPersistenceAdapter.java`:
    - Implement thread-safe DLQ map, dynamic priority aging sort in `pollTasks`.

### 3. Application Engine & Zombie Reaper
- `WorkflowEngineService.java`:
  - `reportTaskResult`: when task fails and `attempt >= maxRetries` or terminal failure:
    - Atomically quarantine to `task_dlq` via `quarantineTaskToDlq`.
    - Remove from `task_queue`.
    - Mark task execution `FAILED`.
    - Trigger reverse Saga compensation.
  - `sweepExpiredTasks`:
    - For expired tasks where `lease_owner IS NOT NULL`:
    - If `attempt >= maxRetries`:
      - Quarantine to `task_dlq` with reason `EXPIRED_LEASE_ZOMBIE_WORKER`.
      - Mark task execution `TIMED_OUT`.
      - Trigger reverse Saga compensation.
    - Else:
      - Increment `attempt`.
      - Clear `lease_owner`, reset `visible_at_epoch_ms = nowEpochMs`.
      - Set task execution status back to `SCHEDULED`.
  - `replayDlqTask(String dlqId, Map<String, Object> payloadOverrides, long nowEpochMs)`:
    - Re-enqueues task into `task_queue` with reset attempt count (`attempt = 1`) and high priority (`100`).
    - Updates task execution status to `SCHEDULED` with payload overrides.
    - Updates DLQ record status to `REPLAYED`.
    - Resumes parent workflow execution status to `RUNNING`.
  - `discardDlqTask(String dlqId)`:
    - Updates DLQ status to `DISCARDED` or removes record.

### 4. REST Controller & Metrics
- `WorkflowDlqController.java` in `apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow`:
  - `GET /api/v1/workflow/dlq`: list quarantined tasks.
  - `GET /api/v1/workflow/dlq/{id}`: get DLQ record.
  - `POST /api/v1/workflow/dlq/{id}/replay`: replay with optional payload overrides.
  - `DELETE /api/v1/workflow/dlq/{id}`: discard DLQ task.
- `ScheduledLeaseSweeper`:
  - Integrated virtual-thread background sweeps reclaiming orphaned leases.

## Verification Plan

### Automated Tests
- Unit & Contract tests in `workflow-engine`:
  - `PersistenceContractTest`: assert DLQ CRUD and dynamic aged priority ordering.
  - `WorkflowEngineServiceTest`: assert DLQ quarantine on max retries, zombie reaper lease recovery, and DLQ replay mechanics.
- Integration tests in `acc-ms-aio`:
  - `WorkflowDlqRestApiTest`: MockMvc tests verifying `/dlq`, `/replay`, `/discard` endpoints.
