# 098: Domain Blueprint Catalog Viewport Safe Clamping & Top-Left Clipping Fix

## Problem
In zoomed displays (125%–150% scaling) or narrower viewports, the Domain Blueprint Catalog modal was pushed off the left and top edges of the screen (`left < 0`), causing the top-left area (title, icon, corner resize handle) to be invisible or clipped.

## Plan
1. Update `use-resizable-dialog.ts` to replace unbounded `left: 50%` + `translateX(-50%)` with safe viewport clamping (`max(1rem, ...)`).
2. Set `transform: 'none'` to eliminate translate conflicts with Radix `DialogContent`.
3. Add `top-auto left-auto translate-x-0 translate-y-0` to `DialogContent` className in `blueprint-gallery-dialog.tsx`.
4. Update unit tests in `blueprint-gallery.test.tsx` and verify test suite and TypeScript checks.

## Changes
- `apps/console/src/hooks/use-resizable-dialog.ts`: Clamped `left` to `max(1rem, calc(50% - min(...)))`, `top` to `max(1rem, ${topOffset})`, and `transform: 'none'`.
- `apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery-dialog.tsx`: Added explicit `top-auto left-auto translate-x-0 translate-y-0` override classes.
- `apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery.test.tsx`: Updated assertions for viewport clamped styling.
- `apps/console/doc/walkthrough_95.md`: Documented reactive walkthrough for the fix.

## Verification
- Vitest: 7/7 tests passed in `blueprint-gallery.test.tsx`.
- TypeScript: `pnpm --filter @unipost/console exec tsc --noEmit` exited with code 0.
