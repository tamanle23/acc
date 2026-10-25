# History Log 075: Dynamic Lifecycle-Driven Connector Ports & Smooth Transitions for FSM Studio

## Problem Statement
The FSM workflow studio previously relied on fixed connector handle counts per node (either 2 or 6), which caused multiple transition actions between or from the same state to overlap at single coordinate points. In addition, transitions between states with multiple possible actions suffered from overlapping action badges and abrupt bezier curves.

## Plan
1. **Dynamic Handle Allocation**:
   - Inspect the entity model's `lifecycleConfig` (all incoming and outgoing transitions) per state.
   - Dynamically generate dedicated source and target handles (`DynamicHandleConfig`) with evenly spaced percentage offsets along card perimeters (`offsetPct`).
   - Route forward transitions via Right/Left, rollbacks/rejections via Bottom/Bottom, and self-loops via Top/Top.
2. **Smooth Bezier Curvature**:
   - Implement Euclidean distance-scaled bezier curvature calculations in `FsmTransitionEdgeComponent`.
   - Prevent badge collision with staggered 2D coordinate offsets (`labelXOffset`, `labelYOffset`).
   - Add semantic Lucide action icons, multi-action stack counters (`1/2`), and high-contrast Liquid Glass pill styling.
3. **Verification**:
   - Run Vitest suite across `apps/console/src/features/metadata` to verify all 54 tests pass.

## Changes Made
- [`fsm-state-node.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/studio/fsm-state-node.tsx): Replaced static handle arrays with dynamic mapping of `incomingHandles` and `outgoingHandles` using per-transition handle IDs and percentage perimeter positioning.
- [`fsm-transition-edge.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/studio/fsm-transition-edge.tsx): Enhanced curvature calculation based on node Euclidean distance; added staggered badge positioning, Lucide icons, and stack counters.
- [`fsm-workflow-designer.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/studio/fsm-workflow-designer.tsx): Updated `initialNodes` to derive dynamic ports from transition counts per perimeter direction, and `initialEdges` to bind `sourceHandle` / `targetHandle` to dedicated transition IDs.
- [`walkthrough_79.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/walkthrough_79.md): Created walkthrough documentation.

## Verification
- `pnpm --filter @acc/console test src/features/metadata`: 9 test files passed, 54/54 tests passed.
