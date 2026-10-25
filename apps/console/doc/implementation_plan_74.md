# Implementation Plan 74: Default Tenant Purge, User Default Workspace Selection & Fleet Sovereign Drawer Standardization

## 1. Overview
This plan implements the comprehensive domain recalibration:
- Purges `default-tenant` / `Default Organization` across console and backend.
- Enforces user-to-tenant authentication guard (`ProtectedRoute` blocks unassigned users).
- Guarantees every tenant has at least 1 immutable default workspace that cannot be deleted.
- Allows each user to select their personal default workspace per tenant (`acc_user_default_ws_${tenantId}`).
- Replaces the modal dialog popup for "Manage Users" in Fleet Tenants Ledger with a dedicated right-side `TenantUsersDrawer`, bringing symmetrical slide-over UX with "Manage Workspaces".

## 2. Key Target Files
- `apps/backend/acc-fw/src/main/java/com/acc/fw/core/jwt/JwtAuthenticationTokenFilter.java`
- `apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java`
- `apps/backend/acc-fw/src/main/java/com/acc/service/SchemaValidationService.java`
- `apps/backend/acc-fw/src/test/java/com/acc/service/SchemaValidationServiceTest.java`
- `apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/*.java`
- `apps/console/src/features/spring-auth/components/ProtectedRoute.tsx`
- `apps/console/src/components/layout/data/sidebar-data.ts`
- `apps/console/src/stores/profile-store.ts`
- `apps/console/src/features/metadata/store/use-metadata-ui-store.ts`
- `apps/console/src/features/system/tenants/tenant-workspaces-drawer.tsx`
- `apps/console/src/features/system/tenants/tenant-users-drawer.tsx` (new)
- `apps/console/src/features/system/tenants/fleet-tenants-table.tsx`
- `apps/console/src/features/settings/workspaces/workspaces-panel.tsx`
- `apps/console/src/core/sandbox/handlers/auth-sandbox-handler.ts`

## 3. Verification
- `pnpm --filter @acc/console exec tsc --noEmit`
- `pnpm --filter @acc/console exec vitest run`
