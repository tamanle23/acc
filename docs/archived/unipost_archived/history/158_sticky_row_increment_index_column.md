# History Entry 158: Sticky Row Increment Index Column in EntityDataGrid

## Problem Statement
In `EntityDataGrid`, especially when browsing datasets with high volume (up to 1,000 rows/page) or many columns (100+ columns), users needed a persistent row number column pinned to the start of the table to easily identify and reference row positions.

## Implementation Changes
In `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`:
1. **Row Index Column Definition (`row_index`)**:
   - Added `rowIndexCol` to `baseCols` preceding the `id` column.
   - Computes global continuous indexing: `(page - 1) * pageSize + row.index + 1`.
   - Set `enableHiding: false` and `size: 48` so it remains consistently visible and cannot be hidden via column toggles.
2. **Sticky Stacking & Glass Visuals**:
   - Pinned the header cell at `sticky left-0 z-40 w-12 text-center border-r border-white/20 dark:border-white/10 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]`.
   - Pinned body cells at `sticky left-0 z-10 w-12 text-center bg-white/90 group-hover:bg-white/95 dark:bg-slate-900/90 dark:group-hover:bg-slate-800/95 backdrop-blur-xl border-r border-white/20 dark:border-white/10 shadow-[6px_0_12px_-4px_rgba(0,0,0,0.06)]`.
   - When horizontally scrolling wide columns, the index column remains firmly pinned on the left.
   - When vertically scrolling, the `z-10` body cells slide cleanly underneath the `z-30`/`z-40` sticky table header row.
3. **Memoization Dependency Alignment**:
   - Added `page` and `pageSize` to `columns` useMemo dependencies so the continuous index recalculates when paging.

## Verification
- Vitest unit tests: 68 test files passed, 315/315 tests passing.
- TypeScript compiler (`tsc --noEmit`): 0 errors.
