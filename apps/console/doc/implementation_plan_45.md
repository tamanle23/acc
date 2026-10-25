# Refactor Data Table Boilerplate Duplication in `@acc/console`

Refactor the repetitive HTML table rendering logic (`<Table>`, `<TableHeader>`, `<TableBody>`, `flexRender`, header/row/cell mappings, and empty results handling) into a single reusable `<DataTable />` component inside `src/components/data-table/`.

## User Review Required

> [!NOTE]
> No breaking API or UI changes. The visual appearance and functionality of `UsersTable` and `TasksTable` will remain identical, adhering to the monorepo's **Liquid Glass UI** styling standards.

## Proposed Changes

### Data Table Core Components

#### [NEW] [data-table.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/data-table/data-table.tsx)
- Create a generic `<DataTable<TData>>` component accepting `table: Table<TData>`, optional `className`, `containerClassName`, and `noResultsMessage`.
- Encapsulate the `<Table>`, `<TableHeader>`, `<TableBody>`, `flexRender`, column meta styling (`header.column.columnDef.meta?.className`, `thClassName`, `tdClassName`), and zero-results fallback logic.

#### [MODIFY] [index.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/data-table/index.ts)
- Re-export `DataTable` alongside `DataTablePagination`, `DataTableColumnHeader`, `DataTableToolbar`, and `DataTableBulkActions`.

---

### Feature Tables Refactoring

#### [MODIFY] [users-table.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/users/components/users-table.tsx)
- Replace ~65 lines of duplicated table rendering JSX with `<DataTable table={table} />`.

#### [MODIFY] [tasks-table.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/tasks/components/tasks-table.tsx)
- Replace ~65 lines of duplicated table rendering JSX with `<DataTable table={table} className='min-w-xl' />`.

---

## Verification Plan

### Automated Tests / Verification
- Run `pnpm --filter @acc/console build:web` to verify zero TypeScript errors and clean bundle build.
- Run `pnpm --filter @acc/console lint` to verify clean ESLint status.
