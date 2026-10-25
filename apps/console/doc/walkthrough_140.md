# Walkthrough - DataTable Row Order Increment Sticky Column

## Overview
Implemented the **Row Order Increment Sticky Column** in `DataTable` (`apps/console/src/components/data-table/data-table.tsx`), harmonizing it with `EntityDataGrid` (`apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`).

Key capabilities:
1. **Sticky Left Pinning**: The `#` column is pinned to `sticky start-0` with `w-12 text-center` (48px fixed width), specular border, and elevation shadow (`shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]`).
2. **Frosted Liquid Glass Surface**: Translucent backdrops for both header (`bg-background/95 dark:bg-slate-900/95 backdrop-blur-md`) and row cells (`bg-background/90 group-hover:bg-background/95 dark:bg-slate-900/90 dark:group-hover:bg-slate-800/95 backdrop-blur-xl`).
3. **Automatic 1-Based Pagination Indexing**: Calculates `(pageIndex * pageSize) + rowIndex + 1 + rowIndexOffset`, providing continuous monotonic sequence numbers across pages (e.g., 1–10 on page 1, 11–20 on page 2).
4. **Dual Integration Patterns**:
   - **Prop-driven**: `<DataTable table={table} showRowIndex />` automatically injects the `#` column with zero column definition edits.
   - **Column-driven**: `createRowIndexColumn<TData>()` helper exported from `@/components/data-table` to include `#` explicitly in custom `columns` arrays without double-rendering.
5. **Applied to Core Operational Views**:
   - `WorkflowExecutionsTable` (`/workflow-executions`)
   - `DlqTable` (`/system/dlq`)

---

## Changes

### 1. `apps/console/src/components/data-table/data-table.tsx`
- Added `ROW_INDEX_COLUMN_ID = 'row_index'` and `createRowIndexColumn<TData>()` column helper.
- Added `showRowIndex?: boolean` and `rowIndexOffset?: number` to `DataTableProps<TData>`.
- Added sticky `#` header rendering (`start-0 z-20 w-12 text-center`) when `shouldInjectRowIndex` is active or when `col.id === 'row_index' || col.id === 'rowIndex'`.
- Added sticky `#` cell rendering (`start-0 z-10 w-12 text-center`) with row tooltip `Row #${calculatedIndex}`.
- Updated empty state `colSpan` dynamically (`effectiveColumnCount = shouldInjectRowIndex ? columnCount + 1 : columnCount`).

### 2. `apps/console/src/components/data-table/index.ts`
- Exported `createRowIndexColumn`, `ROW_INDEX_COLUMN_ID`, `DataTableProps`.

### 3. `apps/console/src/features/workflow-executions/components/workflow-executions-table.tsx`
- Enabled `showRowIndex` on `<DataTable table={table} showRowIndex ... />`.

### 4. `apps/console/src/features/dlq/components/dlq-table.tsx`
- Enabled `showRowIndex` on `<DataTable table={table} showRowIndex ... />`.

### 5. `apps/console/src/components/data-table/__tests__/data-table-row-index.test.tsx`
- Added 6 automated unit tests validating sticky pinning, pagination offset math, `createRowIndexColumn` deduplication, empty state colSpan, and `onRowClick` safety.

---

## Verification Results

### Unit Tests
```bash
pnpm --filter @acc/console test -- src/components/data-table/__tests__/data-table-row-index.test.tsx
```
```
 ✓ src/components/data-table/__tests__/data-table-row-index.test.tsx (6 tests) 67ms
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

### Full Test Suite
```bash
pnpm --filter @acc/console test:run
```
```
 Test Files  80 passed (80)
      Tests  372 passed (372)
```

### TypeScript Compilation
```bash
pnpm --filter @acc/console exec tsc --noEmit
```
Output: Clean compilation, 0 errors.
