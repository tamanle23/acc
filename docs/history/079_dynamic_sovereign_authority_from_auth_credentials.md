# History Log 079: Dynamic Sovereign Authority from User Authentication Credentials

## Problem Statement
The previous implementation checked `activeTenantId === 'SYSTEM'` as a hardcoded string, failing to grant unconditional authority when a user authenticated with sovereign credentials (`ROLE_SYSTEM_CUSTODIAN`) assumed a non-system tenant context.

## Plan
1. **Dynamic Auth Role Resolution in Store**:
   - Update `canManageSchema()` and `canMutateRecords()` in `use-metadata-ui-store.ts` to inspect `useSpringAuthStore.getState().user.roles` for `ROLE_SYSTEM_CUSTODIAN` and `useSandboxStore.getState().activePersonaId === 'system'`.
2. **Dynamic Quota Resolution in Sidebar**:
   - In `entity-type-sidebar.tsx`, compute `isSovereignCustodian` from authenticated JWT roles and sandbox persona to set `maxSchemas = -1` dynamically.
3. **Dynamic Field Limit in Schema Builder**:
   - In `schema-builder.tsx`, derive `isSovereignRoot` from authenticated roles and persona.
4. **Verification**:
   - Run Vitest suite across metadata domain.

## Changes Made
- [`use-metadata-ui-store.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/store/use-metadata-ui-store.ts): Dynamically derived sovereign authority from `useSpringAuthStore` (`ROLE_SYSTEM_CUSTODIAN`) and `useSandboxStore` (`activePersonaId === 'system'`).
- [`entity-type-sidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx): Set `maxSchemas = -1` when authenticated user has sovereign custodian role.
- [`schema-builder.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx): Derived `isSovereignRoot` from authenticated user JWT authorities.
- [`walkthrough_83.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/walkthrough_83.md): Created walkthrough documentation.

## Verification
- `pnpm --filter @acc/console test src/features/metadata`: 9 test files passed, 55/55 tests passed.
