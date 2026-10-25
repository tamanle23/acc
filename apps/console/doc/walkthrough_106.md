# Walkthrough 106: Fix DLQ Sandbox Route Matcher & Dock Query Invalidation for Injected Tasks

## Summary
Resolved the issue where injected Dead-Letter Queue (DLQ) tasks triggered from `SandboxDock` displayed a success notification but did not appear in the `/system/dlq` table or update reactively without a manual page reload.

## Changes Made
1. **`packages/sandbox/src/handlers/dlq-sandbox-handler.ts`**:
   - Elevated handler priority from `15` to `99` (higher than `systemSandboxHandler`'s `98`), preventing shadowing and unexpected 404 fall-throughs on `/system/dlq` paths.
   - Replaced fragile substring URL matcher with normalized path matcher that strips API prefixes (`/api/v1`, `/api/api`, `/api`, `/v1`) and reliably matches both `/system/dlq` and `/workflow/dlq` requests.
   - Updated handler route logic to cleanly parse normalized paths for `/inject`, `/:id/replay`, `/:id` DELETE/GET, and list queries.
2. **`apps/console/src/core/sandbox/ui/sandbox-dock.tsx`**:
   - Injected tasks via `springApiClient.post('/system/dlq/inject')` with an in-memory repository fallback.
   - Added immediate TanStack Query invalidation via `queryClient.invalidateQueries({ queryKey: DLQ_QUERY_KEY })` on task injection.
   - Added `queryClient.invalidateQueries()` to master reset (`handleResetAllData`).
3. **`packages/sandbox/src/__tests__/sandbox-engine.test.ts`**:
   - Added end-to-end integration test validating priority routing over `systemSandboxHandler`, injection via `/api/system/dlq/inject`, and querying via both `/api/system/dlq` and `/api/v1/system/dlq`.

## Verification Results
- `pnpm --filter @acc/sandbox test`: All 10 tests passed (including DLQ sandbox priority and injection tests).
- `pnpm --filter @acc/console test dlq-feature`: All 4 tests passed.
- `pnpm --filter @acc/sandbox check-types`: Clean typecheck.
- `pnpm --filter @acc/console exec tsc --noEmit`: Clean typecheck.
