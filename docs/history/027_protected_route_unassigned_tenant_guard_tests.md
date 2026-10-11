# 027: ProtectedRoute Unassigned Tenant Guard & Intervention Screen Test Suite

## Problem Statement
In Phase 2 of the Tenant Default Workspace & Sovereign Drawers blueprint (`docs/multi-tenants/12_tenant_default_workspace_and_fleet_drawers_plan.md`), `ProtectedRoute.tsx` was hardened with a Tenant Assignment Guard. Non-SYSTEM users with empty or missing tenant IDs are blocked from accessing workspaces and rendered a Liquid Glass Unassigned Tenant Intervention Screen. Dedicated automated test coverage was needed to formally verify this authentication guard and its user interaction lifecycle.

## Implementation Plan
1. Create `apps/console/src/features/spring-auth/components/__tests__/protected-route.test.tsx`.
2. Cover the following verification scenarios:
   - Unauthenticated redirect: Unauthenticated users are redirected to `/sign-in`.
   - Valid tenant access: Authenticated users with valid `tenantId` (e.g. `tenant-acme`) have access and their children render.
   - Unassigned tenant intervention: Authenticated users with empty/missing `tenantId` are blocked, and the Liquid Glass Unassigned Tenant Intervention Screen is rendered with "No Organization Assigned" and security directives.
   - Sign Out action: Clicking "Sign Out" on the intervention screen clears tokens and redirects to `/sign-in`.
   - Sovereign Platform exception: `ROLE_SYSTEM_CUSTODIAN` users with `SYSTEM` tenant are permitted without blocking.
3. Verify test pass with `vitest` and `tsc --noEmit`.

## Changes Made
- `apps/console/src/features/spring-auth/components/__tests__/protected-route.test.tsx`: Added 5 unit tests covering Phase 2 authentication guard lifecycle and UI elements.

## Verification
- `pnpm --filter @unipost/console exec vitest run src/features/spring-auth/components/__tests__/protected-route.test.tsx`: 5/5 tests green.
- `pnpm --filter @unipost/console exec vitest run`: 25/25 test suites passed (124/124 tests green).
- `pnpm --filter @unipost/console exec tsc --noEmit`: 0 errors.
