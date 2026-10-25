# Walkthrough 103 - Phase 38: Dead-Letter Queue (DLQ) Management UI, Worker Jitter & Unified Sandbox

## Summary
Phase 38 delivers complete front-to-back resilience across the polyglot worker layer, unified sandbox mock platform, and `@acc/console` web application:
1. **Worker SDK Jitter & Anti-Thundering Herd**: Enhanced `packages/worker/src/host/TaskPoller.ts` with exponential backoff and randomized 20% jitter.
2. **Unified Sandbox Simulation**: Created `packages/sandbox/src/handlers/dlq-sandbox-handler.ts` with stateful in-memory repository, realistic seed failure tasks, tenant isolation, and reset capability.
3. **Dead-Letter Queue Management Console**:
   - Built dedicated `/dlq` interface in `@acc/console/src/features/dlq/`.
   - Reused common primitives (`DataTable`, `DataTableToolbar`, `DataTablePagination`) adhering strictly to `COMMON-COMPONENT-PRIORITY`.
   - Designed 3 Liquid Glass KPI metric cards (Isolated Tasks, Replayed Recoveries, Discarded Tasks).
   - Implemented `DlqInspectorSheet` slide-over drawer displaying stack traces, formatted JSON payload snapshots, and JSON override inputs.
   - Wired replay mutation with TanStack Query cache invalidation and toast feedback.
4. **Navigation & Locale Sync**:
   - Added `/dlq` route to Admin group in `sidebar-data.ts`.
   - Synchronized English and Vietnamese translations in `apps/console/src/locales/{en,vi}/console.json`.
   - Updated `apps/console/ROUTE.md` specifications and blueprints.

---

## Changes
- **Worker SDK**:
  - `packages/worker/src/host/TaskPoller.ts`: Added exponential backoff and `Math.random()` jitter logic to empty poll intervals.
  - `packages/worker/src/__tests__/jittered-poller.test.ts`: Unit test asserting backoff calculation and randomized bounds.
- **Client & Sandbox**:
  - `packages/client/src/contracts/workflows.ts`: Exported `TaskDlqRecordDto`, `DlqFilterParams`, `ReplayDlqRequestDto`.
  - `packages/sandbox/src/handlers/dlq-sandbox-handler.ts`: Registered `dlqSandboxHandler` in `packages/sandbox/src/index.ts`.
- **Console Feature & Route**:
  - `apps/console/src/features/dlq/hooks/use-dlq.ts`: Query and replay/discard mutations.
  - `apps/console/src/features/dlq/components/dlq-columns.tsx`: TanStack Table columns with status badges and action menus.
  - `apps/console/src/features/dlq/components/dlq-table.tsx`: Shared `DataTable` integration.
  - `apps/console/src/features/dlq/components/dlq-inspector-sheet.tsx`: Slide-over inspector sheet.
  - `apps/console/src/features/dlq/index.tsx`: Main page component with Liquid Glass KPI cards.
  - `apps/console/src/routes/_authenticated/dlq/index.tsx`: TanStack route.
  - `apps/console/src/features/dlq/__tests__/dlq-feature.test.tsx`: Feature and component unit test suite.

---

## Verification Results
- **Worker Tests**:
  - `packages/worker`: 4 test suites passed, 7/7 tests passed.
- **Sandbox Checks**:
  - `pnpm --filter @acc/sandbox check-types`: Passed clean with 0 TypeScript errors.
- **Console UI Tests & Types**:
  - `vitest run dlq-feature`: 3/3 tests passed (table render, inspector sheet replay with overrides, dashboard metrics).
  - `pnpm --filter @acc/console exec tsc --noEmit`: Passed with 0 TypeScript errors.
