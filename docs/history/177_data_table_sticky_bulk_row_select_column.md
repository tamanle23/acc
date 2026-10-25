# 177 - DataTable Sticky Bulk Row Selection Column

## Problem
In `@acc/console`, the bulk row selection capability was either manually assembled with bespoke column definitions in each view or lacked sticky left alignment and proper Liquid Glass elevation layering. Furthermore, when both the sticky row order increment column (`#`) and a bulk selection column were present, fixed `left: 0` pinning resulted in overlapping columns rather than proper dynamic multi-column left offsets.

## Plan
1. **Extend `DataTableProps` & Column Factory**:
   - Add `showRowSelection?: boolean` and `showRowSelect?: boolean` to `DataTableProps<TData>`.
   - Export `createRowSelectColumn<TData>()` and `ROW_SELECT_COLUMN_ID = 'select'`.
2. **Implement Dynamic Multi-Column Sticky Offsets**:
   - Provide `getStickyStartClass` and `isRightmostStickyLeft` helpers.
   - When standalone: pin to `start-0` with elevation drop shadow (`shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]`).
   - When co-existing with `#`: `#` pins to `start-0` (0–48px) and `select` pins to `start-12` (48–96px), with the rightmost column carrying the elevation drop shadow.
3. **Event Isolation & Liquid Glass Polish**:
   - Stop click propagation (`e.stopPropagation()`) on selection cells and checkboxes so row click handlers (`onRowClick`) are not triggered accidentally.
   - Implement frosted Liquid Glass backdrops matching `EntityDataGrid`.
4. **Verification**:
   - Add comprehensive unit test suite covering standalone pinning, dual sticky column offsets, row and bulk toggle, row click isolation, explicit column deduplication, and empty-state colSpan.
   - Run typecheck and unit tests across `@acc/console`.

## Changes
- `apps/console/src/components/data-table/data-table.tsx`: Added `createRowSelectColumn`, `showRowSelection` / `showRowSelect` props, multi-column offset calculation (`start-0` vs `start-12`), sticky header/cell checkbox rendering, and row click isolation.
- `apps/console/src/components/data-table/index.ts`: Exported `createRowSelectColumn` and `ROW_SELECT_COLUMN_ID`.
- `apps/console/src/components/data-table/__tests__/data-table-row-select.test.tsx`: 8 automated unit tests.
- `apps/console/doc/walkthrough_141.md`: Feature walkthrough documentation.

## Verification
- `pnpm --filter @acc/console test -- src/components/data-table/__tests__/`: 14/14 tests passed across 2 test files (both row-index and row-select).
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
