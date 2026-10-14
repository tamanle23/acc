# History Log 078: Dynamic Quota & SYSTEM Root Entitlement for Add Entity & Templates

## Problem Statement
The "New" (Add Entity Model) and "Templates" (Domain Blueprint Catalog) buttons were disabled for SYSTEM root custodian due to a hardcoded `50` model limit check in `entity-type-sidebar.tsx` (`totalElements >= 50`) and a strict RBAC check in `canManageSchema()` that did not recognize the sovereign root context.

## Plan
1. **Dynamic Quota & Infinity Badge**:
   - Query `useTenantBilling()` in `entity-type-sidebar.tsx`.
   - If `maxSchemas === -1`, set `isQuotaExceeded = false` and render `totalElements / ∞`.
   - Unlock "New" and "Templates" buttons when not exceeded.
2. **SYSTEM Root Schema Authority**:
   - In `use-metadata-ui-store.ts`, allow `activeTenantId === 'SYSTEM'` to manage schemas and mutate records unconditionally.
3. **Harmonize Schema Builder**:
   - In `schema-builder.tsx`, respect unlimited quotas for attributes, showing `attributes.length / ∞ Fields`.
4. **Verification**:
   - Run Vitest suite across metadata features.

## Changes Made
- [`entity-type-sidebar.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx): Switched hardcoded limit 50 to dynamic `maxSchemas` from `useTenantBilling()`, enabled infinity badge display, and unlocked "New" and "Templates" buttons.
- [`use-metadata-ui-store.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/store/use-metadata-ui-store.ts): Granted SYSTEM root unconditional permission in `canManageSchema()` and `canMutateRecords()`.
- [`schema-builder.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx): Added dynamic attribute quota check supporting unlimited fields for SYSTEM root.
- [`walkthrough_82.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/doc/walkthrough_82.md): Created walkthrough documentation.

## Verification
- `pnpm --filter @unipost/console test src/features/metadata`: 9 test files passed, 55/55 tests passed.
