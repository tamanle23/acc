# Walkthrough 71: ProfileSwitcher & Workspace Synchronization with Assumed Tenant Context

## Overview
When a Sovereign Custodian assumes a fleet tenant (e.g. `tenant-acme` or dynamic fleet tenant `tenant-us-east-1`), the workspace switcher (`ProfileSwitcher` in the sidebar header) previously remained static on `"Acc Main"` under `default-tenant`. This fix introduces centralized state synchronization across `useProfileStore`, `useMetadataUiStore`, `useSandboxStore`, and `ProfileSwitcher`, ensuring immediate, persistent, and visually distinct delegated context representation.

---

## Changes

### 1. Unified Profile Store (`apps/console/src/stores/profile-store.ts`)
- Added `SOVEREIGN_PROFILE` (`id: 'ws-sovereign-root'`, `plan: 'Fleet Custody'`, `tenantId: 'SYSTEM'`).
- Implemented `resolveTenantProfile(tenantId, tenantName, currentProfiles)`:
  - Resolves `SYSTEM` to `SOVEREIGN_PROFILE`.
  - Matches existing configured tenant workspaces (e.g. `ws-acme-prod` for `tenant-acme`).
  - Synthesizes a delegated workspace (`ws-<tenantId>`) for dynamically provisioned fleet tenants lacking predefined mock workspaces.
- Added `syncAssumedTenant(tenantId, tenantName)` action:
  - Dynamically activates target tenant workspace and updates cookie storage.
  - Cleanly reverts back to the default workspace (`ws-main`) when exiting (`null` or `'SYSTEM'`).
- Initialized store with checks for `localStorage.getItem('acc_assumed_tenant')` to preserve context across direct page navigations and reloads.

### 2. Profile Provider Context (`apps/console/src/context/profile-provider.tsx`)
- Exported and wired `syncAssumedTenant` into `ProfileContextType` and `useProfile()` hook.

### 3. Metadata UI Store Pre-Initialization (`apps/console/src/features/metadata/store/use-metadata-ui-store.ts`)
- Pre-initialized `activeTenantId`, `activeTenantName`, `activeWorkspaceId`, and `activeWorkspaceName` directly from `localStorage.getItem('acc_assumed_tenant')`.
- Prevents flash of `'default-tenant'` on hard page refresh.

### 4. Shared Exit Utility (`apps/console/src/features/system/utils/assume-tenant-session.ts`)
- Encapsulated `exitAssumeTenantSubSession(redirectPath = '/system/tenants')`:
  - Removes `acc_assumed_tenant`, `acc_assumed_token`, and `acc_assumed_tenant_name`.
  - Restores sandbox and metadata stores to `'SYSTEM'`.
  - Reverts `useProfileStore` to default.
  - Regulates mock root custodian JWT in development.
  - Redirects cleanly to sovereign custody cockpit.

### 5. ProfileSwitcher Visual & Reactive Upgrade (`apps/console/src/components/layout/profile-switcher.tsx`)
- Reads reactive `contextProfiles` from `useProfile()`.
- Detects `isAssumed` from `localStorage.getItem('acc_assumed_tenant')`.
- Displays amber delegated styling on trigger button:
  - Amber border and background accent (`bg-amber-500/10 border-amber-500/30`).
  - `ShieldAlert` icon.
  - `ASSUMED` badge next to workspace name.
  - Subtitle formatted as `Delegated: <Organization Name>`.
- Dropdown menu enhancements:
  - Dedicated Delegated Sub-Session header block showing actor (`SYSTEM`) and organization name.
  - One-click `"Exit Sub-Session & Return to Root"` button.
  - Prioritizes assumed tenant workspaces at the top of the list.
  - Selecting an alternative tenant workspace automatically cleans up assumed sub-session.

### 6. Fleet Tenants Table Action (`apps/console/src/features/system/tenants/fleet-tenants-table.tsx`)
- Updated `handleAssumeTenant` to persist `acc_assumed_tenant_name`.
- Calls `useProfileStore.getState().syncAssumedTenant(res.effectiveTenantId, tenant.name)` before redirecting to `/metadata`.

### 7. AssumeTenantBar Refactor (`apps/console/src/components/layout/assume-tenant-bar.tsx`)
- Replaced duplicated cleanup logic with shared `exitAssumeTenantSubSession()`.

---

## Verification Results

### Unit & Integration Tests
- `apps/console/src/stores/__tests__/profile-store.test.ts`:
  - Resolves `SYSTEM` to `SOVEREIGN_PROFILE`.
  - Resolves existing configured `tenant-acme`.
  - Synthesizes delegated workspace for dynamic `tenant-custom-99`.
  - Switches and restores default workspace on exit.
- `apps/console/src/components/layout/__tests__/profile-switcher.test.tsx`:
  - Renders standard workspace switcher when not assumed.
  - Renders delegated indicator, `ASSUMED` badge, and subtitle when assumed tenant session is active.
- Vitest run: **24 test files passed, 114 tests passed**.
- TypeScript type check: **0 errors (`tsc --noEmit`)**.
