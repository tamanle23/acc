# History Log 022: Assume-Tenant Session Lifecycle & Viewport Banner Fix

## Problem
Clicking "Assume Tenant" on a tenant in `fleet-tenants-table.tsx` caused the page to reload with no visible changes:
1. `ephemeralToken` returned by `system-sandbox-handler.ts` was an arbitrary string (`sb_assume_...`) rather than a valid JWT, failing JWT decoding in `useSpringAuthStore`.
2. `handleAssumeTenant` performed `window.location.reload()`, keeping the user on `/system/tenants` looking at the same fleet table.
3. `AssumeTenantBar.tsx` evaluated `effectiveTenant = currentTenantId || activeTenantId` and checked `effectiveTenant !== 'SYSTEM'`. Since `activeTenantId` was still `'SYSTEM'` in `useSandboxStore`, `effectiveTenant !== 'SYSTEM'` evaluated to `false`, causing the banner to return `null` and remain hidden.
4. Neither `useSandboxStore` nor `useMetadataUiStore` updated their tenant state.

## Plan
1. In `system-sandbox-handler.ts`, use `createMockJwt` to construct a real JWT containing `tenantId`, `actor_tid: 'SYSTEM'`, and delegated permissions.
2. In `AssumeTenantBar.tsx`, simplify detection to `isAssumed = Boolean(assumedTenant && assumedTenant !== 'SYSTEM')`.
3. In `fleet-tenants-table.tsx`, update `useSpringAuthStore`, `useSandboxStore`, and `useMetadataUiStore` on success and navigate to `/metadata`.
4. In `sidebar-data.ts`, adapt navigation items when running under delegated assumed sessions.
5. Add unit tests for `AssumeTenantBar` and verify all tests pass.

## Changes
- `apps/console/src/core/sandbox/handlers/system-sandbox-handler.ts`: Replaced mock string with `createMockJwt` containing full claims.
- `apps/console/src/components/layout/assume-tenant-bar.tsx`: Reliably checks `localStorage.getItem('acc_assumed_tenant')`, renders banner, and restores `SYSTEM` on exit.
- `apps/console/src/features/system/tenants/fleet-tenants-table.tsx`: Updated stores on assume and navigates to `/metadata`.
- `apps/console/src/components/layout/data/sidebar-data.ts`: Dynamic adaptation for assumed tenant state.
- `apps/console/src/locales/en/console.json` & `vi/console.json`: Added `sovereignDelegated` translation.
- `apps/console/src/core/sandbox/__tests__/system-sandbox.test.ts`: Verified decoded JWT claims.
- `apps/console/src/features/system/__tests__/sovereign-cockpit-ui.test.tsx`: Added tests for `AssumeTenantBar`.

## Verification
- `pnpm --filter @acc/console exec vitest run src/features/system src/core/sandbox`: 56/56 PASS.
- Total console vitest suite: 93/93 PASS.
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.

## Walkthrough
Detailed walkthrough documented in [`apps/console/doc/walkthrough_70.md`](../../apps/console/doc/walkthrough_70.md).
