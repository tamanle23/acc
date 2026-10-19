# 152: Grid-Wide Hover Detection for Scrollbar Thumb Ergonomics

## Problem
In dense tables such as `EntityDataGrid` and `DataTable`, the customized scrollbar thumb was barely visible and only became clearly visible when the user positioned their mouse directly over the thin 6px scrollbar track. When hovering over the table itself, users could not easily see the thumb or gauge the horizontal scroll position.

## Plan
1. Update `.scrollbar-thin` in `apps/console/src/styles/index.css` to size `8px` with clear contrast on hover.
2. Add hover selectors targeting parent hover (`.group/grid:hover .scrollbar-thin::-webkit-scrollbar-thumb` and `:hover > .scrollbar-thin::-webkit-scrollbar-thumb`).
3. Add `group/grid` class to `EntityDataGrid` and `DataTable` outer containers.
4. Verify with Vitest and TypeScript check.

## Changes
- `apps/console/src/styles/index.css`:
  - Added parent/group hover rules for scrollbar thumb visibility in both light and dark/obsidian themes.
  - Sized scrollbar track and thumb to 8px with rounded padding-box bounds.
- `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`:
  - Added `group/grid` class to the outer container.
- `apps/console/src/components/data-table/data-table.tsx`:
  - Added `group/grid` class to the outer container.

## Verification
- `npx vitest run src/features/metadata/components/data-explorer/__tests__/entity-data-grid.test.tsx`: 4/4 passing.
- `npx tsc --noEmit --project tsconfig.json`: 0 errors.

## Walkthrough
Detailed walkthrough documented in `apps/console/doc/walkthrough_127.md`.
