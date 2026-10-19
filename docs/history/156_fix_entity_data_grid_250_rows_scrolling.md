# History Entry 156: Fix EntityDataGrid Viewport Sizing and Sticky Pagination for High Page Sizes (250+ Rows)

## Problem Statement
When selecting high page sizes (e.g. 250, 500, or 1000 rows per page) in `EntityDataGrid`:
- The container was missing an explicit flex column bounds chain through Radix UI `TabsContent`, causing the component not to constrain its inner height.
- The table container expanded beyond the viewport, causing the pagination bar at the bottom to be pushed off-screen and breaking independent vertical/horizontal scrolling inside the table canvas.

## Root Cause
In `apps/console/src/features/metadata/components/metadata-feature.tsx`, `TabsContent` for the `data` tab was styled with `className="m-0 flex-1 min-h-0 focus-visible:outline-none"`. Because Radix UI `TabsPrimitive.Content` does not apply `display: flex` by default, its child `EntityDataGrid` (which relied on flex stretching via `flex-1 min-h-0`) was not constrained within a bounded flex container. Consequently, the container expanded to fit its content rather than constraining `scrollContainerRef` to the viewport height.

## Implementation Changes
1. **`apps/console/src/features/metadata/components/metadata-feature.tsx`**:
   - Added `h-full flex flex-col` to `TabsContent` for `schema`, `data`, and `relationships` tabs.
   - Ensures any active tab view receives an explicit, constrained flex column context bounded by the parent `Tabs` container (`flex flex-col gap-4 flex-1 max-lg:min-h-fit lg:min-h-0`).
2. **`apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`**:
   - Updated the canvas wrapper to `flex flex-col lg:flex-row items-stretch gap-4 w-full min-w-0 flex-1 min-h-[420px] lg:min-h-0`.
   - Updated the table card (`group/grid`) to `flex flex-col overflow-hidden h-full min-h-[420px] lg:min-h-0`.
   - Updated `scrollContainerRef` to `overflow-x-auto overflow-y-auto relative w-full flex-1 min-h-0 h-full scrollbar-thin`.
   - Preserved `shrink-0` on the bottom pagination bar so that it remains pinned and visible at all times.

## Verification
- Unit test suite: 68 test files passed, 315/315 tests passing.
- TypeScript compiler (`tsc --noEmit`): 0 errors.
- Virtualization: `@tanstack/react-virtual` successfully computes visible item windows within bounded `scrollContainerRef` on any page size.
