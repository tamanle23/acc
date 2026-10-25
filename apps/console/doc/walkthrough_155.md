# Walkthrough 155: RbacMatrixGrid DataTable Component Reuse

## 1. Problem Statement
The user requested that [`rbac-matrix-grid.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/system/roles/rbac-matrix-grid.tsx) also reuse the standardized `@/components/data-table` component rather than rendering raw `<Table>`, `<TableHeader>`, and `<TableBody>` primitives directly.

## 2. Refactoring & Implementation
- **Dynamic TanStack Column Definition**:
  - Dynamically synthesizes TanStack `ColumnDef<CanonicalPermission>[]`:
    - First column: `code` accessor rendering the Permission Atom, badge category, and description with WCAG 2.2 AA compliant contrast.
    - Subsequent columns: One per visible role, rendering role header telemetry (scope badge, user count, lock indicator) and interactive cell checkboxes linked to `handleToggle(roleId, atom.code)` with DAG inheritance detection.
- **DataTable Integration**:
  - Replaced the direct `<Table>` markup with `<DataTable showRowIndex table={table} />`.
  - Preserved the dual-scope segmented switcher ("All Scopes", "Tenant Matrix", "Sovereign Matrix"), plane filter pills, search input, and floating commit bar.

## 3. Verification & Compliance
- **TypeScript**: `pnpm --filter @acc/console exec tsc --noEmit` &rarr; 0 errors.
- **Unit Testing**: `rbac-matrix-grid.test.tsx` + `sovereign-cockpit-ui.test.tsx` &rarr; 9/9 passed cleanly.
- **Playwright E2E**: `12-sovereign-rbac-matrix.spec.ts` &rarr; 1 passed (0 WCAG AA accessibility violations).
- **Import Audit**: Verified that raw `@/components/ui/table` is now ONLY imported inside `@/components/data-table/data-table.tsx`.
