# History Entry 157: Stacking Context Calibration for Sticky Actions Column Behind Table Column Headers

## Problem Statement
When scrolling vertically in `EntityDataGrid`, the sticky right action column cells (`td`) could overlap on top of or collide with table column headers (`th`) if their stacking contexts (`z-index`) were not properly stratified.

## Root Cause
Both the sticky column headers and sticky row action cells had overlapping `z-index` levels (`z-10` on thead, `z-10` on td actions, `z-20` on th actions). When scrolling vertically, `td` elements with `z-10` or higher could visually bleed over the sticky header background (`z-10`).

## Implementation Changes
In `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`:
1. Elevated `<thead className="sticky top-0 z-30 ...">` to `z-30`.
2. Explicitly styled all standard `<th>` headers with `z-30` and backdrop blur background (`bg-white/95 dark:bg-slate-800/95 backdrop-blur-md`).
3. Set the top-right corner actions header cell (`th`) to `z-40`, ensuring it anchors above both regular sticky headers (`z-30`) and sticky row action cells (`z-10`).
4. Retained the sticky row action cells (`td`) at `z-10`, so they scroll cleanly **behind** the sticky table headers vertically, while continuing to float above regular table cells (`z-0`) horizontally.

## Verification
- Vitest unit tests: 68 test files passed, 315/315 tests passing.
- TypeScript compiler (`tsc --noEmit`): 0 errors.
