# 183. Visual DAG Studio Responsive Layout & Compact Ergonomics

## Problem Statement
On smaller displays (< 1280px desktop, 768px-1024px tablet, and mobile devices), the floating toolbar clusters in [Visual DAG Studio 2.0](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx) collided horizontally with each other, obscured the central canvas, and broke layout boundaries. Furthermore, the 256px expanded palette and fixed-position debugger sub-pill covered canvas nodes and controls.

## Plan & Architecture
1. **Container Dimension Tracking**: Track `containerWidth` in addition to `containerHeight` using `ResizeObserver` on `reactFlowWrapper`, making layout adaptability container-aware rather than purely window-dependent.
2. **Adaptive Floating Command Bar**:
   - Encapsulate Left, Center, and Right clusters in a unified responsive top dock (`dag-header-command-bar`) positioned at `absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none`.
   - Attach `headerToolbarRef` to the dock container to observe the true total header height across any number of wrapped lines via `ResizeObserver`.
   - Center cluster is prioritized as `order-3 xl:order-2 mx-auto xl:mx-0` so on mobile/tablet viewports it centers cleanly on a secondary line without colliding with left or right clusters.
   - Right cluster is given `order-2 xl:order-3` for intuitive alignment across all responsive breakpoints.
   - Responsive icon-only button states with full WCAG 2.2 AA accessibility (`aria-label` and `title` tooltips preserved).
3. **Auto-Collapsing Palette & Height Clamping**: Add `defaultCollapsed` support in `DagPalette`, auto-defaulting to slim rail mode (`w-14`) when container width is under 900px, and dynamically snapping directly beneath the outer header dock (`top: 12 + headerToolbarHeight + 8`).
4. **Debugger Snapping**: Dynamically compute top offset for the execution debugger sub-pill (`12 + headerToolbarHeight + 8`), and clamp max-width with scroll containment on `DagSelectionToolbar` and `DagCanvasEmptyState`.

## Changes Made
- `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`:
  - Added `containerWidth` state and observer.
  - Implemented responsive flex wrap container for left, center, and right clusters.
  - Added responsive text collapsing on button labels (Auto-Layout, Snap, Curves/Orthogonal, Palette, Blank, Validate DAG, Dry Run, Save DAG).
  - Dynamically positioned execution debugger sub-pill below header toolbar with scroll containment.
- `apps/console/src/features/workflows/components/studio/dag-palette.tsx`:
  - Added `defaultCollapsed`, `isCollapsed`, and `onCollapsedChange` props.
- `apps/console/src/features/workflows/components/studio/dag-canvas-empty-state.tsx`:
  - Added `max-w-[calc(100%-2rem)]` and responsive padding.
- `apps/console/src/features/workflows/components/studio/dag-selection-toolbar.tsx`:
  - Added `max-w-[calc(100%-1.5rem)] overflow-x-auto scrollbar-none`.
- `apps/console/src/features/workflows/components/studio/iteration18-studio.test.tsx`:
  - Added unit test coverage for `defaultCollapsed` prop and responsive toolbar elements.

## Verification
- `pnpm --filter @unipost/console test -- src/features/workflows/components/studio/`: 13 test files passed, 64 tests passed.
- `pnpm --filter @unipost/console test`: 82 test suites passed, 392 tests passed.
- `pnpm --filter @unipost/console exec tsc --noEmit`: zero type errors.

## Walkthrough & Artifacts
- Walkthrough: `apps/console/doc/walkthrough_145.md`
