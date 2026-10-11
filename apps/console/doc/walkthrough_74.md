# Walkthrough 74: Default Tenant Purge, User Default Workspace Selection & Fleet Sovereign Drawer Standardization

## 1. Problem Statement & Motivation
Prior to this implementation:
1. The platform retained legacy fallbacks to `"default-tenant"`, `"Default Organization"`, and `"ws-main"` across backend security filters, JWT decoding, JPA entity initializations, and console stores/handlers.
2. If a user had no tenant assigned, they fell back silently to `"default-tenant"` rather than being rejected and guided to intervention.
3. Every tenant required at least 1 immutable default workspace created during onboarding (`isDefault: true`) that cannot be deleted or transferred out, ensuring users are never inadvertently left without a workspace.
4. Users could not easily select their own personal default workspace preference per tenant (`unipost_user_default_ws_${tenantId}`).
5. In Fleet Tenants Ledger (`/system/tenants`), "Manage Workspaces" opened a slide-over `Sheet` while "Manage Users" opened a centered dialog popup with an oversized table, creating UX asymmetry.

## 2. Summary of Changes

### Backend Security Hardening (`unipost-fw`)
- **`JwtAuthenticationTokenFilter.java`**: Purged `.orElse("default-tenant")`. Missing or blank `tenantId` now rejects authentication with HTTP 401.
- **`MetadataService.java` & `SchemaValidationService.java`**: Throws `SecurityException` if tenant context is missing when accessing or creating records; schema validation cache keys enforce active tenant.
- **`TenantRateLimitFilter.java` & `TenantRateLimitService.java`**: Removed `"default-tenant"` fallback.
- **JPA Domain Entities** (`EntityType`, `AttributeDefinition`, `EntityRecord`, `EntityRelationship`, `RelationshipType`): Removed default field initialization `tenantId = "default-tenant"`.
- **`SchemaValidationServiceTest.java`**: Updated cache key tests to explicitly use `"tenant-acme"`.

### Frontend Security & Interventions (`@unipost/console`)
- **`ProtectedRoute.tsx`**: Added Tenant Assignment Guard. Authenticated non-SYSTEM users with empty `tenantId` are rendered a Liquid Glass **Unassigned Tenant Intervention Screen** with actions to sign out or contact a platform custodian.
- **`auth-sandbox-handler.ts`**: Calibrated sandbox bypass personas away from `"default-tenant"` to `"tenant-acme"` and `"tenant-us-east-1"`.

### Tenant Immutable Default Workspace & Personal Workspace Defaults
- **`profile-store.ts`**:
  - Added `isDefault?: boolean` to `Profile` type.
  - Added `getUserDefaultWorkspace(tenantId)` and `setUserDefaultWorkspace(tenantId, workspaceId)`.
  - In `resolveTenantProfile`: Resolved in order: (1) personal user default workspace (`unipost_user_default_ws_${tenantId}`), (2) tenant immutable default workspace (`isDefault === true`), (3) first available workspace.
  - Added `setUserDefault(tenantId, workspaceId)` action.
- **`sidebar-data.ts`**: Purged `ws-main` (`default-tenant`). Set `isDefault: true` on `ws-acme-prod` under `tenant-acme` and `ws-us-east-prod` under `tenant-us-east-1`.
- **`use-metadata-ui-store.ts`**: Replaced default tenant fallback with `tenant-acme` / `Acme International Corp` and auto-resolved user default workspace.
- **`profile-switcher.tsx`**: Replaced `'default-tenant'` fallback with active tenant ID. Added star action to set user default workspace with immediate feedback and visual `My Default` / `Default` badges.
- **`workspaces-panel.tsx`**: Added `DEFAULT WORKSPACE` badge, user default star toggle button, and disabled deletion for default workspaces and sole remaining workspaces.
- **`tenant-workspaces-drawer.tsx`**: Prevented deleting default workspaces and disabled the delete button with informative tooltips.
- **`onboarding-funnel-modal.tsx`**: Provisioned workspace during onboarding with `isDefault: true` and registered it into `useProfileStore`.

### UI/UX Fleet Sovereign Drawer Standardization
- **`tenant-users-drawer.tsx` [NEW]**: Created dedicated right-side slide-over `Sheet` (`sm:max-w-xl`) with user search, role filtering, Liquid Glass user cards, RBAC badges, emergency lock/unlock dialog, and session revocation.
- **`fleet-tenants-table.tsx`**: Replaced centered dialog popup with `<TenantUsersDrawer />`, achieving symmetrical slide-over ergonomics between "Manage Workspaces" and "Manage Users".

### Settings & Mock Scrubbing
- **`billing-sandbox-handler.ts`**, **`billing-panel.tsx`**, **`data-privacy-panel.tsx`**, **`create-workspace-modal.tsx`**, **`mock-metadata.ts`**: Purged all occurrences of `'default-tenant'` and `'Default Organization'`, replacing them with active context or commercial seeds.

## 3. Verification Results
- **TypeScript**: `pnpm --filter @unipost/console exec tsc --noEmit` passed with 0 errors.
- **Vitest**: `pnpm --filter @unipost/console exec vitest run` passed all 24 test suites (119/119 tests passing).
- **Zero Occurrences**: Verified `git grep -n "default-tenant" apps/console/src` returned 0 matches.
