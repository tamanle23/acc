# Implementation Plan [139] - Visual DAG Studio Ergonomics, Quick-Insert Popover & Edge Routing (Iteration 17)

## Problem Statement
While Visual DAG Studio provides full authoring, time-travel debugging, and strict topology invariants, authoring complex workflows currently suffers from several friction points:
1. Clicking the edge `+` button directly inserts a default `SIMPLE` task; authors must then manually reconfigure the task type in the inspector rather than selecting the desired task type immediately.
2. Long or parallel DAGs with many branches can look tangled with purely curved Bezier edges, needing an Orthogonal / Smoothstep routing alternative.
3. Multi-node editing lacks bulk alignment and distribution tools (e.g., aligning parallel branch tasks vertically or distributing nodes evenly).
4. Manual dragging of nodes lacks grid snapping alignment, leading to messy visual arrangements.

## User Review & Decisions Resolved
- **Quick-Insert UX**: Floating popover anchored at the edge `+` click position with instant search, category tabs, and arrow-key selection.
- **Edge Routing**: Global toolbar toggle switching all canvas edges between Smooth Bezier and Orthogonal Smoothstep.
- **Bulk Alignment**: Floating mini-toolbar when 2+ nodes are selected with Align Left, Align Center, Align Top, Align Middle, Distribute Horizontal, and Duplicate (`Cmd+D`).
- **Snap-to-Grid**: 16px magnetic snap with toolbar toggle button (`Snap: On/Off`).

## Proposed Changes

### Component 1: Quick-Insert Popover
#### [NEW] `apps/console/src/features/metadata/components/studio/dag-quick-insert-popover.tsx`
- Search input with auto-focus.
- Category tabs (All, Control Flow, Data, Connectors, Human, AI).
- Keyboard navigation (arrows + Enter to select, Escape to close).
- Clamped positioning around anchor `{ x, y }`.

### Component 2: Multi-Node Selection & Alignment Toolbar
#### [NEW] `apps/console/src/features/metadata/components/studio/dag-selection-toolbar.tsx`
- Floating Liquid Glass mini-toolbar.
- Align Left, Align Center (X), Align Top, Align Middle (Y).
- Distribute Horizontal, Distribute Vertical.
- Duplicate (`Cmd+D`), Bulk Delete.

### Component 3: Dynamic Edge Routing & Quick Split
#### [MODIFY] `apps/console/src/features/metadata/components/studio/dag-condition-edge.tsx`
- Support `routingMode: 'bezier' | 'smoothstep'`.
- Call `getSmoothStepPath` when `smoothstep` is active, else `getBezierPath`.
- Emit `{ x: e.clientX, y: e.clientY }` on `onSplitEdge(id, pos)`.

### Component 4: Studio Canvas & Toolbar Integration
#### [MODIFY] `apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`
- Add `edgeRoutingMode` state (`'bezier' | 'smoothstep'`).
- Add `isSnapToGrid` state (`true | false`) and wire to `<ReactFlow snapToGrid={isSnapToGrid} snapGrid={[16, 16]}>`.
- Add toolbar toggles for Edge Routing and Snap-to-Grid.
- Manage `edgeSplitTarget: { edgeId: string; position: { x: number; y: number } } | null` to open Quick-Insert Popover.
- Track selected nodes and render `<DagSelectionToolbar>` when 2+ nodes are selected.
- Wire duplicate (`Cmd+D`) keyboard shortcut.

## Verification Plan
### Automated Tests
- `pnpm --filter @acc/console test -- src/features/metadata/components/studio/dag-quick-insert-popover.test.tsx`
- `pnpm --filter @acc/console test -- src/features/metadata/components/studio/dag-selection-toolbar.test.tsx`
- `pnpm --filter @acc/console test -- src/features/metadata/components/studio/dag-condition-edge.test.tsx`
- `pnpm --filter @acc/console test -- src/features/metadata/components/studio/visual-dag-studio-modes.test.tsx`
- `pnpm --filter @acc/console exec tsc --noEmit`
