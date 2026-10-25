# Walkthrough: Workstream 1 - Backend Loom Virtual Threads, Heartbeat & Task Log Streaming

## 1. Overview
Implemented **Workstream 1: Backend Loom Virtual Threads & SSE Broadcaster** of [docs/integration_master_plan_iteration19.md](file:///c:/Users/Admin/workspace/git/acc/docs/integration_master_plan_iteration19.md).

Upgraded the server-side workflow execution streaming infrastructure in `@acc/backend` (`acc-ms-aio`) to support:
1. **Asynchronous Non-Blocking Dispatch via Java 21 Loom Virtual Threads**: Decoupled worker endpoint operations from client SSE emitters using virtual threads (`newVirtualThreadPerTaskExecutor`) with graceful cached thread pool fallback for JVMs < 21.
2. **Periodic Server Heartbeat Ping**: Automated 15-second `@Scheduled(fixedRate = 15000)` `HEARTBEAT` event emissions across active SSE emitters to prevent TCP, reverse proxy, and browser EventSource timeouts.
3. **Task Log Chunk Streaming**: Added `POST /api/v1/workflow/tasks/{id}/log` endpoint and `broadcastTaskLog` method, enabling workers to stream live stdout/stderr task logs (`TASK_LOG`) directly into connected clients.

---

## 2. Key Code Changes

### 2.1 `ExecutionStreamBroadcaster.java`
[ExecutionStreamBroadcaster.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/ExecutionStreamBroadcaster.java)
- **Virtual Thread Executor**: Uses reflection to instantiate Java 21 `Executors.newVirtualThreadPerTaskExecutor()` dynamically with automated fallback to `Executors.newCachedThreadPool()` on Java 17 runtimes.
- **Heartbeat Loop**: Added `sendHeartbeat()` method annotated with `@Scheduled(fixedRate = 15000)` to broadcast `{ "ping": true, "timestamp": now }` every 15 seconds.
- **Log Streaming**: Added `broadcastTaskLog(executionId, taskId, taskReferenceName, level, message, raw)` broadcasting `TASK_LOG` events.
- **Client Tracking**: Added `getActiveClientCount(executionId)`.

### 2.2 `TaskWorkerController.java`
[TaskWorkerController.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/TaskWorkerController.java)
- Added `TaskLogRequest` record DTO (`level`, `message`, `raw`).
- Exposed `POST /api/v1/workflow/tasks/{id}/log` endpoint verifying task existence and broadcasting log lines via `broadcaster.broadcastTaskLog(...)`.

### 2.3 Automated Testing
[WorkflowEngineRestApiTest.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio/src/test/java/com/acc/aio/controller/workflow/WorkflowEngineRestApiTest.java)
- Added step 6b testing worker task log streaming via `workerController.appendTaskLog(...)`, verifying status 200 and `"logged": true`.
- Added heartbeat assertion verifying `broadcaster.sendHeartbeat()` and `broadcaster.getActiveClientCount(workflowId) == 1`.

---

## 3. Verification & Test Results

Executed targeted Spring Boot controller and workflow engine tests via `mvnw.cjs`:

```bash
node ./apps/backend/mvnw.cjs test -pl acc-ms-aio -Dtest=WorkflowEngineRestApiTest,WorkflowIteration13ControllersTest
```

**Results**:
- `WorkflowEngineRestApiTest`: 1/1 tests passed in 1.22s.
- `WorkflowIteration13ControllersTest`: 2/2 tests passed in 1.10s.
- Total: 3/3 tests passed with **BUILD SUCCESS**.
