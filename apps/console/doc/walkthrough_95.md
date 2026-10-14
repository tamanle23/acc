# Walkthrough 95: Domain Blueprint Catalog Viewport Safe Clamping & Top-Left Clipping Fix

## Problem
In small viewports, high display scaling factors (e.g. 125% or 150% DPI zoom), or when the dialog dimensions stored in `localStorage` exceeded the available screen width, the Domain Blueprint Catalog modal was pushed off the left and/or top edges of the viewport (`left < 0`). Additionally, lingering base styles in `DialogContent` (`top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]`) caused CSS transforms to clash with inline styles, leading to the top-left area (including the title, icon, and corner resize handles) being hidden or clipped off-screen.

## Root Cause
1. **Unbounded Translation Centering**: Relying on `left: '50%'` with `transform: 'translateX(-50%)'` on narrow viewports calculates `left = (viewport - modalWidth) / 2`. When `modalWidth > viewport - 32px`, the left edge becomes negative, pushing the top-left corner past `x=0`.
2. **Transform Conflicts**: Combining `translate-y-[-50%]` and `translate-x-[-50%]` in Radix DialogContent CSS classes with inline top/left offsets created conflicting positioning rules.

## Changes

### 1. `apps/console/src/hooks/use-resizable-dialog.ts`
- Replaced `transform: translateX(-50%)` with safe coordinate clamping:
  - `top`: `max(1rem, ${topOffset})` (never less than 16px from top edge).
  - `left`: `max(1rem, calc(50% - min(${Math.round(size.width / 2)}px, ${Math.round((maxWidthRatio * 100) / 2)}vw)))` (guarantees a minimum 1rem / 16px gutter on the left edge).
  - `width`: `min(${size.width}px, calc(100vw - 2rem))` (prevents dialog from overflowing viewport width).
  - `transform`: `'none'` (eliminates sub-pixel blur and conflicting Radix transforms).
  - Maximized mode includes explicit `right: '1vw'` and `bottom: '1.5vh'` alongside `top: '1.5vh'` and `left: '1vw'`.

### 2. `apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery-dialog.tsx`
- Added explicit utility overrides `top-auto left-auto translate-x-0 translate-y-0` to `DialogContent` className to ensure Radix default 50% translate classes are cleanly overridden.

### 3. `apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery.test.tsx`
- Updated test assertions in `blueprint-gallery.test.tsx` to verify clamped viewport styles (`max(1rem, ...)`, `transform: 'none'`).

## Verification Results
- **Vitest**: `pnpm --filter @unipost/console test src/features/metadata/components/blueprint-gallery/blueprint-gallery.test.tsx` passed (7/7 tests passed).
- **TypeScript**: `pnpm --filter @unipost/console exec tsc --noEmit` exited 0 with zero errors.
