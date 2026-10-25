# 175 - Visual DAG Studio Ergonomics, Quick-Insert Popover & Dynamic Edge Routing

## Problem
In complex workflow authoring, dragging every node from the left palette onto the canvas and manually re-wiring edges creates high friction. Additionally, edges were fixed to Bezier curves without an option for orthogonal routing, node alignment had to be adjusted manually one-by-one without distribution tools, and nodes did not snap magnetically to grid intervals.

## Plan
Implement modern authoring ergonomics into `@acc/console`'s `VisualDagStudio`:
1. **Edge Quick-Insert Floating Popover (`DagQuickInsertPopover`)**:
   - Opens at the screen coordinates of the edge `+` split button.
   - Offers real-time search across all 23 task types, 5 category tabs, and arrow-key selection.
2. **Dynamic Edge Routing**:
   - Studio toolbar toggle between Bezier curves and orthogonal smoothstep lines.
   - Updates `DagConditionEdge` rendering dynamically without affecting graph topology or execution data.
3. **Multi-Node Selection & Alignment Toolbar (`DagSelectionToolbar`)**:
   - Appears when 2+ nodes are selected.
   - 1-click Align Left, Center X, Top, Middle Y, and Distribute Horizontally/Vertically (for 3+ nodes).
   - Duplicate (`Cmd+D`) and bulk delete with undo snapshot preservation.
4. **Snap-to-Grid Ergonomics**:
   - 16px magnetic snap toggleable in the top toolbar.

## Changes
- `apps/console/src/features/metadata/components/studio/dag-quick-insert-popover.tsx`: Created quick-insert floating popover with category tabs, search, and keyboard navigation.
- `apps/console/src/features/metadata/components/studio/dag-quick-insert-popover.test.tsx`: 5/5 unit tests.
- `apps/console/src/features/metadata/components/studio/dag-selection-toolbar.tsx`: Created floating selection toolbar with alignment, distribution, duplication, and bulk deletion.
- `apps/console/src/features/metadata/components/studio/dag-selection-toolbar.test.tsx`: 3/3 unit tests.
- `apps/console/src/features/metadata/components/studio/dag-condition-edge.tsx`: Supported `routingMode` (`bezier` / `smoothstep`) and emitted click screen coordinates.
- `apps/console/src/features/metadata/components/studio/dag-condition-edge.test.tsx`: Updated tests for routing and screen coordinates.
- `apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`: Wired snap-to-grid, routing toggle, quick-insert popover, multi-node alignment handlers, and shortcuts.
- `apps/console/src/features/metadata/components/studio/iteration17-studio.test.tsx`: Created studio unit tests for toolbar toggles and selection toolbar mounting.

## Verification
- **Unit Tests**: Ran `pnpm --filter @acc/console test -- src/features/metadata/components/studio/` - 15 test files passed, 67 tests green.
- **Typecheck**: Ran `pnpm --filter @acc/console exec tsc --noEmit` - 0 errors.

## Walkthrough & Artifacts
- `apps/console/doc/walkthrough_139.md`
- `apps/console/doc/implementation_plan_139.md`
- `docs/integration_master_plan_iteration17.md`
