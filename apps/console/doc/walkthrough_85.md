# Walkthrough 85: Decouple UI Components from Sandbox Store via `usePermissions`

We eliminated leaky direct references to `useSandboxStore` across the metadata UI components and established a clean, single-source-of-truth authorization facade via `usePermissions()`.

---

## 1. Problem & Architecture Violation

- Components (`schema-builder.tsx`, `entity-type-sidebar.tsx`, `attribute-card.tsx`, `feature-gate.tsx`, and `use-metadata-ui-store.ts`) were directly querying `useSandboxStore()` to extract `activePersonaId`.
- **Violation of Sandbox Mandate** (`.agents/rules/02-unified-sandbox.md`): Development sandbox stores must never leak into production UI components or business logic.
- **Dual Source of Truth**: UI components had to check both `useSpringAuthStore` and `useSandboxStore` simultaneously to determine if the user had sovereign privileges.

---

## 2. Changes Made

### A. Centralized Permissions Facade (`use-permissions.ts`)
- Created [`usePermissions()`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/spring-auth/hooks/use-permissions.ts) inside `@/features/spring-auth`:
  ```ts
  export function usePermissions() {
    const user = useSpringAuthStore((state) => state.user);
    const currentTenantId = useSpringAuthStore((state) => state.currentTenantId);

    const roles = user?.roles || [];

    const isSovereignCustodian = Boolean(
      roles.includes('ROLE_SYSTEM_CUSTODIAN') ||
      currentTenantId === 'SYSTEM' ||
      user?.tenantId === 'SYSTEM' ||
      user?.tid === 'SYSTEM'
    );

    const isAdmin = isSovereignCustodian || roles.includes('ROLE_ADMIN') || roles.includes('TENANT_ADMIN');
    const isOperator = isAdmin || roles.includes('TENANT_OPERATOR') || roles.includes('ROLE_CREATOR');

    return {
      user,
      roles,
      currentTenantId,
      isSovereignCustodian,
      isAdmin,
      isOperator,
      canManageSchema: isAdmin,
      canMutateRecords: isOperator,
    };
  }
  ```

### B. Complete Decoupling of Metadata UI Components
- **`schema-builder.tsx`**: Removed `useSandboxStore` and `useSpringAuthStore`. Now consumes `{ isSovereignCustodian } = usePermissions()`.
- **`entity-type-sidebar.tsx`**: Removed `useSandboxStore` and `useSpringAuthStore`. Now consumes `{ isSovereignCustodian } = usePermissions()`.
- **`attribute-card.tsx`**: Removed `useSandboxStore` and `useSpringAuthStore`. Now consumes `{ isSovereignCustodian: isSovereign } = usePermissions()`.
- **`feature-gate.tsx`**: Removed `useSandboxStore` and `useSpringAuthStore`. Now consumes `{ isSovereignCustodian } = usePermissions()`.
- **`use-metadata-ui-store.ts`**: Removed `useSandboxStore` import and derived authority purely from `useSpringAuthStore.getState().user`.

---

## 3. Verification

- Ran `pnpm --filter @acc/console test src/features/metadata`:
  - **9 test files passed**, **55 tests passed** (100% pass rate).
- Verified with `git grep -n "useSandboxStore" apps/console/src/features/metadata`: 0 production UI component imports remaining.
