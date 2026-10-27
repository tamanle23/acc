# History Record 208: RbacMatrixGrid DataTable Standardization

## 1. Problem Statement
The user requested that the RBAC permission matrix grid ([`rbac-matrix-grid.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/system/roles/rbac-matrix-grid.tsx)) reuse the standardized `@/components/data-table` component, eliminating bespoke table primitives from the feature.

## 2. Refactoring & Implementation
- Replaced the direct `<Table>` markup in `RbacMatrixGrid` with `<DataTable showRowIndex table={table} />`.
- Synthesized dynamic TanStack `ColumnDef<CanonicalPermission>[]` mapping permission atoms and dynamic role checkbox columns.
- Preserved the dual-scope switcher, security plane filter pills, live search, and floating staged commit strip.

## 3. Verification & Compliance
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
- Vitest unit test suites (`rbac-matrix-grid.test.tsx`, `sovereign-cockpit-ui.test.tsx`): 9/9 passed.
- Playwright E2E spec `12-sovereign-rbac-matrix.spec.ts`: 1 passed (0 WCAG 2.2 AA violations).
- Import verification: Raw `@/components/ui/table` is now solely imported by `components/data-table/data-table.tsx`.
