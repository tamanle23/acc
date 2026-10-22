# 182 - Visual DAG Studio Layout & UI/UX Overhaul (Iteration 18)

## Problem
In `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`, the studio header toolbar was previously rendered as a flat, single container with over 22 action buttons crammed together. Furthermore:
1. Debugger controls (Pause, Step Over, Resume, Variable Watch) cluttered the authoring toolbar when designing.
2. The Node Palette was rigid and lacked a slim icon-rail collapse mode to maximize canvas workspace.
3. Blank workflows (pure START and END nodes) had no onboarding guidance or starter actions.
4. There was no 1-click Fullscreen toggle for distraction-free orchestration authoring.

## Plan
Implement all specifications agreed upon in `docs/integration_master_plan_iteration18.md`:
1. Segment the single command bar into 3 distinct floating Liquid Glass pill clusters (Left: Identity/Context, Center: Canvas Ergonomics, Right: Actions & CTAs).
2. Render a dedicated amber debugger sub-pill floating beneath the top bar in execution mode.
3. Provide a collapsible Node Palette with slim icon-rail mode (`w-14` / 48-56px).
4. Render a frosted starter prompt (`DagCanvasEmptyState`) on blank workflows with 1-click starter actions.
5. Provide a 1-click Fullscreen toggle with Escape key handling.
6. Verify via automated unit tests and TypeScript compilation.

## Changes
- **`apps/console/src/features/workflows/components/studio/dag-canvas-empty-state.tsx`**: Created non-intrusive centered Liquid Glass card with starter buttons ("Simple Task", "HTTP Request", "Open Node Palette", "Dismiss").
- **`apps/console/src/features/workflows/components/studio/dag-palette.tsx`**: Added `isCollapsed` state, toggle button (`dag-palette-collapse-toggle-btn`), slim icon rail (`dag-palette-rail`), and `Expand All` / `Collapse All` action.
- **`apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`**:
  - Segmented top bar into 3 floating clusters (`dag-toolbar-left-cluster`, `dag-toolbar-center-cluster`, `dag-toolbar-right-cluster`).
  - Added DropdownMenu for Workflow IR (Export IR, Import IR, Reset to Blank DAG, Reset Initial Nodes, Delete Selected).
  - Added amber debugger sub-pill (`dag-execution-debugger-subpill`) in execution mode.
  - Added Fullscreen toggle (`dag-fullscreen-btn`) and Escape key dismissal.
  - Wired `DagCanvasEmptyState` dynamically for blank workflows.
  - Added `className?: string` prop to `VisualDagStudioProps`.
- **`apps/console/src/features/workflows/components/studio/iteration18-studio.test.tsx`**: Authored comprehensive test suite covering all 5 core deliverables.
- **`apps/console/doc/walkthrough_144.md`**: Created walkthrough documentation.

## Verification
- `pnpm --filter @unipost/console test -- src/features/workflows/components/studio/`: 13 test files passed, 62/62 tests passing.
- `pnpm --filter @unipost/console exec tsc --noEmit`: Clean compilation, 0 TypeScript errors.
