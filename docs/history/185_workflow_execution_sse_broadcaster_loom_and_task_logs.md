# 185: Workflow Execution SSE Broadcaster Loom Virtual Threads & Task Log Streaming

## Problem
During active workflow executions, real-time telemetry streaming via Server-Sent Events (`/api/v1/workflow/executions/{id}/events`) in `ExecutionStreamBroadcaster` was executed synchronously on the calling thread. If connected SSE client sockets encountered network latency or closed abruptly, worker REST controllers and task completion threads could suffer blocking delays. In addition, there was no server-side heartbeat ping to prevent TCP/proxy timeouts, and task workers had no endpoint to stream incremental stdout/stderr logs (`TASK_LOG`) during task execution.

## Plan
1. Upgrade `ExecutionStreamBroadcaster` in `apps/backend/unipost-ms-aio` to dispatch SSE events asynchronously using Java 21 Loom virtual threads (`Executors.newVirtualThreadPerTaskExecutor()`) with seamless cached thread pool fallback for JVMs < 21.
2. Implement an automated `@Scheduled(fixedRate = 15000)` periodic heartbeat loop (`HEARTBEAT`) to keep browser EventSource connections and proxies alive.
3. Expose `POST /api/v1/workflow/tasks/{id}/log` in `TaskWorkerController` allowing workers to stream chunked task execution logs.
4. Add verification assertions in `WorkflowEngineRestApiTest.java`.

## Changes Made
- **`ExecutionStreamBroadcaster.java`**:
  - Initialized `virtualThreadExecutor` via reflective check for `Executors.newVirtualThreadPerTaskExecutor()` with fallback to `Executors.newCachedThreadPool()`.
  - Added non-blocking dispatch in `broadcast(...)`.
  - Added `broadcastTaskLog(...)` for streaming task logs (`TASK_LOG`).
  - Added `@Scheduled(fixedRate = 15000) public void sendHeartbeat()`.
  - Added `getActiveClientCount(...)`.
- **`TaskWorkerController.java`**:
  - Added `TaskLogRequest` record.
  - Added `POST /api/v1/workflow/tasks/{id}/log` endpoint streaming task logs via `broadcaster.broadcastTaskLog(...)`.
- **`WorkflowEngineRestApiTest.java`**:
  - Added test case verifying worker log chunk streaming and broadcaster heartbeat.

## Verification
- Ran Maven test suite:
  ```bash
  node ./apps/backend/mvnw.cjs test -pl unipost-ms-aio -Dtest=WorkflowEngineRestApiTest,WorkflowIteration13ControllersTest
  ```
- Result: 3/3 tests passed with **BUILD SUCCESS**.
