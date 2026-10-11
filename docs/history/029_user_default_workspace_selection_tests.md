# 029: User Personal Default Workspace Selection Test Suite

## Problem Statement
In Phase 4 of the Tenant Default Workspace & Sovereign Drawers blueprint (`docs/multi-tenants/12_tenant_default_workspace_and_fleet_drawers_plan.md`), users were given the ability to customize their personal default workspace per tenant (`unipost_user_default_ws_${tenantId}`). When booting or switching tenants, this preference takes precedence over the tenant root default workspace. Automated unit tests were needed in `WorkspacesPanel` and `ProfileSwitcher` to verify this selection lifecycle and persistence.

## Implementation Plan
1. Update `apps/console/src/features/settings/workspaces/workspaces.test.tsx` to assert that:
   - Users can click "Đặt làm mặc định" on workspace cards.
   - `localStorage` key `unipost_user_default_ws_tenant-acme` is properly persisted.
   - The `MY DEFAULT` badge is dynamically rendered on the user's preferred workspace card.
2. Update `apps/console/src/components/layout/__tests__/profile-switcher.test.tsx` to assert that:
   - Calling `setUserDefault` updates both `useProfileStore` and `localStorage`.
   - `ProfileSwitcher` immediately renders and reflects the customized personal default workspace.
3. Verify test pass with `vitest` and `tsc --noEmit`.

## Changes Made
- `apps/console/src/features/settings/workspaces/workspaces.test.tsx`: Added unit test verifying personal default workspace selection and `MY DEFAULT` badge rendering.
- `apps/console/src/components/layout/__tests__/profile-switcher.test.tsx`: Added unit test verifying `setUserDefault` lifecycle and switcher reflection.

## Verification
- `pnpm --filter @unipost/console exec vitest run src/components/layout/__tests__/profile-switcher.test.tsx src/features/settings/workspaces/workspaces.test.tsx`: 10/10 tests green.
- `pnpm --filter @unipost/console exec vitest run`: 26/26 test suites passed (129/129 tests green).
- `pnpm --filter @unipost/console exec tsc --noEmit`: 0 errors.
