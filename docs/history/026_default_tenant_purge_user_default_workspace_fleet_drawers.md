# 026: Default Tenant Purge, User Default Workspace Selection & Fleet Sovereign Drawer Standardization

## Problem Statement
Prior to this recalibration:
1. Legacy fallbacks to `"default-tenant"`, `"Default Organization"`, and `"ws-main"` existed across backend filters, metadata services, domain entities, and frontend stores/mocks.
2. Unassigned users (with no tenant membership) were implicitly falling back into `"default-tenant"` rather than being rejected and directed to a platform custodian.
3. Every tenant required at least 1 immutable default workspace created during onboarding (`isDefault: true`) that cannot be deleted or transferred out, ensuring users are never inadvertently orphaned.
4. Users could not customize their personal default workspace per tenant (`unipost_user_default_ws_${tenantId}`).
5. In Fleet Tenants Ledger (`/system/tenants`), "Manage Workspaces" opened a slide-over `Sheet` while "Manage Users" opened a centered dialog popup with an oversized table, causing visual and structural inconsistency.

## Implementation Plan
1. **Backend Security**: Purge `.orElse("default-tenant")` in `JwtAuthenticationTokenFilter`, `MetadataService`, `SchemaValidationService`, rate limit services, and JPA entity definitions.
2. **Frontend Security**: Guard unassigned users in `ProtectedRoute.tsx` with a Liquid Glass Intervention Screen.
3. **Tenant Default Workspace Invariant**: Protect default workspaces (`isDefault: true`) from deletion across `workspaces-panel.tsx` and `tenant-workspaces-drawer.tsx`.
4. **Personal Default Workspace Preference**: Persist `unipost_user_default_ws_${tenantId}`, auto-resolve on startup, and allow users to toggle defaults in `ProfileSwitcher` and `WorkspacesPanel`.
5. **Fleet Sovereign Drawer Standardization**: Create `TenantUsersDrawer.tsx` (`Sheet` right-side slide-over) and replace the dialog popup in `fleet-tenants-table.tsx`.
6. **Purge References & Verification**: Scrub remaining references, update test suites, and verify via `tsc` and `vitest`.

## Changes Made
- `apps/backend/unipost-fw/src/main/java/com/unipost/fw/core/jwt/JwtAuthenticationTokenFilter.java`: Reject tokens with missing/empty tenantId.
- `apps/backend/unipost-fw/src/main/java/com/unipost/service/MetadataService.java`: Enforce non-null tenant ID.
- `apps/backend/unipost-fw/src/main/java/com/unipost/service/SchemaValidationService.java`: Enforce tenant ID in cache keys.
- `apps/backend/unipost-fw/src/main/java/com/unipost/fw/tenancy/ratelimit/*`: Purged `"default-tenant"` fallbacks.
- `apps/backend/unipost-fw/src/main/java/com/unipost/domain/metadata/*`: Removed default field initialization.
- `apps/backend/unipost-fw/src/test/java/com/unipost/service/SchemaValidationServiceTest.java`: Tested explicitly against `"tenant-acme"`.
- `apps/console/src/features/spring-auth/components/ProtectedRoute.tsx`: Unassigned tenant intervention screen.
- `apps/console/src/core/sandbox/handlers/auth-sandbox-handler.ts`: Replaced default-tenant with commercial tenant mappings.
- `apps/console/src/stores/profile-store.ts`: Added `isDefault` support, personal user default resolution, and `setUserDefault`.
- `apps/console/src/components/layout/data/sidebar-data.ts`: Purged `ws-main`, marked default workspaces.
- `apps/console/src/features/metadata/store/use-metadata-ui-store.ts`: Baseline initialization from `tenant-acme` and personal default workspace.
- `apps/console/src/components/layout/profile-switcher.tsx`: Star toggle for user default workspace, badges, and purged fallbacks.
- `apps/console/src/features/settings/workspaces/workspaces-panel.tsx`: Protected default workspace deletion, user default star button, `DEFAULT WORKSPACE` badge.
- `apps/console/src/features/system/tenants/tenant-workspaces-drawer.tsx`: Disabled delete button for default workspace.
- `apps/console/src/features/system/tenants/tenant-users-drawer.tsx`: Created slide-over user management drawer.
- `apps/console/src/features/system/tenants/fleet-tenants-table.tsx`: Replaced dialog with `TenantUsersDrawer`.
- `apps/console/src/features/landing/components/onboarding-funnel-modal.tsx`: Initialized tenant default workspace with `isDefault: true`.
- `apps/console/DESIGN.md` & `apps/console/ROUTE.md`: Synchronized documentation with sovereign drawers.

## Verification
- `pnpm --filter @unipost/console exec tsc --noEmit`: 0 errors.
- `pnpm --filter @unipost/console exec vitest run`: 24 test suites passed (119/119 tests green).
- `git grep -n "default-tenant" apps/console/src`: 0 occurrences found.
- `git grep -n "Default Organization" apps/console/src`: 0 occurrences found.
- `git grep -n "ws-main" apps/console/src`: 0 occurrences found.
