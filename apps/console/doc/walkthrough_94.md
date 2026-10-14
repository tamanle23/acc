# Walkthrough 94: Domain Blueprint Catalog Modal Positioning Optimization

## Problem
Users reported that the Domain Blueprint Catalog modal was positioned too far from the top of the viewport (sitting down in the lower-middle half of the screen, creating excessive empty space above and pushing the content downward).

## Root Cause
The modal was centered via `top-1/2 -translate-y-1/2`. When windowed at standard or smaller heights on modern high-resolution screens (e.g., 1080p, 1440p), dead-center vertical placement pushes the modal down significantly (`top = 50vh - height/2`), leaving 200–350px of dead space above the modal.

## Solution & Architecture Changes
1. **Configurable Anchor in `useResizableDialog`**:
   - Added `anchor?: 'top' | 'center'` option with default `'top'`, and `topOffset?: string` with default `'3.5rem'`.
   - In windowed mode (`anchor === 'top'`), modal is horizontally centered with `left: 50%`, `transform: translateX(-50%)`, and anchored comfortably near the top with `top: 3.5rem`.
   - When maximized, fills the screen cleanly (`top: 1.5vh`, `left: 1vw`, `width: 98vw`, `height: 97vh`, `transform: none`).
2. **1:1 Intuitive Resizing Calculation**:
   - When anchored to top, dragging the bottom edge downwards increases the modal height directly by `1 * deltaY` (rather than doubling it around a vertical center point).
   - Horizontal resizing continues using `2 * deltaX` so that it expands symmetrically around the horizontal center.
3. **`BlueprintGalleryDialog` Integration**:
   - Removed conflicting `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` utility classes in favor of `dialogStyle` from `useResizableDialog`.

## Verification
- Vitest suite in `blueprint-gallery.test.tsx` passed with 7/7 tests covering top-anchored positioning, maximize/restore toggling, and resize handles.
- TypeScript check (`tsc --noEmit`) passed with 0 errors.
