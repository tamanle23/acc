# Walkthrough 91: Resizable Domain Blueprint Catalog Modal with Freeform Drag Handles & Maximize Toggle

## 1. Problem
The Domain Blueprint Catalog modal had a fixed 88vh / max-w-6xl bounding box. On diverse screen resolutions or when examining complex schemas in Split View, users needed the ability to expand, resize, or maximize the modal on demand without layout clipping.

## 2. Solution & Architectural Design
1. **`useResizableDialog` Hook** ([`use-resizable-dialog.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/hooks/use-resizable-dialog.ts)):
   - Encapsulates freeform dimensions (`width`, `height`), `minWidth` (640px), `minHeight` (480px), and viewport ratio limits (98vw, 96vh).
   - Manages mouse movement deltas across 8 resize directions (`bottom-right`, `bottom-left`, `top-right`, `top-left`, `right`, `left`, `bottom`, `top`).
   - Symmetrically computes scale factors around the center-anchored dialog position (`translate(-50%, -50%)`).
   - Persists custom dimensions and maximized state to `localStorage` (`console:dialog:blueprint-catalog:dimensions`).
   - Exposes `toggleMaximize` and `resetToDefault` callbacks with dynamic CSS styles.

2. **`DialogResizeHandles` Component** ([`dialog-resize-handles.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/components/dialog-resize-handles.tsx)):
   - Renders 4 corner grip handles and 4 edge drag rails around the modal boundary.
   - Includes a subtle stippled corner drag indicator in the bottom-right corner that illuminates on hover.
   - Automatically unmounts / disables hit-testing when maximized.

3. **`BlueprintGalleryDialog` Integration** ([`blueprint-gallery-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery-dialog.tsx)):
   - Replaced fixed classes with `style={dialogStyle}`.
   - Added window action controls in the dialog header:
     - **Reset Size** (`RotateCcw`): Resets custom dimensions back to default 1150x780px.
     - **Maximize / Restore** (`Maximize2` / `Minimize2`): Expands modal to full viewport bounds (98vw x 96vh) or restores previous custom size.

## 3. Verification
- **Unit Tests**: Added test suite covering `DialogResizeHandles` mounting, mouse-down drag triggering, and maximization hiding in [`blueprint-gallery.test.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery.test.tsx). Passed 58/58 tests across 9 suites.
- **TypeScript**: `pnpm --filter @unipost/console exec tsc --noEmit` passed with 0 errors.
