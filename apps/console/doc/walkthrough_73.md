# Walkthrough 73: Orphaned Tenant State Handling & Fleet Workspace/User Management

## 1. Overview
This update enforces strict multi-tenant domain rules:
1. **User belongs to a Tenant; a Tenant has 0..N Workspaces**: A tenant is the root boundary of isolation. When all workspaces of a tenant are deleted or unprovisioned, the tenant enters an **Orphaned Tenant** state (`isOrphanedTenant = true`).
2. **Orphaned Tenant UI Behavior**:
   - The user/custodian remains logged in under their tenant.
   - The ProfileSwitcher trigger displays `NO WORKSPACE` badge and the tenant's name.
   - Workspace-level navigation in the sidebar (`Dashboard`, `Tasks`, `Apps`, `Chats`, `Customer Accounts`) is **strictly hidden** when there is no active workspace (`hasActiveWorkspace = false`).
   - The ProfileSwitcher dropdown renders an amber banner warning that no workspaces exist in the organization, with a direct **"+ Provision First Workspace"** action.
3. **Fleet Tenants Ledger Enhancements (`/system/tenants`)**:
   - Sovereign custodians can manage workspaces directly via **TenantWorkspacesDrawer** (inspect, activate, provision, delete).
   - Sovereign custodians can manage tenant user memberships via **UserMembershipDrawer** pre-filtered by `initialTenantId`.
4. **Tenant Workspaces Panel (`/settings/workspaces`)**:
   - Tenant administrators can delete workspaces with confirmation dialog, safely handling transitions into the orphaned tenant state.

## 2. Key Changes

### A. Navigation & Sidebar
- **`apps/console/src/components/layout/data/sidebar-data.ts`**:
  - Dynamically calculates `tenantWorkspaces` for the active/assumed tenant without falling back to `sidebarTeams`.
  - Computes `hasActiveWorkspace = Boolean(activeWorkspaceId && tenantWorkspaces.length > 0)`.
  - Hides the `Workspace` nav group (`Dashboard`, `Tasks`, `Apps`, `Chats`, `Customer Accounts`) when `hasActiveWorkspace` is false.

### B. Profile Switcher
- **`apps/console/src/components/layout/profile-switcher.tsx`**:
  - Computes `isOrphanedTenant = tenantWorkspaces.length === 0`.
  - Displays `NO WORKSPACE` amber badge on the trigger button.
  - Adds an orphaned tenant warning card in the dropdown with a one-click button to launch `CreateWorkspaceModal`.
- **`apps/console/src/components/layout/__tests__/profile-switcher.test.tsx`**:
  - Added unit test asserting `NO WORKSPACE` badge and tenant name display when a tenant has zero workspaces.

### C. Fleet Tenants Ledger (`/system/tenants`)
- **`apps/console/src/features/system/tenants/tenant-workspaces-drawer.tsx`**:
  - New sovereign drawer component to inspect workspaces belonging to a specific tenant.
  - Allows creating new workspaces (`CreateWorkspaceModal`) and permanently deleting workspaces (`ConfirmDialog`).
  - Clears active workspace to orphaned state if the deleted workspace was the active one.
- **`apps/console/src/features/system/tenants/fleet-tenants-table.tsx`**:
  - Added "Manage Workspaces" action in the row dropdown menu.
  - Added "Manage Users" action in the row dropdown menu, launching `UserMembershipDrawer` with `initialTenantId`.
- **`apps/console/src/features/system/roles/user-membership-drawer.tsx`**:
  - Accepts `initialTenantId` prop to pre-filter users by tenant ID.

### D. Settings Workspaces Panel (`/settings/workspaces`)
- **`apps/console/src/features/settings/workspaces/workspaces-panel.tsx`**:
  - Added delete workspace button and `ConfirmDialog` allowing tenant admins to delete workspaces and test orphaned states.

## 3. Verification Results
- **TypeScript**: `pnpm --filter @acc/console exec tsc --noEmit` passed with 0 errors.
- **Vitest Suite**: `pnpm --filter @acc/console exec vitest run` passed (24 test files, 116 tests passed).
