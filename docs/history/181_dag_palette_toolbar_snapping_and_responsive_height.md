# 181. DagPalette Toolbar Snapping & Responsive Height Bound

## Problem
In `VisualDagStudio` (`apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`), `DagPalette` was positioned with a hardcoded static `top-16` class and fixed `max-h-[560px]`. When the header toolbar wrapped or on constrained viewports, the palette could either misalign relative to the toolbar or extend downwards and obscure the bottom React Flow panel controls (`react-flow__panel`, Controls & MiniMap).

## Plan
1. Add `className?: string` and `style?: React.CSSProperties` to `DagPaletteProps` in `dag-palette.tsx`.
2. Add `headerToolbarRef` and a `ResizeObserver` in `visual-dag-studio.tsx` to dynamically measure the header toolbar's height and container height.
3. Snap `DagPalette` directly beneath the toolbar (`top: 16px + headerToolbarHeight + 8px`) and compute a responsive `maxHeight` that leaves bottom headroom for React Flow panels (`containerHeight - paletteTop - 180`).
4. Add automated test coverage and verify clean compilation and zero test regressions.

## Changes
- `apps/console/src/features/workflows/components/studio/dag-palette.tsx`: Added `DagPaletteProps` supporting `className` and `style`.
- `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`: Added `headerToolbarRef`, `headerToolbarHeight`, `containerHeight`, dynamic snapping positioning, and responsive `maxHeight` bound.
- `apps/console/src/features/workflows/components/studio/dag-palette.test.tsx`: Added test verifying custom `className` and `style.maxHeight`.
- `apps/console/src/features/workflows/components/studio/iteration17-studio.test.tsx`: Added test verifying `DagPalette` snaps under toolbar with dynamic `maxHeight`.

## Verification
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
- `pnpm --filter @acc/console test -- src/features/workflows/components/studio/`: 12 test files passed, 55 tests passed.

## Walkthrough
Refer to [`walkthrough_143.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/walkthrough_143.md).
