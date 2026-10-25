# Walkthrough - DataTable Sticky Bulk Row Selection Column

## Overview
Implemented the **Sticky Bulk Row Selection Column** in `DataTable` (`apps/console/src/components/data-table/data-table.tsx`), harmonizing it with the row selection capabilities of `EntityDataGrid` (`apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`) and the recently introduced sticky row order increment column (`#`).

Key capabilities:
1. **Sticky Left Pinning with Dynamic Multi-Column Offsets**:
   - Pinned with fixed width `w-12 text-center` (48px / 3rem) and specular border.
   - Dynamic positioning:
     - When standalone: pinned to `start-0` with elevation shadow (`shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]`).
     - When co-existing with `#` (`row_index`): `#` pins to `start-0` (0px–48px) and `select` pins seamlessly to `start-12` (48px–96px). The rightmost sticky left column receives the elevation drop shadow.
2. **Frosted Liquid Glass Surface**: Translucent backdrops for both header (`bg-background/95 dark:bg-slate-900/95 backdrop-blur-md`) and row cells (`bg-background/90 group-hover:bg-background/95 dark:bg-slate-900/90 dark:group-hover:bg-slate-800/95 backdrop-blur-xl`).
3. **Dual Integration Patterns**:
   - **Prop-driven**: `<DataTable table={table} showRowSelection />` (or `showRowSelect`) automatically injects the bulk selection column with header select-all checkbox and row checkboxes without requiring manual column definition edits.
   - **Column-driven**: `createRowSelectColumn<TData>()` helper exported from `@/components/data-table` for explicit placement in custom `columns` arrays, with automatic deduplication when `showRowSelection` is enabled.
4. **Row Click Isolation**:
   - Clicking a row checkbox or clicking anywhere inside `td[data-row-select="true"]` stops propagation (`e.stopPropagation()`), preventing unintentional triggering of `onRowClick` handlers (such as opening detail drawers or navigation).
5. **State Awareness & Accessibility**:
   - Header checkbox reflects indeterminate state (`indeterminate`) when a subset of page rows is selected, and checked state when all page rows are selected.
   - WCAG 2.2 AA compliant with explicit `aria-label="Select all"` and `aria-label="Select row"` accessible names.

---

## Changes

### 1. `apps/console/src/components/data-table/data-table.tsx`
- Imported `Checkbox` from `@/components/ui/checkbox`.
- Added `ROW_SELECT_COLUMN_ID = 'select'` and `createRowSelectColumn<TData>()` column factory helper.
- Added `showRowSelection?: boolean` and `showRowSelect?: boolean` to `DataTableProps<TData>`.
- Implemented `getStickyStartClass` and `isRightmostStickyLeft` to calculate dynamic `start-0` vs `start-12` offsets and elevation shadows across single or dual sticky left columns (`row_index` + `select`).
- Added sticky selection header rendering in `TableHeader` with "select all" checkbox and `data-row-select="true"` markup.
- Added sticky selection cell rendering in `TableBody` with row checkbox and stopPropagation guard.
- Excluded selection cells and checkboxes from triggering `onRowClick`.
- Updated empty state `colSpan` dynamically (`effectiveColumnCount` accounts for injected `row_index` and `select` columns).

### 2. `apps/console/src/components/data-table/index.ts`
- Exported `createRowSelectColumn` and `ROW_SELECT_COLUMN_ID`.

### 3. `apps/console/src/components/data-table/__tests__/data-table-row-select.test.tsx`
- Added 8 automated unit tests validating:
  - Bulk row selection column rendering with `showRowSelection={true}`.
  - Pinning to `start-0` when standalone.
  - Pinning to `start-12` with rightmost elevation shadow when co-existing with `showRowIndex`.
  - Single row checkbox selection and deselection.
  - Select-all / deselect-all page rows via header checkbox.
  - `onRowClick` isolation when interacting with selection checkboxes or cells.
  - Explicit `createRowSelectColumn` deduplication without double headers.
  - Empty state `colSpan` adjustment with multiple injected sticky columns.

---

## Verification Results

### Unit Tests
```bash
pnpm --filter @acc/console test -- src/components/data-table/__tests__/
```
```
 ✓ src/components/data-table/__tests__/data-table-row-index.test.tsx (6 tests) 54ms
 ✓ src/components/data-table/__tests__/data-table-row-select.test.tsx (8 tests) 146ms

 Test Files  2 passed (2)
      Tests  14 passed (14)
```

### TypeScript Compilation
```bash
pnpm --filter @acc/console exec tsc --noEmit
```
Output: Clean compilation, 0 errors.
