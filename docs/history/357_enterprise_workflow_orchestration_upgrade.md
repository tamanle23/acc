# 357 - Enterprise Workflow Orchestration Upgrade & Resilience

## Problem
The monorepo workflow orchestration engine had structural vulnerabilities across both `@acc/backend` and `@acc/console`:
1. **Backend Deficiencies**:
   - `WorkflowEngineService.java` contained truncated methods (`simulateExecution`), missing decider hooks, and unhandled lease watchdog delegation.
   - High-concurrency tests triggered SQLite database contention errors during rapid polling.
   - `TaskLeaseWatchdogTest.java` was using Mockito, violating the zero-dependency pure Java hexagonal architecture rule for `workflow-engine`.
   - `WorkflowExecutionController.java` was missing the `GET /api/v1/workflow/executions` list endpoint.
   - `AcyclicityGuard` rejected sequential pipelines having multiple tasks when tasks lacked explicit `joinOn` conditions.
   - Worker retry backoff lacked full jitter, exposing workers to thundering-herd stampedes.
2. **Frontend Deficiencies**:
   - `visual-dag-studio.tsx` was a monolithic >1000 line file mixing canvas rendering, 6 distinct modal dialogs, and high-frequency SSE event handling.
   - In execution mode, rapid SSE stream emissions triggered re-renders across all DAG nodes due to lack of a focused shallow comparator on `DagWorkflowNodeComponent`.
   - DAG nodes lacked WCAG 2.2 AA keyboard accessibility and semantic ARIA attributes.
   - `useWorkflowExecutionsQuery` and the sandbox route handler lacked support for Spring `Page` envelope pagination and keyset pagination.

## Plan
1. **Backend Track (Track A)**:
   - Restore `WorkflowEngineService.java` methods with optimistic terminal idempotency guards.
   - Guard SQLite polling with `ReentrantLock` in `SqliteJdbcPersistenceAdapter.java`.
   - Implement `RetryWithJitterPolicy.java` with unit test.
   - Infer sequential edges in `AcyclicityGuard.java` when definitions omit `joinOn`.
   - Wrap `DataSource` with `TransactionAwareDataSourceProxy` in `WorkflowEngineConfiguration.java`.
   - Implement dual-mode pagination on `WorkflowExecutionController.java` (`/api/v1/workflow/executions` and `/api/workflow/executions`).
   - Add max emitter capacity ceiling (100) per execution in `ExecutionStreamBroadcaster.java`.
2. **Frontend Track (Track B)**:
   - Decompose `visual-dag-studio.tsx` by extracting `DagCanvasContainer` and `DagModalsContainer`.
   - Implement `areDagNodePropsEqual` custom shallow comparator on `dag-node.tsx`.
   - Add WCAG 2.2 AA accessibility (`role="button"`, `tabIndex={0}`, `aria-selected`, dynamic `aria-label`, and `onKeyDown` handlers).
   - Harmonize `use-workflow-executions.ts` and `workflow-handler.ts` for dual-mode pagination and unified contracts.
3. **Verification Track (Track C)**:
   - Execute test suites across `workflow-engine`, `acc-ms-aio`, `@acc/console`, and `@acc/sandbox`.

## Changes

