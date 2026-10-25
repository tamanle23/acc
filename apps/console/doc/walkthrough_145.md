# Walkthrough: Responsive Mobile, Tablet & Compact Studio Layout

## 1. Overview
Implemented comprehensive responsive layout ergonomics across [Visual DAG Studio 2.0](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx) to prevent horizontal collision, layout breakage, and canvas occlusion when viewed on smaller screens (< 1280px desktop, 768px-1024px tablet, and < 768px mobile).

## 2. Key Architecture & Layout Changes

### 2.1 Dynamic Container-Aware Layout Tracking
- Integrated container width tracking in `DagStudioCanvas` using `ResizeObserver`:
  ```ts
  const [containerWidth, setContainerWidth] = useState<number>(1200);
  // Updates dynamically on container resize
  setContainerWidth(reactFlowWrapper.current.offsetWidth);
  ```
- Replaces rigid global viewport queries with local container-aware layout handling, ensuring studio responsiveness when rendered inside tabs, side panels, drawers, or resized browser windows.

### 2.2 Unified Responsive Top Dock & Command Bar
- **Unified Outer Command Bar Dock (`dag-header-command-bar`)**:
  - Encapsulates all 3 clusters in an outer container (`absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none`).
  - Attached `headerToolbarRef` to this outer container, ensuring `headerToolbarHeight` accurately measures the total height of the header bar whether it spans one line on wide screens or wraps into multiple lines on smaller viewports.
  - Left Cluster (`dag-toolbar-left-cluster`): Identity & Mode Badge, workflow key, Diff selector, Hot Migrate trigger.
  - Center Cluster (`dag-toolbar-center-cluster`): Auto-Layout, Snap toggle, Edge Routing, Undo/Redo. Configured with `order-3 xl:order-2 mx-auto xl:mx-0` so on mobile/tablet viewports it centers cleanly as a secondary row without colliding with left or right clusters.
  - Right Cluster (`dag-toolbar-right-cluster`): Palette, Blank, Validate, Dry Run, IR dropdown, Fullscreen, Save DAG. Configured with `order-2 xl:order-3`.
  - Button text labels collapse to icon-only displays with accessible `aria-label` and `title` tooltips, preserving full touch and click targets.
  - Studio title smoothly shortens from "Visual DAG Studio 2.0" to "Studio" on extra small screens.
  - Save button text switches from "Save DAG" to "Save" on narrow screens.

### 2.3 Auto-Collapsing Node Palette & Dynamic Snapping
- Added `defaultCollapsed` and controlled `isCollapsed` / `onCollapsedChange` props to [DagPalette](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/dag-palette.tsx).
- When `containerWidth < 900`, `VisualDagStudio` initializes `DagPalette` in slim rail mode (`w-14` / 48px) so the canvas editing canvas remains open and unobstructed.
- Snaps directly beneath the outer command bar dock (`top: 12 + headerToolbarHeight + 8`), dynamically bound to prevent covering React Flow's bottom panel controls (`react-flow__panel`).

### 2.4 Ergonomics for Debugger Sub-Pill, Empty State & Selection Toolbar
- **Debugger Sub-Pill**: Snapped dynamically below the outer header dock (`top: 12 + headerToolbarHeight + 8`) with horizontal scroll containment (`max-w-[calc(100%-1.5rem)] overflow-x-auto scrollbar-none`) and abbreviated label ("Debug") on small viewports.
- **Empty State**: Enhanced with `max-w-[calc(100%-2rem)]` and responsive padding so onboarding starter buttons never overflow mobile screens.
- **Multi-Selection Toolbar**: Added `max-w-[calc(100%-1.5rem)] overflow-x-auto scrollbar-none` to guarantee seamless alignment actions on small screens.

## 3. Verification
- **Unit & Studio Tests**: 64 passing tests across the studio suite:
  ```bash
  pnpm --filter @acc/console test -- src/features/workflows/components/studio/
  ```
- **TypeScript Check**: `pnpm --filter @acc/console exec tsc --noEmit` exited 0 with zero errors.
