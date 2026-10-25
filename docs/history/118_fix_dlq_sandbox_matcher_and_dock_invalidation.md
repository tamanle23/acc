# 118: Fix DLQ Sandbox Route Matcher & Dock Query Invalidation for Injected Tasks

## Problem
When clicking the "Inject Poison Task (DLQ)" button inside the `SandboxDock` diagnostics panel, a toast notification confirmed task injection (`Injected DLQ task: wf-sim-1634_task_3786 (ISOLATED)`), but no new record appeared in the Dead-Letter Queue table on the `/system/dlq` page.

Root cause analysis identified two defects:
1. **Route Matcher & Priority Shadowing**:
   - `packages/sandbox/src/handlers/system-sandbox-handler.ts` had a high priority (`priority: 98`) and intercepted all requests matching `/api/v1/system*`.
   - `dlqSandboxHandler` had a low priority (`priority: 15`) and only checked for exact substring `/api/v1/system/dlq`.
   - In `apps/console/src/features/dlq/hooks/use-dlq.ts`, `springApiClient` has `baseURL: '/api'` and calls `/system/dlq`, which resolves to `/api/system/dlq`. This bypassed the DLQ handler or was shadowed by the system handler, leading to route misses or 404 responses.
2. **Missing Reactive Cache Invalidation**:
   - `sandbox-dock.tsx` invoked `dlqSandboxRepository.injectPoisonTask()` directly in memory without issuing an HTTP request or invalidating the TanStack Query cache (`['system-dlq']`), preventing immediate UI synchronization.

## Plan
1. Elevate `dlqSandboxHandler` priority to `99` (above `systemSandboxHandler`'s `98`).
2. Update `dlqSandboxHandler.matcher` and handler parsing to normalize paths across `/api/system/dlq`, `/api/v1/system/dlq`, `/system/dlq`, and `/workflow/dlq`.
3. Update `SandboxDock` to issue a `POST /system/dlq/inject` call and immediately invalidate `DLQ_QUERY_KEY` queries via `useQueryClient()`.
4. Add automated test coverage in `@acc/sandbox` to verify priority ordering and endpoint dispatch.

## Changes

### 1. Unified Sandbox Platform
- **`packages/sandbox/src/handlers/dlq-sandbox-handler.ts`**:
  - Set `priority: 99`.
  - Normalized path matching using `cleanPath.startsWith('/system/dlq') || cleanPath.startsWith('/workflow/dlq')`.
  - Updated action routes (`/inject`, `/:id/replay`, `/:id` DELETE/GET, and list) to parse normalized paths.
- **`packages/sandbox/src/__tests__/sandbox-engine.test.ts`**:
  - Added test case validating `systemSandboxHandler` coexistence, injection via `/api/system/dlq/inject`, and querying via both `/api/system/dlq` and `/api/v1/system/dlq`.

### 2. Console UI
- **`apps/console/src/core/sandbox/ui/sandbox-dock.tsx`**:
  - Imported `useQueryClient` and `DLQ_QUERY_KEY`.
  - Updated "Inject Poison Task (DLQ)" button to invoke `springApiClient.post('/system/dlq/inject', {})` and invalidate `DLQ_QUERY_KEY`.
  - Added global query cache invalidation on master reset (`handleResetAllData`).

## Verification
- Ran `pnpm --filter @acc/sandbox test`: 10/10 tests passed.
- Ran `pnpm --filter @acc/console test dlq-feature`: 4/4 tests passed.
- Ran `pnpm --filter @acc/sandbox check-types`: Clean typecheck.
- Ran `pnpm --filter @acc/console exec tsc --noEmit`: Clean typecheck.

## Tasks
- [x] Analyze routing and query synchronization between `SandboxDock` and `useDlqQuery`.
- [x] Elevate priority and normalize paths in `dlqSandboxHandler`.
- [x] Wire API injection and TanStack Query cache invalidation in `SandboxDock`.
- [x] Add automated test coverage in `@acc/sandbox`.
- [x] Verify builds, lints, and test suites across affected packages.
