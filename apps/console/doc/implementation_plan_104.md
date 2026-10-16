# Implementation Plan 104 - Move DLQ Screen to SYSTEM Root Workspace & Restrict UI Access

## Problem Statement
The Dead-Letter Queue screen currently resides under `/dlq` and is visible in the general `Admin` group for all tenants. DLQ operations manipulate poisoned execution units and error stack traces across distributed infrastructure, which belongs strictly inside the SYSTEM Sovereign Root Custodian workspace (`/_authenticated/system/dlq`).

## Proposed Changes
1. **Route Migration**:
   - Create `apps/console/src/routes/_authenticated/system.dlq.tsx` mapped to `/_authenticated/system/dlq`.
   - Remove legacy `apps/console/src/routes/_authenticated/dlq/index.tsx`.
   - Wrap route with sovereign permission check.
2. **Navigation Reorganization (`sidebar-data.ts`)**:
   - Remove `/dlq` from `sidebar.groups.admin`.
   - Add `/system/dlq` into `Sovereign Custody (Root)` group with `badge: 'ROOT'`.
3. **UI Enhancements (`features/dlq`)**:
   - Update `DlqFeature` header to include `Sovereign Platform Root` banner badge.
   - Enforce `usePermissions().isSovereignCustodian` access check; render 403 Forbidden alert if visited by commercial tenant.
   - Update `use-dlq.ts` hooks to target `/system/dlq`.
4. **Unified Sandbox Simulation (`packages/sandbox`)**:
   - Update `dlq-sandbox-handler.ts` matcher to accept `/api/v1/system/dlq`.
   - Support cross-tenant queries when `activeTenantId === 'SYSTEM'`.
5. **Living Docs & Tests**:
   - Update `apps/console/ROUTE.md`.
   - Update `apps/console/src/features/dlq/__tests__/dlq-feature.test.tsx`.
   - Regenerate `routeTree.gen.ts`.

## Verification
- `pnpm --filter @unipost/sandbox check-types`
- `pnpm --filter @unipost/console exec tsc --noEmit`
- `vitest run dlq-feature`
