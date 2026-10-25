# Walkthrough 83: Dynamic Sovereign Authority from User Authentication Credentials

We upgraded the sovereign root custodian checks across the metadata domain to dynamically inspect the authenticated user's JWT credentials (`ROLE_SYSTEM_CUSTODIAN`) and active sandbox persona, removing hardcoded string checks.

---

## 1. Problem & Context

- Previously, the bypass check used a hardcoded string comparison (`activeTenantId === 'SYSTEM'`).
- If a sovereign custodian user was logged in via Spring Auth JWT (`roles: ['ROLE_SYSTEM_CUSTODIAN']`) or selected the System persona in the Unified Sandbox, but was currently viewing another tenant (or had assumed a tenant context), the UI would fail to recognize their sovereign authority and disable schema/model management buttons.

---

## 2. Changes Made

### A. Dynamic Authority in Store (`use-metadata-ui-store.ts`)
- In `canManageSchema()` and `canMutateRecords()`:
  - Dynamically read from `useSpringAuthStore.getState()` and `useSandboxStore.getState()`.
  - Derived sovereign status from authenticated user JWT authorities:
    ```ts
    const authState = useSpringAuthStore.getState();
    const sandboxState = useSandboxStore.getState();
    const userRoles = authState.user?.roles || [];
    const isSovereignCustodian = Boolean(
      userRoles.includes('ROLE_SYSTEM_CUSTODIAN') ||
      sandboxState.activePersonaId === 'system' ||
      activeTenantId === 'SYSTEM'
    );
    ```
  - Unconditionally grants schema and record permissions when the authenticated user possesses sovereign credentials, regardless of tenant assumption or UI workspace mode.

### B. Dynamic Quota Bypass in Entity Models Rail (`entity-type-sidebar.tsx`)
- Hooked `useSpringAuthStore()` and `useSandboxStore()`.
- Computed `isSovereignCustodian`:
  - When authenticated as a sovereign custodian, sets `maxSchemas = -1` (unlimited).
  - Keeps the **"New" (Add Model)** and **"Templates" (Blueprint Catalog)** buttons unlocked and displays the infinity badge (`{totalElements} / ∞`).

### C. Dynamic Field Limit Bypass in Schema Builder (`schema-builder.tsx`)
- Hooked `useSpringAuthStore()` and `useSandboxStore()`.
- Computed `isSovereignRoot` dynamically from authenticated roles (`ROLE_SYSTEM_CUSTODIAN`), sandbox persona, and billing tier.
- Unlocks the **"Add Field"** button and displays `{attributes.length} / ∞ Fields`.

---

## 3. Verification

- Ran `pnpm --filter @acc/console test src/features/metadata`:
  - **9 test files passed**, **55 tests passed** (100% pass rate).
