# Implementation Plan 103: Worker SDK Jitter, Unified Sandbox & DLQ Management UI (Phase 38 Frontend & Worker)

Implement exponential jittered backoff in `@acc/worker`, register DLQ domain contracts and mock handlers in `@acc/client` and `@acc/sandbox`, and deliver the dedicated `/dlq` management console interface in `@acc/console`.

## Proposed Changes

### 1. TypeScript Worker SDK (`packages/worker`)
- `packages/worker/src/host/TaskPoller.ts`:
  - Enhance `pollAndExecute` to implement full exponential jittered backoff.
  - Track `consecutiveEmptyPolls`.
  - Calculate `interval = Math.min(maxBackoffMs, baseBackoffMs * Math.pow(2, consecutiveEmptyPolls))`.
  - Add `jitter = Math.random() * (interval * 0.2)`.
  - Reset backoff exponent immediately to 0 when tasks are polled.

### 2. Client Contracts & DTOs (`packages/client`)
- `packages/client/src/domains/workflow.types.ts`:
  - Define `TaskDlqRecordDto`, `DlqFilterParams`, `ReplayDlqRequestDto`.
- `packages/client/src/domains/workflow.client.ts`:
  - Add `listDlqTasks(params)`, `getDlqTask(id)`, `replayDlqTask(id, body)`, `discardDlqTask(id)`.

### 3. Unified Sandbox (`packages/sandbox`)
- `packages/sandbox/src/handlers/dlq-handler.ts`:
  - Implement `SandboxRouteHandler` for `/api/v1/workflow/dlq*` endpoints.
  - Stateful mock repository with seed data and `reset()`.
- Register in `packages/sandbox/src/index.ts` and `apps/console/src/core/sandbox/index.ts`.

### 4. Console UI (`apps/console`)
- `apps/console/src/features/dlq/`:
  - `components/dlq-columns.tsx`: TanStack table column definitions with `DataTableColumnHeader` for Task Reference, Type, Tenant, Error Message, Isolated At, Status, and Actions (`Replay`, `Discard`, `Inspect`).
  - `components/dlq-table.tsx`: Shared `DataTable` with `DataTableToolbar` (status faceted filter `ISOLATED`, `REPLAYED`, `DISCARDED`) and `DataTablePagination`.
  - `components/dlq-inspector-sheet.tsx`: Slide-over inspector displaying stack trace, payload snapshot, and replay override form.
  - `index.tsx`: Main DLQ page container.
- Route registration:
  - `apps/console/src/routes/_authenticated/dlq/index.tsx`.
- Sidebar navigation:
  - Add `/dlq` to Admin group in `apps/console/src/components/layout/data/sidebar-data.ts`.
- Locale keys:
  - Add DLQ localization strings in `apps/console/src/locales/en/console.json` and `vi/console.json`.

## Verification Plan

### Automated Tests
- Worker SDK tests:
  - `packages/worker/src/__tests__/jittered-poller.test.ts`: test exponential backoff and jitter calculations.
- Console feature tests:
  - `apps/console/src/features/dlq/__tests__/dlq-feature.test.tsx`: test rendering, column sorting, filtering, inspector trigger, and replay mutation.
- Typecheck & Build:
  - `pnpm --filter @acc/worker test`
  - `pnpm --filter @acc/console exec tsc --noEmit`
  - `pnpm --filter @acc/console test`
