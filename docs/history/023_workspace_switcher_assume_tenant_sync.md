# History Entry 023: Workspace Switcher Synchronization with Assumed Tenant Context

## Problem Statement
When a Sovereign Custodian clicked **"Assume Tenant"** in the Fleet Tenants cockpit, the amber `AssumeTenantBar` appeared at the top of the viewport, but the workspace switcher (`ProfileSwitcher` in the sidebar header) continued displaying `"Unipost Main"` under `'default-tenant'`. 

Root causes:
1. `useProfileStore` and `ProfileSwitcher` operated independently of `localStorage.getItem('unipost_assumed_tenant')` and `useMetadataUiStore.activeTenantId`.
2. `useProfileStore` only restored profiles from the `console_active_profile` cookie or defaulted to the first static workspace (`ws-main`).
3. For dynamic fleet tenants lacking predefined workspaces (e.g. `tenant-us-east-1` or newly provisioned tenants), no workspace profile existed in `sidebarTeams`.
4. Hard page reload (`window.location.href = '/metadata'`) reset in-memory UI store state to `'default-tenant'`.

---

## Architectural & Technical Plan
1. **Central Profile Store Enhancements (`apps/console/src/stores/profile-store.ts`)**:
   - Introduce `resolveTenantProfile(tenantId, tenantName, currentProfiles)` to match existing workspaces or synthesize a delegated workspace (`ws-<tenantId>`) on the fly.
   - Introduce `syncAssumedTenant(tenantId, tenantName)` to activate the assumed workspace and persist cookies.
   - Pre-initialize `useProfileStore` by checking `localStorage.getItem('unipost_assumed_tenant')`.
2. **Metadata UI Store Pre-Initialization (`apps/console/src/features/metadata/store/use-metadata-ui-store.ts`)**:
   - Check `unipost_assumed_tenant` upon store creation to avoid momentary fallback to `'default-tenant'`.
3. **Centralized Sub-Session Cleanup (`apps/console/src/features/system/utils/assume-tenant-session.ts`)**:
   - Create `exitAssumeTenantSubSession()` to atomically clear storage, reset stores, regenerate DEV root token, and redirect.
4. **Visual & Behavioral ProfileSwitcher Upgrade (`apps/console/src/components/layout/profile-switcher.tsx`)**:
   - Display amber accent border, `ShieldAlert` icon, and `ASSUMED` badge in the trigger button.
   - Format subtitle as `Delegated: <Organization Name>`.
   - Add a top Delegated Sub-Session card in dropdown with one-click exit action.
   - Sort assumed tenant workspaces to the top.
   - Cleanly exit assumed sub-session if a different tenant's workspace is clicked.

---

## Verification
- Vitest: 24 test files, 114 tests passing.
- TypeScript: `pnpm --filter @unipost/console exec tsc --noEmit` clean.
- Unit tests added in `src/stores/__tests__/profile-store.test.ts` and `src/components/layout/__tests__/profile-switcher.test.tsx`.
