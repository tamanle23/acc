# History 092: Polyglot Worker SDKs (Java & Pure TypeScript @unipost/worker) & Distributed Saga (Phase 29)

## Problem
In distributed workflow orchestration, workers must execute tasks reliably across polyglot microservice environments (Java backend and TypeScript/Node services) while preserving strict concurrency bounds, transparent heartbeat lease extensions, and reversible side-effect management via Saga compensation without blocking JVM or Node event loops.

## Plan
1. Implement Java Worker SDK in `apps/backend/workflow-engine`:
   - `TaskContext`, sealed `TaskOutcome`, `WorkerConfig`, `TaskHandler`.
   - Composable middleware chain (`AutoHeartbeatMiddleware`, `SchemaValidationMiddleware`, `ErrorClassificationMiddleware`).
   - `WorkerHost` leveraging virtual-thread per task execution, Semaphore concurrency backpressure, adaptive exponential backoff polling, and burst draining.
   - `SagaCompensator` computing reverse topological execution sequences and emitting compensation `ScheduleTask` commands.
2. Implement standalone pure TypeScript Worker SDK in `packages/worker/` (`@unipost/worker`):
   - TypeScript `TaskOutcome` discriminated union and `TaskContext`.
   - `ConcurrencyLimiter` and adaptive `TaskPoller`.
   - `WorkflowWorkerHost` supporting `register()`, `registerSimple()`, and middleware chaining.
   - Parity middleware pipeline (`AutoHeartbeatMiddleware`, `SchemaValidationMiddleware`, `ErrorClassificationMiddleware`).
   - `HttpWorkerTransportClient` communicating with standard engine endpoints.
3. Verification:
   - JUnit 5 tests in `WorkerHostTest.java` and `SagaCompensatorTest.java`.
   - Vitest tests in `packages/worker/src/__tests__/`.
   - Strict TypeScript typechecking.

## Changes
- **Java**:
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/TaskContext.java`
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/TaskOutcome.java`
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/TaskHandler.java`
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/WorkerConfig.java`
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/WorkerHost.java`
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/middleware/AutoHeartbeatMiddleware.java`
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/middleware/SchemaValidationMiddleware.java`
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/worker/middleware/ErrorClassificationMiddleware.java`
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/application/SagaCompensator.java`
  - `apps/backend/workflow-engine/src/test/java/com/unipost/workflow/worker/WorkerHostTest.java`
  - `apps/backend/workflow-engine/src/test/java/com/unipost/workflow/application/SagaCompensatorTest.java`
- **TypeScript**:
  - `packages/worker/package.json`
  - `packages/worker/tsconfig.json`
  - `packages/worker/src/types.ts`
  - `packages/worker/src/index.ts`
  - `packages/worker/src/host/ConcurrencyLimiter.ts`
  - `packages/worker/src/host/TaskPoller.ts`
  - `packages/worker/src/host/WorkflowWorkerHost.ts`
  - `packages/worker/src/client/HttpWorkerTransportClient.ts`
  - `packages/worker/src/middleware/AutoHeartbeatMiddleware.ts`
  - `packages/worker/src/middleware/SchemaValidationMiddleware.ts`
  - `packages/worker/src/middleware/ErrorClassificationMiddleware.ts`
  - `packages/worker/src/__tests__/worker-host.test.ts`
  - `packages/worker/src/__tests__/middleware.test.ts`

## Verification
- `mvn test -pl workflow-engine`: 25/25 passing tests.
- `pnpm --filter @unipost/worker test`: 5/5 passing Vitest tests.
- `pnpm --filter @unipost/worker check-types`: 0 type errors.
