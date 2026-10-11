# 028: Tenant Immutable Default Workspace Protection Test Suite

## Problem Statement
In Phase 3 of the Tenant Default Workspace & Sovereign Drawers blueprint (`docs/multi-tenants/12_tenant_default_workspace_and_fleet_drawers_plan.md`), the system introduced the invariant that every tenant must have at least 1 immutable default workspace (`isDefault: true`) that cannot be deleted or removed. Automated tests were needed across `WorkspacesPanel` and `TenantWorkspacesDrawer` to formally enforce that deletion of default or sole remaining workspaces is blocked and disabled with appropriate UI feedback.

## Implementation Plan
1. Update `apps/console/src/features/settings/workspaces/workspaces.test.tsx` to assert that the delete button for default workspaces is disabled with the protected tooltip.
2. Create `apps/console/src/features/system/tenants/__tests__/tenant-workspaces-drawer.test.tsx` to verify:
   - Default workspaces display the `DEFAULT` badge.
   - The delete action for default workspaces is disabled.
   - Non-default secondary workspaces have enabled delete buttons.
   - Deletion is disabled if only 1 workspace remains for the tenant.
3. Verify test pass with `vitest` and `tsc --noEmit`.

## Changes Made
- `apps/console/src/features/settings/workspaces/workspaces.test.tsx`: Added test asserting disabled delete button for default workspaces.
- `apps/console/src/features/system/tenants/__tests__/tenant-workspaces-drawer.test.tsx`: Added test suite for `TenantWorkspacesDrawer` verifying immutable default workspace rendering and deletion protections.

## Verification
- `pnpm --filter @unipost/console exec vitest run src/features/system/tenants/__tests__/tenant-workspaces-drawer.test.tsx src/features/settings/workspaces/workspaces.test.tsx`: 5/5 tests green.
- `pnpm --filter @unipost/console exec vitest run`: 26/26 test suites passed (127/127 tests green).
- `pnpm --filter @unipost/console exec tsc --noEmit`: 0 errors.
