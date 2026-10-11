# 025: Orphaned Tenant State Handling and Fleet Workspace/User Management

## Problem
1. **Multi-Tenant Hierarchy Invariant**: A user belongs to a Tenant; a Tenant has 0..N Workspaces. If all workspaces belonging to a tenant are deleted or wiped out, the tenant enters an "orphaned" state. Previously, the console relied on fallback workspaces (such as `Default Organization`), violating tenancy boundaries.
2. **Missing Orphaned UI Handling**: When a tenant has 0 workspaces, sidebar items tied to a workspace (`Dashboard`, `Tasks`, `Apps`, `Chats`, `Customer Accounts`) remained visible and pointed to non-existent contexts. The workspace switcher trigger lacked an indicator showing that the tenant has no active workspaces.
3. **Missing Sovereign Fleet Controls**: In **Fleet Tenants Ledger** (`/system/tenants`), sovereign custodians had no direct controls to inspect/provision/delete workspaces for specific tenants, nor to inspect and manage users assigned to each tenant.

## Plan
1. **Dynamic Navigation Filtering**: In `sidebar-data.ts`, determine `hasActiveWorkspace` strictly based on whether `activeWorkspaceId` is set and matches a workspace belonging to the current tenant. Hide the Workspace navigation group when `hasActiveWorkspace` is false.
2. **ProfileSwitcher Orphaned State**:
   - Detect `isOrphanedTenant` when `tenantWorkspaces.length === 0`.
   - Render a prominent `NO WORKSPACE` badge in the switcher trigger.
   - Display an amber prompt in the dropdown menu with a "+ Provision First Workspace" action.
3. **Fleet Workspace & User Management**:
   - Implement `TenantWorkspacesDrawer` allowing sovereign custodians to inspect, switch, provision, or delete workspaces belonging to any tenant.
   - Wire `initialTenantId` into `UserMembershipDrawer` and expose "Manage Workspaces" and "Manage Users" actions in `fleet-tenants-table.tsx`.
4. **Workspace Deletion in Settings**:
   - Add delete workspace capability in `WorkspacesPanel` with `ConfirmDialog` to allow admins to delete workspaces and transition into orphaned tenant state.
5. **Verification & Tests**:
   - Add unit test in `profile-switcher.test.tsx` verifying the orphaned tenant display.
   - Run type checks and the complete Vitest test suite.

## Changes
- `apps/console/src/components/layout/data/sidebar-data.ts`: Strict tenant workspace isolation; hide workspace navigation items when `hasActiveWorkspace === false`.
- `apps/console/src/components/layout/profile-switcher.tsx`: Display `NO WORKSPACE` badge, tenant name, and provision CTA when in orphaned state.
- `apps/console/src/components/layout/__tests__/profile-switcher.test.tsx`: Added unit test asserting orphaned tenant behavior.
- `apps/console/src/features/system/tenants/tenant-workspaces-drawer.tsx`: New component for sovereign workspace management.
- `apps/console/src/features/system/tenants/fleet-tenants-table.tsx`: Integrated "Manage Workspaces" and "Manage Users" drawer triggers.
- `apps/console/src/features/system/roles/user-membership-drawer.tsx`: Added `initialTenantId` prop.
- `apps/console/src/features/settings/workspaces/workspaces-panel.tsx`: Added workspace deletion with confirmation.

## Verification
- `pnpm --filter @unipost/console exec tsc --noEmit` -> Passed with 0 errors.
- `pnpm --filter @unipost/console exec vitest run` -> 24 test files passed, 116 tests passed.

## Walkthrough
See `apps/console/doc/walkthrough_73.md`.
