# 176 - DataTable Row Order Increment Sticky Column

## Problem
In `@acc/console`, the primary `EntityDataGrid` component featured a sticky `#` row order increment column with Liquid Glass frosted backdrop and pagination index calculations. However, the shared `DataTable` primitive lacked this capability, leading to visual inconsistency and making it harder for operators to reference row numbers across operational views like `/workflow-executions` and `/system/dlq`.

## Plan
1. **Extend `DataTableProps` & Column Factory**:
   - Add `showRowIndex?: boolean` and `rowIndexOffset?: number` to `DataTableProps<TData>`.
   - Export `createRowIndexColumn<TData>()` and `ROW_INDEX_COLUMN_ID = 'row_index'`.
2. **Implement Sticky Styling & Index Calculations**:
   - Detect both prop-injected (`showRowIndex && !hasRowIndexColumn`) and column-defined (`col.id === 'row_index' || col.id === 'rowIndex'`) columns.
   - Apply `sticky start-0 z-20` (header) and `sticky start-0 z-10` (cell) with `w-12 text-center` (48px), frosted backdrop blur, specular border, and elevation shadow.
   - Calculate continuous monotonic row indices: `(pageIndex * pageSize) + rowIndex + 1 + rowIndexOffset`.
3. **Harmonize Operational Views**:
   - Enable `showRowIndex` in `WorkflowExecutionsTable` and `DlqTable`.
4. **Verification**:
   - Create unit test suite covering prop injection, pagination offsets, explicit column definitions, empty states, and row click interactions.
   - Verify full test suite (80 test files) and `tsc --noEmit`.

## Changes
- `apps/console/src/components/data-table/data-table.tsx`: Added `createRowIndexColumn`, `showRowIndex` prop, sticky `#` header/cell rendering, and dynamic empty-state colSpan.
- `apps/console/src/components/data-table/index.ts`: Exported `createRowIndexColumn`, `ROW_INDEX_COLUMN_ID`, `DataTableProps`.
- `apps/console/src/features/workflow-executions/components/workflow-executions-table.tsx`: Enabled `showRowIndex`.
- `apps/console/src/features/dlq/components/dlq-table.tsx`: Enabled `showRowIndex`.
- `apps/console/src/components/data-table/__tests__/data-table-row-index.test.tsx`: 6 unit tests.
- `apps/console/doc/walkthrough_140.md`: Feature walkthrough.

## Verification
- `pnpm --filter @acc/console test -- src/components/data-table/__tests__/data-table-row-index.test.tsx`: 6/6 tests passed (67ms).
- `pnpm --filter @acc/console test:run`: 80/80 test files passed (372 tests green).
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
