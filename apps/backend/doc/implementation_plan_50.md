# Backend Implementation Plan - Iteration 50: Enterprise Workflow Engine Resilience & ACID Transactional Boundaries

## 1. Problem & Context
1. `WorkflowEngineService.java` fails compilation due to truncated `simulateExecution` and invalid `decide` invocation.
2. In `WorkflowEngineConfiguration`, injected `DataSource` beans should participate seamlessly in Spring transaction boundaries without coupling `workflow-engine` core library to Spring.
3. `WorkflowExecutionController` lacks `GET /api/v1/workflow/executions` supporting both offset and keyset pagination.
4. Duplicate worker task submissions need idempotent handling via optimistic state checks.

## 2. Proposed Changes
- **`WorkflowEngineConfiguration.java`**:
  - Wrap `dataSource` with `TransactionAwareDataSourceProxy(dataSource)`.
- **`WorkflowEngineService.java`**:
  - Restore truncated `simulateExecution` implementation.
  - Fix `reapExpiredLeases` to delegate to `taskLeaseWatchdog.reapExpiredLeases(nowEpochMs)`.
  - Add optimistic status check to `reportTaskResult` to ensure idempotency.
- **`SqliteJdbcPersistenceAdapter.java`**:
  - Add JVM reentrant lock around polling to prevent SQLite concurrency contention during testing.
- **`WorkflowExecutionController.java`**:
  - Expose `GET /api/v1/workflow/executions` supporting dual-mode pagination (`page`, `size` and `limit`, `afterId`), filters (`status`, `workflowKey`), and tenant partitioning.
- **`ExecutionStreamBroadcaster.java`**:
  - Introduce bounded emitter limits (max 100/execution) and 15s heartbeat sweep.

## 3. Verification Plan
- `cmd /c "cd apps\backend && mvnw.cmd test -pl workflow-engine -q"`
- `cmd /c "cd apps\backend && mvnw.cmd test -pl acc-ms-aio -Dtest=Workflow*Test -q"`
