# 097: Anchor Domain Blueprint Catalog Modal Comfortably Near Viewport Top

## Problem
The Domain Blueprint Catalog modal was positioned too far from the top of the viewport when opened in windowed mode, creating awkward empty space at the top of the screen and pushing the modal downwards.

## Plan
1. Update `useResizableDialog` to support configurable vertical anchoring (`anchor: 'top' | 'center'`), defaulting to `'top'` with `topOffset: '3.5rem'`.
2. Adjust vertical resize scaling factor (`factorY = 1` when top-anchored) for natural 1:1 cursor movement when dragging the bottom handles.
3. Clean up conflicting CSS classes in `BlueprintGalleryDialog`.
4. Update unit tests to verify the new top-anchored dialog style, maximize state, and resize behavior.

## Changes
- `apps/console/src/hooks/use-resizable-dialog.ts`: Added `anchor` and `topOffset` options, adjusted `factorY`, updated `dialogStyle` position/top/transform.
- `apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery-dialog.tsx`: Cleaned up static position classes on `DialogContent` so `dialogStyle` drives the layout.
- `apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery.test.tsx`: Updated test assertions for top-anchored styles.
- `apps/console/doc/walkthrough_94.md`: Documented changes.

## Verification
- `pnpm --filter @unipost/console test src/features/metadata/components/blueprint-gallery/blueprint-gallery.test.tsx` passed (7/7 tests).
- `pnpm --filter @unipost/console exec tsc --noEmit` passed with 0 errors.
