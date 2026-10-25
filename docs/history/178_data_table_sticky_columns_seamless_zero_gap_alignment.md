# 178. DataTable Sticky Columns Seamless Zero-Gap Alignment

## Problem
When `showRowIndex` (#) and `showRowSelection` (bulk selection checkbox) coexisted on `DataTable`, an unwanted gap or blank void appeared between the two sticky left columns. When previous attempts increased the CSS `start` offset from `start-6` (24px) to `start-12` (48px), the gap grew even larger (from ~1px to ~25px).

### Root Cause Analysis
In HTML table layout algorithm (`table-layout: auto`), declaring `w-12` (`width: 3rem; 48px`) on `<th>` and `<td>` cells without explicit `min-width` and `max-width` causes the browser engine to compress narrow cells containing minimal content (like single character `#` or checkbox) down to their min-content width (~23.1px).
When Column 2 (`select`) was assigned `sticky start-12` (`inset-inline-start: 48px`), but Column 1 (`row_index`) was compressed by the layout engine to 23.1px, Column 2 was forced to stick at 48px from the container edge, creating a visible `48px - 23.1px = 24.9px` blank void between Column 1 and Column 2.

## Plan
1. Enforce strict, immutable width constraints on both `#` (`row_index`) and `select` sticky columns using `w-12 min-w-12 max-w-12`.
2. Introduce `getStickyColStyle(colId)` that injects precise inline style constraints (`width: 48, minWidth: 48, maxWidth: 48, left: 0 | 48`) on both `TableHead` and `TableCell` elements.
3. Export `STICKY_COLUMN_WIDTH = 48` from `data-table.tsx` and configure `minSize` and `maxSize` on `createRowIndexColumn` and `createRowSelectColumn`.
4. Clean up legacy classes in `users-columns.tsx` and unused imports in `workflow-executions-columns.tsx`.
5. Update unit test suite in `data-table-row-select.test.tsx` to assert exact CSS classes and computed style values.

## Changes
- `apps/console/src/components/data-table/data-table.tsx`:
  - Exported `STICKY_COLUMN_WIDTH = 48`.
  - Added `minSize` and `maxSize` to `createRowIndexColumn` and `createRowSelectColumn`.
  - Implemented `getStickyColStyle` helper providing exact `width`, `minWidth`, `maxWidth`, and `left` offset based on column position.
  - Added `min-w-12 max-w-12` and `style={getStickyColStyle(...)}` to both injected and column-defined `TableHead` and `TableCell` elements.
- `apps/console/src/components/data-table/__tests__/data-table-row-select.test.tsx`:
  - Added assertions for `min-w-12`, `max-w-12`, `style.width: '48px'`, and `style.left: '0px' | '48px'`.
- `apps/console/src/features/users/components/users-columns.tsx`:
  - Cleaned up obsolete `max-md:sticky start-6` from username column.
- `apps/console/src/features/workflow-executions/components/workflow-executions-columns.tsx`:
  - Removed unused `Checkbox` import.

## Verification
- Unit Tests: `pnpm --filter @acc/console test -- src/components/data-table/__tests__/` (14/14 tests green).
- Type Check: `pnpm --filter @acc/console exec tsc --noEmit` (0 errors).
- Live Browser Verification: Inspected bounding client rects on live `/workflow-executions` table under Chromium:
  - Column 1 (`#`): `left: 274, right: 322, width: 48px`.
  - Column 2 (`select`): `left: 322, right: 370, width: 48px`.
  - Gap: `322 - 322 = 0.000px` (seamless zero gap).

## Tasks
- [x] Identify root cause of column compression in auto table layout.
- [x] Implement strict width locking and computed left offsets.
- [x] Update test assertions for width constraints and style offsets.
- [x] Verify seamless zero gap in browser and test suites.

## Enhancement
Future enhancements could allow configuring a custom sticky column width prop on `DataTable` while dynamically updating the computed sticky offsets for both columns.
