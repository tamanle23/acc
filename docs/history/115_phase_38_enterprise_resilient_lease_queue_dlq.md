# 115. Phase 38: Enterprise Resilient Lease Queue, Poison DLQ & Priority Queuing

## Problem Statement
The distributed workflow task queue required production-grade resilience against poisoned tasks, zombie worker leases, and starvation under high concurrency. Unhandled fatal failures or tasks exceeding retry limits could repeatedly crash workers or block queues. Furthermore, operators lacked a centralized UI to inspect stack traces, edit failed task payloads, and replay executions safely.

## Implementation Plan
1. **Schema & Domain Storage**:
   - Create `task_dlq` table in PostgreSQL and SQLite with tenant and status indexes.
   - Add `created_at_ms` to `task_queue` to track queue wait duration.
   - Model immutable domain entity `TaskDlqRecord.java` and declare CRUD operations on `PersistencePort`.
2. **Dynamic Priority Aging & Adaptive Lease Reclamation**:
   - Implement dynamic aged priority in `InMemoryPersistenceAdapter`, `SqliteJdbcPersistenceAdapter`, and `PostgresJdbcPersistenceAdapter` (`+1` priority every 5s wait).
   - In `WorkflowEngineService.java`, automatically isolate poisoned tasks exceeding `maxRetries` or failing fatally into `task_dlq`.
   - Update `sweepExpiredTasks()` to reclaim abandoned worker leases, incrementing attempts and quarantining orphaned tasks exceeding retries to DLQ.
   - Implement `replayDlqTask` (resets retries to 1, priority to 100, merges payload overrides, sets workflow back to `RUNNING`) and `discardDlqTask`.
3. **REST Management APIs**:
   - Create `WorkflowDlqController.java` exposing `/api/v1/workflow/dlq` endpoints.
4. **Worker SDK Jitter**:
   - Implement exponential backoff with 20% randomized jitter in `@unipost/worker` (`TaskPoller.ts`).
5. **Unified Sandbox & UI Console**:
   - Implement `dlq-sandbox-handler.ts` in `packages/sandbox` with tenant isolation and reset support.
   - Create `@unipost/console` feature (`apps/console/src/features/dlq/`) adhering strictly to `COMMON-COMPONENT-PRIORITY` (`DataTable`, `DataTableToolbar`, `DataTablePagination`), Liquid Glass styling, and slide-over `DlqInspectorSheet`.
   - Wire route `/_authenticated/dlq/`, sidebar navigation under Admin group, and i18n locales (`en`, `vi`).
6. **Verification & Artifacts**:
   - Automated tests across backend persistence, engine service, REST API, worker poller, and console UI.
   - Generate app walkthroughs and history documentation.

## Changes Made
- **Backend Core**:
  - `apps/backend/workflow-engine/src/main/resources/db/schema-postgres.sql` & `schema-sqlite.sql`: Added `created_at_ms` and `task_dlq` schema.
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/TaskDlqRecord.java`: Domain record.
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/ports/PersistencePort.java`: DLQ port definitions.
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/adapters/storage/InMemoryPersistenceAdapter.java`: Dynamic priority sorting & DLQ memory map.
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/adapters/storage/SqliteJdbcPersistenceAdapter.java`: SQLite SQL priority age formula and DLQ CRUD.
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/adapters/storage/PostgresJdbcPersistenceAdapter.java`: PostgreSQL `FOR UPDATE SKIP LOCKED` priority aging & DLQ CRUD.
  - `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/application/WorkflowEngineService.java`: DLQ isolation, zombie worker lease reclamation, replay, and discard.
  - `apps/backend/unipost-ms-aio/.../WorkflowDlqController.java`: REST controller for `/api/v1/workflow/dlq`.
- **Worker SDK**:
  - `packages/worker/src/host/TaskPoller.ts`: Exponential backoff with 20% randomized jitter.
  - `packages/worker/src/__tests__/jittered-poller.test.ts`: Jitter unit test.
- **Client & Sandbox**:
  - `packages/client/src/contracts/workflows.ts`: DLQ DTO interfaces.
  - `packages/sandbox/src/handlers/dlq-sandbox-handler.ts`: Unified sandbox mock handler.
  - `packages/sandbox/src/index.ts`: Registered handler.
- **Console Web UI**:
  - `apps/console/src/features/dlq/hooks/use-dlq.ts`: TanStack Query hooks.
  - `apps/console/src/features/dlq/components/dlq-columns.tsx`: Data table columns.
  - `apps/console/src/features/dlq/components/dlq-table.tsx`: Common `DataTable` wrapper.
  - `apps/console/src/features/dlq/components/dlq-inspector-sheet.tsx`: Slide-over inspector sheet.
  - `apps/console/src/features/dlq/index.tsx`: DLQ dashboard with Liquid Glass KPI cards.
  - `apps/console/src/routes/_authenticated/dlq/index.tsx`: TanStack route.
  - `apps/console/src/routeTree.gen.ts`: Registered `/dlq/` route.
  - `apps/console/src/components/layout/data/sidebar-data.ts`: Added `/dlq` navigation item to Admin group.
  - `apps/console/src/locales/{en,vi}/console.json`: Synced localization keys.
  - `apps/console/ROUTE.md`: Updated layout tree, matrix, and screen blueprint.
  - `apps/console/src/features/dlq/__tests__/dlq-feature.test.tsx`: DLQ unit tests.

## Verification
- **Backend**:
  - `PersistenceContractTest.testDeadLetterQueueOperations`: Passed.
  - `WorkflowEngineServiceTest.shouldQuarantineTaskToDlqWhenRetriesExhaustedAndSupportReplay`: Passed.
  - Total `workflow-engine` tests: 45 passed, 0 failures.
  - `WorkflowDlqRestApiTest`: 2 tests passed (list, filter, discard, end-to-end task isolation and replay).
- **Worker**:
  - `@unipost/worker`: 4 test suites passed, 7/7 tests passed.
- **Sandbox**:
  - `@unipost/sandbox`: Type check passed clean (`check-types`).
- **Console UI**:
  - `vitest run dlq-feature`: 3/3 tests passed.
  - `pnpm --filter @unipost/console exec tsc --noEmit`: Passed clean with 0 errors.

## Walkthrough
- Backend: `apps/backend/doc/walkthrough_39.md`
- Console UI: `apps/console/doc/walkthrough_103.md`

## Tasks
- [x] Dedicated `task_dlq` schema and persistence adapters.
- [x] Multi-tenant dynamic priority aging and starvation prevention.
- [x] Zombie worker lease reclamation in `sweepExpiredTasks`.
- [x] REST API for quarantine inspection, discard, and replay.
- [x] Anti-thundering herd jittered poller in Worker SDK.
- [x] Unified Sandbox mock handler and stateful repository.
- [x] Liquid Glass DLQ management UI reusing common `DataTable`.
- [x] Verification tests across backend, worker, sandbox, and UI.

## Enhancement
Future phases may introduce scheduled batch replaying with rate limits and automated alerting webhooks (Slack/PagerDuty) upon sudden DLQ quarantine rate spikes.
