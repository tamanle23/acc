# Walkthrough 70: Assume-Tenant Session Lifecycle & Viewport Banner Resolution

## Problem
When a Sovereign Custodian clicked "Assume Tenant" in `fleet-tenants-table.tsx`:
1. The mutation returned an unparseable mock string `sb_assume_...` instead of a valid signed mock JWT, corrupting auth state if decoded.
2. `fleet-tenants-table.tsx` executed a raw `window.location.reload()`, keeping the user on `/system/tenants` looking at the exact same fleet table.
3. Neither `useSandboxStore` nor `useMetadataUiStore` updated their active tenant states to the assumed tenant.
4. `AssumeTenantBar.tsx` evaluated `const effectiveTenant = currentTenantId || activeTenantId;` and checked `effectiveTenant !== 'SYSTEM'`. Since `activeTenantId` was still `'SYSTEM'`, `effectiveTenant` remained `'SYSTEM'`, so `isAssumed` evaluated to `false`. The warning banner silently returned `null` and remained hidden.
5. The result: The page simply reloaded and appeared as if nothing had happened.

## Changes Completed

### 1. Cryptographic Mock JWT Ephemeral Token Generation
- **Sandbox Handler (`system-sandbox-handler.ts`)**:
  - Replaced the hardcoded string `sb_assume_${tenantId}_...` with `createMockJwt(...)`.
  - Stamped `tenantId: tenantId`, `tid: tenantId`, `actor_tid: 'SYSTEM'`, `is_ephemeral_delegation: true`, and all necessary authorities into the payload.
  - Ensured `decodeJwt` correctly parses the token, extracts tenant IDs, and preserves authentication.

### 2. Reliable Assume-Tenant Viewport Banner
- **Component (`assume-tenant-bar.tsx`)**:
  - Simplified condition: `isAssumed = Boolean(assumedTenant && assumedTenant !== 'SYSTEM')` reading `localStorage.getItem('unipost_assumed_tenant')`.
  - When active, prominently renders the amber frosted bar across the top of all views.
  - On "Exit Sub-Session":
    - Clears `unipost_assumed_tenant` and `unipost_assumed_token`.
    - Restores `activeTenantId: 'SYSTEM'` in both `useSandboxStore` and `useMetadataUiStore`.
    - Restores the Sovereign Custodian token in `useSpringAuthStore`.
    - Redirects cleanly to `/system/tenants`.

### 3. Store Synchronization & Workspace Navigation
- **Component (`fleet-tenants-table.tsx`)**:
  - Upon successful assumption, synchronizes:
    - `useSpringAuthStore.getState().setTokens(res.ephemeralToken, ...)`
    - `useSandboxStore.getState().setActiveTenant(res.effectiveTenantId)`
    - `useMetadataUiStore.getState().setActiveTenant(res.effectiveTenantId, tenant.name)`
  - Smoothly navigates the user to `/metadata` where the assumed tenant's catalog, schemas, and records are immediately visible and actionable.

### 4. Sidebar Dynamic State Adaptation
- **Component (`sidebar-data.ts`)**:
  - Detected `isAssumed` state.
  - When assumed, exposes `Metadata` for the delegated tenant while switching the sovereign group header to `Sovereign Custody (Delegated)`.
  - Synced locale translations in `en/console.json` and `vi/console.json`.

## Verification Results
- `sovereign-cockpit-ui.test.tsx`: 5/5 passed (including `AssumeTenantBar` active and inactive states).
- `system-sandbox.test.ts`: 7/7 passed (validating decoded ephemeral JWT claims: `tenantId`, `actor_tid: 'SYSTEM'`).
- Total Console Vitest Suite: 93/93 passed across 16 test files.
- TypeScript Compile: Clean (`tsc --noEmit` exited with 0 errors).
