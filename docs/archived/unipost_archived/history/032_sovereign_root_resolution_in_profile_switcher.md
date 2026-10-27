# Task History: [032] Fix Sovereign Root Resolution for SYSTEM User in ProfileSwitcher

## Problem Statement
When logging in as a `SYSTEM` user (with `ROLE_SYSTEM_CUSTODIAN` or `activePersonaId === 'system'`) without actively assuming any commercial tenant, the workspace switcher previously fell back to `'tenant-acme'` and activated `'Acme Prod'`. In the multi-tenant architecture, `SYSTEM` is the sovereign root custodian with cluster custody over the fleet and should not default to a commercial tenant workspace until explicitly assuming one.

## Proposed Plan
1. Update `ProfileSwitcher` ([`apps/console/src/components/layout/profile-switcher.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/profile-switcher.tsx)):
   - Calculate `effectiveTenantId`: if `isAssumed`, use `assumedTenant`; else if `isSovereign`, resolve to `'SYSTEM'`.
   - Prevent `isOrphanedTenant` from triggering for `SYSTEM`.
   - When `isSovereign && !isAssumed`, explicitly resolve `activeProfile` to Sovereign Platform (`👑 Sovereign Platform`, `ws-sovereign-root`, `SYSTEM` tenant).
   - Display amber `Crown` icon, `ROOT` badge, and subtitle `SYSTEM Tenant (Fleet Root)`.
2. Update unit tests in [`apps/console/src/components/layout/__tests__/profile-switcher.test.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/__tests__/profile-switcher.test.tsx) to cover sovereign root platform context rendering with `ROOT` badge.
3. Validate with Vitest and verify production Vite build.

## Implementation Details
- In `ProfileSwitcher`:
  - Resolved `effectiveTenantId`: `isAssumed ? assumedTenant : isSovereign ? 'SYSTEM' : (useMetadataUiStore.getState().activeTenantId || 'tenant-acme')`.
  - When `isSovereign && !isAssumed`, guaranteed `activeProfile` resolves to Sovereign Platform with `Crown` icon.
  - Added visual `ROOT` badge in switcher trigger button.
- In `profile-switcher.test.tsx`:
  - Added test case: `renders Sovereign Root Platform context with ROOT badge when logged in as SYSTEM Custodian without active assume`.

## Verification
- Executed `vitest run src/components/layout/__tests__/profile-switcher.test.tsx`: 7/7 tests passed.
- Executed full Vitest suite: 27/27 test suites passed, 136/136 tests green.
- Executed production Vite build: build completed with 0 errors.

## History Log Reference
- History log: `docs/history/032_sovereign_root_resolution_in_profile_switcher.md`
