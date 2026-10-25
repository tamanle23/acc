# Walkthrough 154: Data Table Standardization Across Console

## 1. Problem Statement
The codebase contained several bespoke, raw HTML `<table>` implementations and primitives (`RoleManagementTab`, `UserMembershipDrawer`, `BlueprintTableView`, `TemplatePreviewModal`, and `CompositeMasterDetailRow`) that bypassed the enterprise standard `@/components/data-table/data-table.tsx` component. The rule mandates that all data tables across `@acc/console` MUST use `@/components/data-table/data-table.tsx`, with the sole permitted exception of the dynamic virtualized metadata spreadsheet grid (`entity-data-grid.tsx`).

## 2. Refactoring & Standardizations
Refactored all data table views to TanStack Table + `DataTable`:
1. **`RoleManagementTab` ([`role-management-columns.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/system/roles/role-management-columns.tsx), [`role-management-tab.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/system/roles/role-management-tab.tsx))**:
   - Replaced raw `Table` with TanStack `useReactTable` and `<DataTable />`.
   - Wired sticky row numbers (`showRowIndex`) and standardized `<DataTablePagination />`.
2. **`UserMembershipDrawer` ([`user-membership-columns.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/system/roles/user-membership-columns.tsx), [`user-membership-drawer.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/system/roles/user-membership-drawer.tsx))**:
   - Replaced raw `Table` with TanStack `useReactTable` and `<DataTable />`.
   - Preserved all FIDO2 passkey badges, lockout actions, inspect drawers, and delegation modals.
3. **`BlueprintTableView` ([`blueprint-table-view.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-table-view.tsx))**:
   - Replaced raw `<table>` with TanStack `useReactTable` and `<DataTable />`.
4. **`TemplatePreviewModal` ([`template-preview-modal.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/blueprint-gallery/template-preview-modal.tsx))**:
   - Created `BlueprintAttributesDataTable` using TanStack `useReactTable` and `<DataTable />`.
5. **`CompositeMasterDetailRow` ([`composite-master-detail-row.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/composite-master-detail-row.tsx))**:
   - Converted dynamic child collection projection table to TanStack `useReactTable` and `<DataTable />`.

## 3. Verification & Compliance
- **TypeScript**: `pnpm --filter @acc/console exec tsc --noEmit` &rarr; 0 errors.
- **Unit Testing**:
  - `rbac-matrix-grid.test.tsx` + `sovereign-cockpit-ui.test.tsx`: 9/9 passed.
  - `composite-master-detail-row.test.tsx` + `composite-data-explorer.test.tsx`: 12/12 passed.
- **Playwright E2E**: `12-sovereign-rbac-matrix.spec.ts` &rarr; 1 passed (0 WCAG AA accessibility violations).
