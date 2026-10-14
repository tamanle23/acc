# Walkthrough 90: Fix Layout Cutouts, Table Blowout, and Card Item Breakouts in Blueprint Catalog

## 1. Problem
In the Domain Blueprint Catalog modal (`BlueprintGalleryDialog`), layout issues persisted across all 3 view modes:
1. **Grid Mode**: Blueprint card contents broke out of their containers when model badges, category tags, or descriptions wrapped awkwardly.
2. **Table Mode**: Table columns blew past the modal width, causing horizontal overflowing and unbalanced columns.
3. **Split Mode**: In compact screen bounds or narrow split containers, the master rail and detail SVG canvas cut off node badges and cards, and double scrollbars occurred.

## 2. Root Cause
- **Flexbox Min-Width**: Default flex items have `min-width: auto`, preventing `truncate` and `line-clamp` from shrinking gracefully inside flex children in `BlueprintCard`.
- **Table Layout**: Without `table-fixed` and explicit width percentages/constraints, the HTML table dynamically sized according to cell contents, resulting in modal blowout.
- **SVG ViewBox & Aspect Ratio**: `BlueprintGraphCanvas` had a narrow 640x300 bounding box with nodes positioned near outer boundaries and lacked `preserveAspectRatio="xMidYMid meet"`, causing nodes on the right/bottom to be clipped. The outer split view container had rigid `min-h-[520px]` and dual scrollbars.

## 3. Changes Made
1. **`BlueprintCard`** ([`blueprint-card.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-card.tsx)):
   - Added `min-w-0 overflow-hidden` to outer card wrapper and text flex containers.
   - Enforced title truncation with `truncate` and `title={blueprint.name}` fallback.
   - Added `shrink-0` to header badges to prevent them from pushing titles or wrapping abnormally.
2. **`BlueprintTableView`** ([`blueprint-table-view.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-table-view.tsx)):
   - Applied `table-fixed` to the table element.
   - Assigned explicit percentage and min-width columns (`w-[28%] min-w-[180px]` for name, `w-[18%]` for category, `w-[30%]` for description, `w-[8%]` for models/edges, `w-[16%]` for actions).
   - Compacted padding to `p-2.5` to fit within modal bounds without blowout.
3. **`BlueprintGraphCanvas`** ([`blueprint-graph-canvas.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-graph-canvas.tsx)):
   - Expanded virtual coordinate space from 640x300 to `800x400` with padded semi-elliptical node radius (`radiusX = 260, radiusY = 120`).
   - Added `preserveAspectRatio="xMidYMid meet"` to prevent clipping of node cards at any aspect ratio.
   - Set container height to responsive `h-[280px] md:h-[340px]`.
4. **`BlueprintSplitView`** ([`blueprint-split-view.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-split-view.tsx)):
   - Replaced fixed `min-h-[520px]` with fluid `flex-1 min-h-0 h-full`.
   - Set master rail to `md:w-[32%] lg:w-[28%] shrink-0 min-h-0`.
   - Set detail pane to `flex-1 w-full min-w-0 flex flex-col min-h-0`.
5. **`BlueprintGalleryDialog`** ([`blueprint-gallery-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery-dialog.tsx)):
   - Updated layout container so Split mode uses `flex flex-col overflow-hidden` (independent pane scrolling) while Grid and Table use `overflow-y-auto`.

## 4. Verification
- **TypeScript**: `tsc --noEmit --project tsconfig.json` passed with 0 errors.
- **Vitest**: `pnpm --filter @unipost/console test src/features/metadata` passed with 9 test files, 56/56 tests passing.
- **UI Inspection**: Grid cards respect bounds without text blowout; Table displays proportional fixed columns within modal width; Split view scales the SVG topology without clipping any node badges or producing awkward dual scrollbars.
