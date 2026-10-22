# Walkthrough: Responsive Mobile, Tablet & Compact Studio Layout

## 1. Overview
Implemented comprehensive responsive layout ergonomics across [Visual DAG Studio 2.0](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx) to prevent horizontal collision, layout breakage, and canvas occlusion when viewed on smaller screens (< 1280px desktop, 768px-1024px tablet, and < 768px mobile).

## 2. Key Architecture & Layout Changes

### 2.1 Dynamic Container-Aware Layout Tracking
- Integrated container width tracking in `DagStudioCanvas` using `ResizeObserver`:
  ```ts
  const [containerWidth, setContainerWidth] = useState<number>(1200);
  // Updates dynamically on container resize
  setContainerWidth(reactFlowWrapper.current.offsetWidth);
  ```
- Replaces rigid global viewport queries with local container-aware layout handling, ensuring studio responsiveness when rendered inside tabs, side panels, drawers, or resized browser windows.

### 2.2 Adaptive Floating Clusters & Flex Command Bar
- **Wide Screens (>= 960px)**: Retains the tri-cluster floating command aesthetic:
  - Left Cluster: Studio Title, Mode Badge, workflow key, Diff selector, Hot Migrate trigger.
  - Center Cluster: Auto-Layout, Snap toggle, Edge Routing (Curves/Orthogonal), Undo/Redo.
  - Right Cluster: Palette toggle, Blank DAG reset, Validate DAG, Dry Run, IR options, Fullscreen, Save DAG.
- **Compact & Narrow Screens (< 960px)**:
  - Clustered elements wrap cleanly inside an absolute top flex header banner (`absolute top-2 left-2 right-2 flex flex-wrap items-center justify-between gap-1.5`).
  - Button text labels collapse to icon-only displays with accessible `aria-label` and `title` tooltips, preserving full touch and click targets.
  - Studio title smoothly shortens from "Visual DAG Studio 2.0" to "Studio" on extra small screens.
  - Save button text switches from "Save DAG" to "Save" on narrow screens.

### 2.3 Auto-Collapsing Node Palette
- Added `defaultCollapsed` and controlled `isCollapsed` / `onCollapsedChange` props to [DagPalette](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/workflows/components/studio/dag-palette.tsx).
- When `containerWidth < 900`, `VisualDagStudio` initializes `DagPalette` in slim rail mode (`w-14` / 48px) so the canvas editing canvas remains open and unobstructed.

### 2.4 Ergonomics for Debugger Sub-Pill, Empty State & Selection Toolbar
- **Debugger Sub-Pill**: Snapped dynamically below the header toolbar (`top: 16px + headerToolbarHeight + 8px`) with horizontal scroll containment (`max-w-[calc(100%-2rem)] overflow-x-auto scrollbar-none`) and abbreviated label ("Debug") on small viewports.
- **Empty State**: Enhanced with `max-w-[calc(100%-2rem)]` and responsive padding so onboarding starter buttons never overflow mobile screens.
- **Multi-Selection Toolbar**: Added `max-w-[calc(100%-1.5rem)] overflow-x-auto scrollbar-none` to guarantee seamless alignment actions on small screens.

## 3. Verification
- **Unit & Studio Tests**: 64 passing tests across the studio suite:
  ```bash
  pnpm --filter @unipost/console test -- src/features/workflows/components/studio/
  ```
- **Full Console Test Suite**: 82 test suites, 392 tests passing.
- **TypeScript Check**: `pnpm --filter @unipost/console exec tsc --noEmit` exited 0 with zero errors.
