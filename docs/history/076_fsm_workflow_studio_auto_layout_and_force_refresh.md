# History Log 076: FSM Workflow Studio Beautiful Auto Layout & Force Refresh Button

## Problem Statement
Users moving nodes manually or viewing complex multi-action FSM state graphs needed an automated way to re-align all state cards beautifully, choose between different layout topologies, and instantly force-refresh and re-center the canvas viewport.

## Plan
1. **Multi-Mode Auto Layout Engine**:
   - Implement `computeLayoutCoordinates(states, mode)` supporting three distinct visual patterns:
     - `stagger`: Alternating vertical heights ($y=110$ vs $210$) for optimal transition clearance.
     - `dag`: Clean horizontal pipeline ($y=160, x=80+i\times 260$) for sequential lifecycles.
     - `compact`: Responsive 2D grid matrix for complex state graphs.
2. **Force Refresh Button & Animated Viewport Camera**:
   - Add a floating top-right action bar inside the canvas featuring layout mode pills and a Liquid Glass `Auto Layout` button (`RotateCw` + `Sparkles`).
   - Wire `handleForceAutoLayout` to update coordinates and invoke `reactFlowInstance.fitView({ padding: 0.28, duration: 600 })`.
3. **Automated Testing & Verification**:
   - Add unit test in `visual-schema-studio.test.tsx` verifying layout buttons and click interactions.
   - Run Vitest suite across metadata feature.

## Changes Made
- [`fsm-workflow-designer.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/fsm-workflow-designer.tsx): Added `reactFlowInstanceRef`, `layoutMode` state, `computeLayoutCoordinates` layout engine, `handleForceAutoLayout` handler, and floating top-right Glass panel with mode selector and Auto Layout refresh button.
- [`visual-schema-studio.test.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/visual-schema-studio.test.tsx): Added test covering auto layout mode buttons and force refresh click.
- [`walkthrough_80.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/doc/walkthrough_80.md): Created walkthrough documentation.

## Verification
- `pnpm --filter @unipost/console test src/features/metadata`: 9 test files passed, 55/55 tests passed.
