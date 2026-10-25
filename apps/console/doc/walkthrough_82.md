# Walkthrough 82: Dynamic Quota & SYSTEM Root Entitlement for Add Entity & Templates

We eliminated the hardcoded 50-model limit in the entity sidebar and granted unconditional schema management entitlement to the SYSTEM sovereign custodian.

---

## 1. Problem & Root Cause

1. **Hardcoded Model Counter**: In `entity-type-sidebar.tsx`, both the **"New" (Add Model)** and **"Templates" (Blueprint Catalog)** buttons had `disabled={totalElements >= 50}` and the badge displayed `{totalElements}/50`. When the workspace had 50+ models, the buttons remained permanently disabled regardless of subscription tier or unlimited status (`maxSchemas: -1`).
2. **SYSTEM Root RBAC Bypass**: `canManageSchema()` in `use-metadata-ui-store.ts` required `currentUserRole === 'TENANT_ADMIN' && workspaceMode === 'architect'`, blocking the SYSTEM sovereign root custodian if assumed under different tenant contexts or modes.
3. **Attribute Cap**: `schema-builder.tsx` had a similar fixed `attributes.length >= 100` lockout on the "Add Field" button.

---

## 2. Changes Made

### A. Dynamic Schema Quota & Infinity Badge (`entity-type-sidebar.tsx`)
- Connected `useTenantBilling()`:
  - If `maxSchemas === -1` (unlimited / SYSTEM root), `isUnlimitedSchemas = true` and `isQuotaExceeded = false`.
  - The header badge now displays `{totalElements} / ∞` (using `InfinityIcon` with emerald tint) when unlimited, instead of a rigid `/50`.
  - The "Templates" and "New" buttons are bound to `disabled={isQuotaExceeded}`, remaining fully enabled for SYSTEM root and unlimited tiers.

### B. SYSTEM Sovereign Custodian Schema Authority (`use-metadata-ui-store.ts`)
- In `canManageSchema()` and `canMutateRecords()`:
  - Added an unconditional bypass for `activeTenantId === 'SYSTEM'` (and system custodian roles), granting total authority to design schemas, import templates, and mutate records across all workspaces.

### C. Unlimited Field Attributes for SYSTEM Root (`schema-builder.tsx`)
- Connected `useTenantBilling()` in `SchemaBuilder`:
  - When `isSovereignRoot` (`activeTenantId === 'SYSTEM'` or `maxSchemas === -1`), displays `{attributes.length}/∞ Fields` and unlocks the **Add Field** button beyond the standard 100-field limit.

---

## 3. Verification

- Ran `pnpm --filter @acc/console test src/features/metadata`:
  - **9 test files passed**, **55 tests passed** (100% pass rate).
