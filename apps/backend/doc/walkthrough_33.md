# Walkthrough 33: Polyglot Worker SDKs (Java & Pure TypeScript @unipost/worker) & Distributed Saga (Phase 29)

## 1. Overview
Executed **Phase 29** of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/integration_master_plan_iteration_3.md):
- Built high-ergonomics Java Worker SDK with Virtual Thread per-task execution, `Semaphore(maxConcurrency)`, adaptive exponential backoff polling, and composable middleware chain.
- Implemented reverse topological `SagaCompensator` to compute and schedule compensation tasks (`compensateHandlerRef`) in reverse execution order upon unrecoverable workflow failures.
- Authored pure TypeScript Worker SDK `@unipost/worker` (`packages/worker/`) with full parity: `TaskOutcome` discriminated union, `WorkflowWorkerHost`, `TaskPoller`, `ConcurrencyLimiter`, `AutoHeartbeatMiddleware`, `SchemaValidationMiddleware`, and `ErrorClassificationMiddleware`.
- Verified 100% test pass on both Java (25/25 tests in `workflow-engine`) and TypeScript (5/5 tests in `@unipost/worker`).

## 2. Changes Made

### 2.1 Java Worker SDK & Saga Engine (`apps/backend/workflow-engine`)
- [`TaskContext.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/TaskContext.java): Scoped context for task execution, audit logging, and manual/auto heartbeats.
- [`TaskOutcome.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/TaskOutcome.java): Sealed hierarchy: `Completed`, `InProgress` (with `callbackAfterSeconds`), and `Failed`.
- [`TaskHandler.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/TaskHandler.java): Functional interface for executing tasks.
- [`WorkerConfig.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/WorkerConfig.java): Worker parameters (`taskType`, `tenantId`, `domain`, `maxConcurrency`, `basePollIntervalMs`, `maxPollIntervalMs`, `pollBatchSize`, `autoHeartbeatIntervalMs`).
- [`WorkerHost.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/WorkerHost.java): Virtual-thread executor, semaphore backpressure, burst queue draining, and middleware chain.
- Middleware:
  - [`AutoHeartbeatMiddleware.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/middleware/AutoHeartbeatMiddleware.java): Periodic lease renewal while handler executes.
  - [`SchemaValidationMiddleware.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/middleware/SchemaValidationMiddleware.java): Input validation with required fields check.
  - [`ErrorClassificationMiddleware.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/middleware/ErrorClassificationMiddleware.java): Categorizes exceptions into retryable vs terminal.
- [`SagaCompensator.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/application/SagaCompensator.java): Reverses completed task path and creates `ScheduleTask` compensation commands.
- Tests:
  - [`WorkerHostTest.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/test/java/com/unipost/workflow/worker/WorkerHostTest.java): End-to-end worker execution and middleware testing.
  - [`SagaCompensatorTest.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/test/java/com/unipost/workflow/application/SagaCompensatorTest.java): Reverse topological compensation ordering verification.

### 2.2 Pure TypeScript Worker SDK (`packages/worker/`)
- [`package.json`](file:///c:/Users/Admin/workspace/git/unipost/packages/worker/package.json): Standalone monorepo package `@unipost/worker`.
- [`tsconfig.json`](file:///c:/Users/Admin/workspace/git/unipost/packages/worker/tsconfig.json): Bundler module resolution.
- [`src/types.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/worker/src/types.ts): Type definitions for `TaskStatus`, `TaskOutcome`, `TaskContext`, `WorkerConfig`, and `WorkerTransportClient`.
- [`src/host/ConcurrencyLimiter.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/worker/src/host/ConcurrencyLimiter.ts): Async promise concurrency limiter.
- [`src/host/TaskPoller.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/worker/src/host/TaskPoller.ts): Adaptive exponential backoff poller with burst draining.
- [`src/host/WorkflowWorkerHost.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/worker/src/host/WorkflowWorkerHost.ts): `register()`, `registerSimple()`, middleware pipeline, and graceful shutdown.
- [`src/client/HttpWorkerTransportClient.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/worker/src/client/HttpWorkerTransportClient.ts): HTTP polling & reporting client.
- Middleware:
  - [`src/middleware/AutoHeartbeatMiddleware.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/worker/src/middleware/AutoHeartbeatMiddleware.ts)
  - [`src/middleware/SchemaValidationMiddleware.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/worker/src/middleware/SchemaValidationMiddleware.ts)
  - [`src/middleware/ErrorClassificationMiddleware.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/worker/src/middleware/ErrorClassificationMiddleware.ts)
- Tests:
  - [`src/__tests__/worker-host.test.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/worker/src/__tests__/worker-host.test.ts): Polling, execution, and callback deferral tests.
  - [`src/__tests__/middleware.test.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/worker/src/__tests__/middleware.test.ts): Auto-heartbeat, schema validation, and error classification tests.

## 3. Verification Results
- **Java Suite**:
  ```bash
  mvn test -pl workflow-engine
  [INFO] Tests run: 25, Failures: 0, Errors: 0, Skipped: 0
  [INFO] BUILD SUCCESS
  ```
- **TypeScript Suite**:
  ```bash
  pnpm --filter @unipost/worker test
  ✓ src/__tests__/middleware.test.ts (3 tests)
  ✓ src/__tests__/worker-host.test.ts (2 tests)
  Test Files  2 passed (2)
  Tests  5 passed (5)
  ```
- **TypeScript Typecheck**:
  ```bash
  pnpm --filter @unipost/worker check-types
  # Passed cleanly with 0 errors
  ```
