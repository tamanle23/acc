# History Record 207: Enterprise Data Table Standardization Across Console

## 1. Problem Statement
The user requested that all data tables across `@acc/console` MUST use `@/components/data-table/data-table.tsx`, with the sole permitted exception of the dynamic virtualized metadata spreadsheet grid (`entity-data-grid.tsx`). Several components had bespoke tables or raw markup bypassing this architecture.

## 2. Refactoring & Standardizations
- **RoleManagementTab**: Extracted columns into `role-management-columns.tsx`, instantiated `useReactTable`, and wired `<DataTable showRowIndex />` + `<DataTablePagination />`.
- **UserMembershipDrawer**: Extracted columns into `user-membership-columns.tsx`, instantiated `useReactTable`, and wired `<DataTable showRowIndex />` + `<DataTablePagination />`.
- **BlueprintTableView**: Converted sortable table into TanStack Table with `<DataTable showRowIndex />`.
- **TemplatePreviewModal**: Refactored attribute inspection into `BlueprintAttributesDataTable` using `<DataTable showRowIndex />`.
- **CompositeMasterDetailRow**: Converted child sub-collection table to dynamic TanStack Table with `<DataTable />`.

## 3. Verification & Compliance
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
- Vitest unit test suites (`rbac-matrix-grid.test.tsx`, `sovereign-cockpit-ui.test.tsx`, `composite-master-detail-row.test.tsx`, `composite-data-explorer.test.tsx`): 100% green.
- Playwright E2E spec `12-sovereign-rbac-matrix.spec.ts`: Passed cleanly with 0 WCAG 2.2 AA violations.
