# 071: Refactor FSM Workflow Studio to React Flow Architecture

**Date**: 2026-10-14  
**Author**: Lead Systems Architect  
**Category**: refactor(console)  
**Scope**: `@unipost/console`  

---

## 1. Problem Statement
The FSM Workflow Studio previously relied on a custom hardcoded SVG canvas with static layout math (`(pos.x / width) * 100%`) and basic quadratic bezier curves.
Issues identified:
1. **Misalignment & Overlapping**: State nodes and bezier edges frequently collided, misaligned, or clipped when window dimensions changed.
2. **Lack of Interactivity**: Operators could not drag, rearrange, pan, or zoom into complex multi-state graphs.
3. **Disconnected Data**: The workflow canvas did not ingest the real active `entityType.lifecycleConfig` from the selected model.

---

## 2. Plan
1. **Adopt React Flow (`@xyflow/react`)**:
   - Install `@xyflow/react` in `@unipost/console`.
   - Import `@xyflow/react/dist/style.css` in `apps/console/src/styles/index.css`.
2. **Custom FSM Node & Edge Components**:
   - Create `FsmStateNodeComponent`: Liquid Glass state cards with status accents, left/right connection handles (`<Handle type="target" />`, `<Handle type="source" />`), and initial/terminal state indicators.
   - Create `FsmTransitionEdgeComponent`: Smooth bezier transitions with custom `<EdgeLabelRenderer>` trigger event pill and SpEL guard pulse badge.
3. **Interactive FSM Canvas with Controls**:
   - Integrate `ReactFlow` with `Background`, `Controls`, `MiniMap`, and smooth interactive panning/zooming.
   - Wire `entityType.lifecycleConfig` directly into `VisualSchemaStudio` &rarr; `FsmWorkflowDesigner`.
   - Provide quick transition selector pills in the inspector to easily review guard expressions and transactional outbox actions.
4. **Verification**:
   - Update Vitest setup with `ResizeObserver` polyfill for jsdom.
   - Run Vitest suite across `@unipost/console`.

---

## 3. Changes Made
- [`package.json`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/package.json): Added `@xyflow/react`.
- [`apps/console/src/styles/index.css`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/styles/index.css): Imported `@xyflow/react/dist/style.css`.
- [`apps/console/src/features/metadata/components/studio/fsm-state-node.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/fsm-state-node.tsx): Custom React Flow node for FSM states with handles and Liquid Glass styling.
- [`apps/console/src/features/metadata/components/studio/fsm-transition-edge.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/fsm-transition-edge.tsx): Custom React Flow edge for FSM transitions.
- [`apps/console/src/features/metadata/components/studio/fsm-workflow-designer.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/fsm-workflow-designer.tsx): Replaced custom SVG renderer with `ReactFlow`, `MiniMap`, `Controls`, and interactive transition inspection.
- [`apps/console/src/features/metadata/components/studio/visual-schema-studio.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/visual-schema-studio.tsx): Connected model's real `lifecycleConfig` to `FsmWorkflowDesigner`.
- [`apps/console/src/test/setup.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/test/setup.ts): Added `ResizeObserver` polyfill for jsdom testing.

---

## 4. Verification
- Ran `pnpm --filter @unipost/console test src/features/metadata`:
  - 9 test files passed, 54 tests passed with 0 errors.

---

## 5. Walkthrough
1. Navigate to **Metadata** &rarr; select any model &rarr; **Schema** tab &rarr; click **Visual Studio**.
2. Switch to **FSM Workflow Studio**:
   - Nodes render cleanly in an interactive React Flow canvas with smooth bezier connections.
   - Operators can drag nodes, zoom in/out, pan the canvas, and use the MiniMap.
   - Clicking any transition edge or event badge selects and displays the transition rules, SpEL guard expressions, and transactional outbox actions in the inspector.
