# Comprehensive Implementation Plan: Default Tenant Purge, User Default Workspace Selection & Fleet Sovereign Drawer Standardization

**Document ID**: `docs/multi-tenants/12_tenant_default_workspace_and_fleet_drawers_plan.md`  
**Paired Console Plan**: `apps/console/doc/implementation_plan_74.md`  
**Author**: Lead Systems Architect & UI/UX Engineer  
**Status**: APPROVED FOR EXECUTION  
**Timestamp**: 2026-10-11T08:52:00+07:00  

---

## 1. Executive Summary & Core Invariants

This plan establishes the definitive architectural model for multi-tenant identity, workspace lifecycle immutability, personal user defaults, and sovereign fleet UI/UX drawer symmetry across `@acc/console` and `@acc/backend`.

### Core Invariants:
1. **User-to-Tenant Topology (1..N Membership, 1 Active Session)**:
   - A user account can be assigned to multiple tenants (e.g. Primary Customer: `tenant-acme`, Partner Auditor: `tenant-us-east-1`).
   - Every active authenticated session (JWT) carries exactly **one active `tenantId` (`tid`)**.
   - **Zero-Tenant Prohibition**: If a user is not associated with any tenant, they are strictly prohibited from logging in or accessing workspaces. They are directed to a dedicated **Unassigned Tenant Intervention Screen** requiring a `SYSTEM` Platform Custodian to assign them to an organization.
2. **Tenant Onboarding & Immutable Default Workspace**:
   - Every tenant must have at least 1 workspace created during onboarding (`isDefault: true`, `isPrimary: true`).
   - The tenant's default workspace **cannot be deleted, archived, or transferred** out of the tenant.
   - Consequently, regular users in a healthy tenant **never encounter a "NO WORKSPACE" state**. The orphaned tenant state is strictly reserved for catastrophic/recovery scenarios.
3. **User-Specific Default Workspace Selection**:
   - A user can customize their personal default workspace from the list of workspaces available within their active tenant.
   - This preference is persisted per user and per tenant (`user_default_workspace_{tenantId}`).
   - On sign-in or switching to that tenant, the application automatically boots into their chosen default workspace.
4. **Purge of Legacy `default-tenant` / `Default Organization`**:
   - All references, fallback branches, hardcoded strings, and seed entries for `"default-tenant"`, `"Default Organization"`, and `"ws-main"` are completely deleted.
   - Valid commercial tenant seeds (`tenant-acme`, `tenant-us-east-1`, etc.) serve as baseline seeds for development and testing.
5. **UI/UX Consistency in Fleet Tenants Ledger (`/system/tenants`)**:
   - Eliminate the visual mismatch where "Manage Workspaces" is a right-side drawer while "Manage Users" is a centered modal dialog with an oversized table.
   - Replace the dialog with **`TenantUsersDrawer`**, a high-density, Liquid Glass slide-over drawer matching `TenantWorkspacesDrawer` with user cards, role badges, session revocation, and account lock controls.

---

## 2. Architecture & Detailed Design

```
+---------------------------------------------------------------------------------------------------------+
|                                    PLATFORM TENANCY ARCHITECTURE                                        |
+---------------------------------------------------------------------------------------------------------+
                                                                                                          
        +-------------------------+                                 +-------------------------+            
        |       Global User       |                                 |         Tenant          |            
        |     (user@domain)       |                                 |      (tenant-acme)      |            
        +------------+------------+                                 +------------+------------+            
                     |                                                           |                         
                     | Has 1..N Memberships                                      | Has 1..N Workspaces     
                     v                                                           v                         
        +-------------------------+                                 +-------------------------+            
        |    Active JWT Token     |                                 |   Tenant Default WS     |            
        |  (tid: "tenant-acme")   |================================>|   (isDefault = true)    |            
        +------------+------------+                                 |  * CANNOT BE DELETED *  |            
                     |                                              +------------+------------+            
                     | Selects personal preference                               |                         
                     v                                                           v                         
        +-------------------------+                                 +-------------------------+            
        |  User Default Workspace |                                 |  Secondary Workspaces   |            
        |   Preference (Cookie/   |-------------------------------->|  (Acme Staging, Labs)   |            
        |       LocalStorage)     |                                 |   * Can be deleted *    |            
        +-------------------------+                                 +-------------------------+            
```

---

## 3. Phased Execution Tasks

### Phase 1: Backend Security & Purge of `default-tenant` Fallbacks
* **File**: `apps/backend/acc-fw/src/main/java/com/acc/fw/core/jwt/JwtAuthenticationTokenFilter.java`
  - Remove `.orElse("default-tenant")`.
  - If `jwtTokenHelper.getTenantId(c)` is empty, do **not** authenticate the user; return `401 Unauthorized` with structured body: `"UNASSIGNED_TENANT: User account does not belong to any tenant."`
* **File**: `apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java`
  - Remove fallback `: "default-tenant"` in `createEntityRecord`. Require non-null `activeTenantId` from `TenantContextHolder`.
* **File**: `apps/backend/acc-fw/src/main/java/com/acc/service/SchemaValidationService.java`
  - Remove `"default-tenant"` in cache key generation. Throw `TenancySecurityException` if tenant is absent.
* **File**: `apps/backend/acc-fw/src/main/java/com/acc/fw/tenancy/ratelimit/TenantRateLimitFilter.java` & `TenantRateLimitService.java`
  - Remove fallback to `"default-tenant"`.
* **File**: `apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/*.java`
  - Remove default initialization `private String tenantId = "default-tenant"`.
* **Tests**: Update `SchemaValidationServiceTest.java` to test explicitly with `"tenant-acme"`.