### Backend (`apps/backend`)
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/WorkflowEngineService.java`:
  - Restored `simulateExecution` return payload.
  - Delegated `reapExpiredLeases` to `taskLeaseWatchdog`.
  - Added optimistic idempotency guard in `reportTaskResult`.
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/SqliteJdbcPersistenceAdapter.java`:
  - Added `ReentrantLock pollLock` around `pollTasks`.
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/worker/middleware/RetryWithJitterPolicy.java`:
  - Created exponential backoff with full jitter policy.
- `apps/backend/workflow-engine/src/test/java/com/acc/workflow/worker/RetryWithJitterPolicyTest.java`:
  - Created 6 unit tests validating jitter bounds and exponential scaling.
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/graph/AcyclicityGuard.java`:
  - Added implicit linear sequential chaining when `hasAnyJoinOn == false`.
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/TaskLeaseWatchdog.java`:
  - Fixed property mappings (`tenantId`, `workspaceId`, `taskTypeStr`, `taskReferenceName`).
- `apps/backend/workflow-engine/src/test/java/com/acc/workflow/application/TaskLeaseWatchdogTest.java`:
  - Refactored from Mockito to pure Java `InMemoryPersistenceAdapter`.
- `apps/backend/acc-ms-aio/src/main/java/com/acc/aio/config/WorkflowEngineConfiguration.java`:
  - Wrapped `DataSource` with `TransactionAwareDataSourceProxy`.
- `apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/ExecutionStreamBroadcaster.java`:
  - Added max emitter capacity (100) per execution.
- `apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowExecutionController.java`:
  - Added `@RequestMapping({"/api/v1/workflow/executions", "/api/workflow/executions"})` and implemented dual-mode pagination.
- `apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java`:
  - Fixed unreferenced `request` in `archiveAttributeDefinition` and `unarchiveAttributeDefinition`.
- `apps/backend/acc-ms-worker/pom.xml`:
  - Removed phantom `acc-resources` dependency.
- `apps/backend/acc-fw/src/test/java/com/acc/service/workflow/EntityWorkflowTriggerDispatcherSpELTest.java`:
  - Fixed `EntityRecordMutatedEvent` constructor invocation.
- `apps/backend/acc-ms-aio/src/test/java/com/acc/aio/controller/workflow/WorkflowChaosStressVerificationTest.java`:
  - Updated polling visibility timestamp to `System.currentTimeMillis() + 60000L`.

### Frontend & Sandbox (`apps/console`, `packages/sandbox`)
- `apps/console/src/features/workflows/components/studio/canvas/dag-canvas-container.tsx`:
  - Extracted modular canvas container housing ReactFlow, minimap, controls, and follow-live pill.
- `apps/console/src/features/workflows/components/studio/modals/dag-modals-container.tsx`:
  - Extracted modular modal container housing edge condition, IR, dry-run, simulation, variable watch, and migration dialogs.
- `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`:
  - Decomposed and simplified to orchestrate extracted components cleanly.
- `apps/console/src/features/workflows/components/studio/canvas/dag-node.tsx`:
  - Wrapped `DagWorkflowNodeComponent` with `React.memo` and `areDagNodePropsEqual`.
  - Added WCAG 2.2 AA accessibility attributes and keyboard event handlers.
- `apps/console/src/features/workflows/components/studio/canvas/dag-node.test.tsx`:
  - Added unit tests for memo comparator and keyboard navigation.
- `apps/console/src/features/workflow-executions/api/use-workflow-executions.ts`:
  - Enhanced `useWorkflowExecutionsQuery` to handle both `/api/v1/workflow/executions` and `/api/workflow/executions` with Page envelope normalization.
- `apps/console/src/features/workflow-executions/components/workflow-execution-stream-modal.tsx`:
  - Added fallback resolution for `workflowName` and `workflowId`.
- `packages/sandbox/src/handlers/workflow-handler.ts`:
  - Added dual-mode pagination support (`page`/`size` and `limit`/`afterId`).

## Verification
- `cmd /c "cd apps\backend && mvnw.cmd test -pl workflow-engine -q"`: 65/65 passed (Exit code 0).
- `cmd /c "cd apps\backend && mvnw.cmd test -pl acc-ms-aio -am -Dtest=Workflow*Test -Dsurefire.failIfNoSpecifiedTests=false -q"`: 9/9 passed (Exit code 0).
- `pnpm --filter @acc/console test -- src/features/workflows src/features/workflow-executions`: 115/115 passed (Exit code 0).
- `pnpm --filter @acc/sandbox test`: 98/98 passed (Exit code 0).
- `pnpm --filter @acc/console exec tsc --noEmit --project tsconfig.json`: 0 errors (Exit code 0).

## Walkthrough
- `apps/backend/doc/walkthrough_50.md`
- `apps/console/doc/walkthrough_160.md`

## Tasks
- [x] Complete backend resilience fixes in `workflow-engine` and `acc-ms-aio`.
- [x] Implement enterprise retry policy with full jitter and tests.
- [x] Fix SQLite persistence adapter contention locks.
- [x] Add dual-mode pagination on workflow executions endpoint.
- [x] Decompose `visual-dag-studio.tsx` into modular subcontainers.
- [x] Optimize `dag-node.tsx` with `React.memo` comparator and WCAG 2.2 AA accessibility.
- [x] Harmonize sandbox and console execution query contracts.
- [x] Full monorepo verification across backend and frontend suites.

## Enhancement
- In future iterations, add Web Worker offloading for topological sorting on massive (>500 nodes) workflow graphs.
