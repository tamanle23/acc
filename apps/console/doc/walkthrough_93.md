# Walkthrough 93: Fix Domain Blueprint Catalog Modal Vertical Centering

## 1. Problem Statement
Following the addition of the resizable dialog handles and maximize capability to the Domain Blueprint Catalog modal, the dialog appeared pushed toward the bottom of the viewport ("now , modal kinda align bottom").

### Root Cause
1. **Tall Static Initial Height vs. Laptop Viewport**: The default dialog height was fixed at `780px` (`defaultHeight: 780`), which on standard laptop displays or 1080p monitors with browser UI chrome (viewport height ~800–900px) left minimal vertical breathing room and pushed the dialog edges flush against the bottom boundary.
2. **Missing `max-w-none` and Explicit Positioning**: The base `DialogPrimitive.Content` in `apps/console/src/components/ui/dialog.tsx` has `sm:max-w-lg`. Without `max-w-none` and explicit centered positioning overrides (`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`), Tailwind classes could conflict or fail to center dynamically when custom inline widths and heights are applied.
3. **Implicit Margin Reset**: Standard dialog styles can inherit browser user-agent margins or conflicting flex/grid offsets. Explicitly setting `margin: 0` ensures perfect centering calculations.

## 2. Changes Made
- [`useResizableDialog`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/hooks/use-resizable-dialog.ts):
  - Added dynamic `getResponsiveDefault()` helper computing initial size bounded by `Math.min(defaultWidth, Math.round(window.innerWidth * 0.92))` and `Math.min(defaultHeight, Math.round(window.innerHeight * 0.82))`.
  - Added `margin: 0` to `dialogStyle` (both maximized and windowed states).
  - Adjusted default `maxHeightRatio` to `0.88` (from `0.96`) so un-maximized dialogs always retain balanced vertical margins above and below.
  - Updated `resetToDefault()` to dynamically use responsive default sizing.
- [`BlueprintGalleryDialog`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery-dialog.tsx):
  - Updated `DialogContent` className with `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none` to guarantee strict viewport centering regardless of screen aspect ratio or resize state.
- [`blueprint-gallery.test.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery.test.tsx):
  - Added unit test verifying `useResizableDialog` computes centered `dialogStyle` with `margin: 0`, responsive dimensions, and proper maximize/reset states.

## 3. Verification
- `pnpm --filter @unipost/console test src/features/metadata/components/blueprint-gallery/blueprint-gallery.test.tsx`: 7/7 tests passed.
- `pnpm --filter @unipost/console exec tsc --noEmit`: Clean type check with zero errors.
