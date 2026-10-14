# Implementation Plan 33: Polyglot Worker SDKs (Java & Pure TypeScript @unipost/worker) & Distributed Saga (Phase 29)

## 1. Overview
Execute **Phase 29** of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/integration_master_plan_iteration_3.md):
- **Part 1: Java Virtual-Thread Worker SDK & Middleware**:
  - `TaskContext.java` interface (input, attempt, heartbeat, log).
  - `TaskOutcome.java` sealed hierarchy (`Completed`, `InProgress`, `Failed`).
  - `TaskHandler.java` functional interface.
  - `WorkerConfig.java` record.
  - Middleware Chain (`WorkerMiddleware.java`, `AutoHeartbeatMiddleware.java`, `SchemaValidationMiddleware.java`, `ErrorClassificationMiddleware.java`).
  - `WorkerHost.java`: Virtual-thread execution per task, `Semaphore(maxConcurrency)`, adaptive exponential backoff polling, graceful shutdown.
  - `SagaCompensator.java`: Computes reverse topological path of completed tasks with `compensateHandlerRef` and schedules compensation tasks.
- **Part 2: Pure TypeScript Worker SDK (`packages/worker/`)**:
  - Setup `packages/worker/package.json` as `@unipost/worker`.
  - Type-safe outcome model in `src/types.ts` (`TaskOutcome.completed`, `TaskOutcome.inProgress`, `TaskOutcome.failedRetryable`, `TaskOutcome.failedTerminal`).
  - `TaskContext.ts` with scoped logging, manual heartbeat trigger, and `AbortSignal`.
  - `WorkflowWorkerHost.ts` with `register` and `registerSimple`.
  - Composable middleware pipeline (`AutoHeartbeatMiddleware.ts`, `SchemaValidationMiddleware.ts`, `ErrorClassificationMiddleware.ts`).
  - Async promise concurrency limiter & adaptive backoff poller (`TaskPoller.ts`).
- **Part 3: Verification Suites**:
  - Java: `WorkerHostTest.java`, `SagaCompensatorTest.java`.
  - TypeScript: `worker-host.test.ts`, `middleware.test.ts`.

## 2. Invariants Followed
- **POLYGLOT WORKER PARITY**: Identical protocol, middleware chain order, and outcome semantics between Java and TypeScript.
- **ZERO-STUB-PROHIBITION**: Real production worker hosts and real compensation routines tested without synthetic stubs.
- **DEFENSIVE CODING**: Graceful shutdown and auto-clearing background heartbeat timers.

## 3. Verification Gate
- `mvn test -pl workflow-engine`: 100% pass on Java worker host & Saga tests.
- `pnpm --filter @unipost/worker test`: 100% pass on TypeScript worker SDK tests.
