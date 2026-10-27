# 095. Fix Domain Blueprint Catalog Modal Vertical Centering

## 1. Problem Statement
When opening the Domain Blueprint Catalog modal after introducing the resizable dialog handles, the modal appeared vertically pushed down and aligned close to the bottom of the screen instead of being centered.

## 2. Root Cause
- The dialog hook initialized with a rigid `780px` default height, occupying nearly 90–95% of typical laptop viewports (~800–900px height with taskbar and browser chrome), leaving virtually no lower margin.
- `DialogPrimitive.Content` styles in `dialog.tsx` rely on `sm:max-w-lg` without an explicit `max-w-none` override on `BlueprintGalleryDialog`, and user-agent dialog margins were not explicitly cleared with `margin: 0`.

## 3. Changes Made
1. **Dynamic Responsive Defaults (`useResizableDialog`)**:
   - Implemented `getResponsiveDefault()` computing bounded dimensions based on the current window (`Math.min(defaultWidth, winW * 0.92)` and `Math.min(defaultHeight, winH * 0.82)`).
   - Set default `maxHeightRatio` to `0.88` so the modal maintains comfortable vertical margins.
   - Added `margin: 0` to `dialogStyle` for both maximized and normal window modes.
   - Updated `resetToDefault()` to restore responsive defaults.
2. **Strict Viewport Centering (`BlueprintGalleryDialog`)**:
   - Added `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none` to `DialogContent` className in `blueprint-gallery-dialog.tsx`.
3. **Automated Testing (`blueprint-gallery.test.tsx`)**:
   - Added unit test checking `dialogStyle.margin === 0`, dynamic width/height definitions, and maximize/reset behavior.

## 4. Verification
- `pnpm --filter @acc/console test src/features/metadata/components/blueprint-gallery/blueprint-gallery.test.tsx`: 7/7 tests passed.
- `pnpm --filter @acc/console exec tsc --noEmit`: Typecheck clean.
