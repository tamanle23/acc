# 091: Resizable Domain Blueprint Catalog Modal with Freeform Drag Handles & Maximize Toggle

## Context & Problem
In `@unipost/console`, the Domain Blueprint Catalog modal was restricted to static viewport ratios (`h-[88vh]`, `max-w-6xl`). When inspecting complex domain blueprints in Split View or viewing dense catalogs on ultra-wide / compact displays, users had no capability to expand or freely adjust dialog dimensions.

## Implementation Details
1. **`useResizableDialog` Hook**:
   - Created in `apps/console/src/hooks/use-resizable-dialog.ts`.
   - Supports 8 directional resize anchors (`bottom-right`, `bottom-left`, `top-right`, `top-left`, `right`, `left`, `bottom`, `top`).
   - Symmetrically calculates viewport coordinate deltas for center-anchored (`translate(-50%, -50%)`) modals.
   - Saves custom dimensions (`width`, `height`) and `isMaximized` flag to `localStorage`.
   - Provides safe fallback bounds (`minWidth: 640px`, `minHeight: 480px`, `maxWidth: 98vw`, `maxHeight: 96vh`).
2. **`DialogResizeHandles` UI Component**:
   - Created in `apps/console/src/components/dialog-resize-handles.tsx`.
   - Renders 4 corner handles and 4 edge hover drag strips.
   - Includes stippled SVG corner dots in the bottom-right for visible drag feedback.
   - Hides handles automatically when modal is in maximized state.
3. **`BlueprintGalleryDialog` Header Controls**:
   - Integrated `DialogResizeHandles` into `apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery-dialog.tsx`.
   - Added `RotateCcw` button to reset window back to default dimensions when customized.
   - Added `Maximize2` / `Minimize2` toggle button next to dialog close button.
   - Applied dynamic `style={dialogStyle}` to `DialogContent`.

## Verification
- Unit Tests: `pnpm --filter @unipost/console test src/features/metadata` passed 58/58 tests.
- Type Safety: `pnpm --filter @unipost/console exec tsc --noEmit` passed with 0 errors.
