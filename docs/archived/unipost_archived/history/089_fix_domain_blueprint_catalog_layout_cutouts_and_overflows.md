# 089: Fix Domain Blueprint Catalog Layout Cutouts, Table Blowout & Card Item Breakouts

## Context & Problem
In `@acc/console`, the Domain Blueprint Catalog modal exhibited layout defects across all 3 view modes:
- **Grid Mode**: Cards suffered item breakout and overflow when long titles or multiple tags caused containers to wrap awkwardly.
- **Table Mode**: Table blew out past modal boundaries horizontally without fixed proportional column scaling.
- **Split Mode**: In compact screen bounds, the SVG topology cut off node badges and cards, and rigid container heights induced double scrollbars.

## Root Cause
- Default flex item `min-width: auto` prevented `truncate` from operating properly on flex children in `BlueprintCard`.
- Absence of `table-fixed` and column percentage constraints in `BlueprintTableView` allowed cell content to dictate table width beyond the modal envelope.
- `BlueprintGraphCanvas` had a cramped 640x300 viewBox where node coordinates exceeded the canvas boundary, and lacked `preserveAspectRatio="xMidYMid meet"`. `BlueprintSplitView` used fixed heights rather than flex-based fluid layout.

## Implementation Details
1. **Grid Mode Hardening**: Added `min-w-0 overflow-hidden` to outer card wrapper and text containers in `BlueprintCard`. Added `truncate` with `title` fallback on headers, and `shrink-0` on badges.
2. **Table Mode Hardening**: Applied `table-fixed` and percentage column widths (`w-[28%]`, `w-[18%]`, `w-[30%]`, `w-[8%]`, `w-[16%]`) in `BlueprintTableView`. Compacted padding to `p-2.5`.
3. **Split Mode & SVG ViewBox Hardening**:
   - Expanded `BlueprintGraphCanvas` viewBox to 800x400 with padded semi-elliptical placement (`radiusX = 260, radiusY = 120`) and `preserveAspectRatio="xMidYMid meet"`.
   - Converted `BlueprintSplitView` to fluid `flex-1 min-h-0 h-full` with fixed percentage master rail (`md:w-[32%] lg:w-[28%]`) and independent scroll panes.
   - Updated `BlueprintGalleryDialog` container to remove redundant outer scrollbars in split mode.

## Verification
- TypeScript check: `pnpm --filter @acc/console exec tsc --noEmit` passed with 0 errors.
- Vitest suite: `pnpm --filter @acc/console test src/features/metadata` passed 9 test files, 56/56 tests passing.