### Phase 2: Frontend Auth Guard & Unassigned Tenant Intervention Screen
* **File**: `apps/console/src/features/spring-auth/components/ProtectedRoute.tsx`
  - Inspect `user.tenantId` / `user.tid`.
  - If `isAuthenticated && (!user.tenantId || user.tenantId.trim() === '')`, render the Liquid Glass **Unassigned Tenant Intervention Screen**:
    - Specular Shield Alert icon in amber/rose.
    - Title: `"No Organization Assigned"`.
    - Message: `"Your account is not assigned to any active tenant organization. Access to workspace services is prohibited until a SYSTEM Custodian assigns your membership."`
    - Actions: `"Sign Out"` and `"Contact Platform Custodian"`.
* **File**: `apps/console/src/core/sandbox/handlers/auth-sandbox-handler.ts`
  - Update sandbox bypass users (`admin_bypass`, `user_bypass`, `creator_bypass`) to issue valid tokens for `tenant-acme`, `tenant-us-east-1`, and `tenant-eu-central-1` instead of `"default-tenant"`.

### Phase 3: Tenant Immutable Default Workspace Invariant
* **File**: `apps/console/src/stores/profile-store.ts`
  - Add `isDefault?: boolean` to `Profile` type.
* **File**: `apps/console/src/components/layout/data/sidebar-data.ts`
  - Remove `{ id: 'ws-main', tenantId: 'default-tenant' }`.
  - Mark `ws-acme-prod` as `isDefault: true` under `tenant-acme`.
* **File**: `apps/console/src/features/system/tenants/tenant-workspaces-drawer.tsx`
  - If `ws.isDefault === true` or `tenantWorkspaces.length === 1`:
    - Disable the Delete button (`disabled`).
    - Add tooltip/badge: `"Default Workspace (Protected)"`.
    - Prevent triggering the delete dialog for the default workspace.
* **File**: `apps/console/src/features/settings/workspaces/workspaces-panel.tsx`
  - Render an unmistakable badge `DEFAULT WORKSPACE` / `TỔ CHỨC GỐC` on default workspaces.
  - Disable deletion for the default workspace or when only 1 workspace remains.

### Phase 4: User Personal Default Workspace Selection
* **Storage Contract**:
  - Key: `acc_user_default_ws_${tenantId}` (or stored in `user.preferences.defaultWorkspace`).
* **UI Controls**:
  - In `WorkspacesPanel.tsx`:
    - Add a button / star action on each workspace card: `"Đặt làm Workspace Mặc định của tôi"` (Set as my default workspace).
    - Card shows `MY DEFAULT` badge when it matches the user's preference.
  - In `ProfileSwitcher.tsx`:
    - Dropdown menu allows starring / marking active workspace as default.
* **Auto-Resolution on Startup**:
  - In `useProfileStore` and `useMetadataUiStore`:
    - When switching or bootstrapping a tenant, resolve the workspace in order:
      1. User's saved personal default workspace for this tenant (`acc_user_default_ws_${tenantId}`).
      2. Tenant's immutable default workspace (`ws.isDefault === true`).
      3. First available workspace for this tenant.

### Phase 5: UI/UX Redesign – Standardize Sovereign Drawers
* **File**: `apps/console/src/features/system/tenants/tenant-users-drawer.tsx` [NEW]
  - Convert user management from the center modal dialog into a right-side slide-over `Sheet` (`sm:max-w-xl`).
  - Header: Tenant name, tenant ID, active user count.
  - Search bar + role filters.
  - Liquid Glass cards for each user showing:
    - User avatar & display name.
    - Username & email.
    - RBAC role badges (`ADMIN`, `USER`, `CREATOR`).
    - Account status badge (`ACTIVE` / `LOCKED`).
    - Inline actions:
      - **Emergency Lock/Unlock** with confirmation.
      - **Revoke Active Sessions & Tokens**.
      - **Inspect Telemetry**.
* **File**: `apps/console/src/features/system/tenants/fleet-tenants-table.tsx`
  - Remove `<Dialog open={usersDialogOpen}>`.
  - Render `<TenantUsersDrawer tenant={selectedTenant} open={usersDrawerOpen} onOpenChange={setUsersDrawerOpen} />`.
  - Now, **both "Manage Workspaces" and "Manage Users"** open clean, symmetrical right-side slide-overs.

### Phase 6: Scrub Remaining References in Settings & Mocks
* Scrub `billing-panel.tsx`, `data-privacy-panel.tsx`, `create-workspace-modal.tsx`, `use-metadata-ui-store.ts`, `mock-metadata.ts` of any `'default-tenant'` or `'Default Organization'` fallback strings.
* Calibrate initial metadata UI store to initialize from `tenant-acme` / `Acme International Corp` when not in an assumed session.

---

## 4. Verification & Testing Strategy

1. **Backend Tests**:
   - `SchemaValidationServiceTest`: Confirm caching and validation work cleanly with tenant `tenant-acme`.
   - Security filter verification: Unauthenticated or missing-tenant tokens are rejected with 401.
2. **Console Vitest Suite**:
   - Update `profile-switcher.test.tsx` to test `tenant-acme` default workspace, personal default workspace preference, and orphaned state fallback.
   - Update `profile-store.test.ts` to assert resolution of tenant default workspace and user preference.
   - Test `TenantUsersDrawer` rendering inside `sovereign-cockpit-ui.test.tsx`.
3. **TypeScript Compliance**:
   - Run `pnpm --filter @acc/console exec tsc --noEmit`.
4. **Git Archival**:
   - Create `apps/console/doc/walkthrough_74.md`.
   - Create `docs/history/026_purge_default_tenant_and_standardize_fleet_drawers.md`.
   - Update `docs/history/README.md`.
