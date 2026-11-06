# Walkthrough 165 - Fix Blank Workflow Missing End Node and Start Node Connector

## Problem
When creating a new blank workflow or initializing the Visual DAG Studio for a fresh workflow definition:
1. The canvas only contained a single `startTask` node with NO terminal `workflow_end` node.
2. The `startTask` node had no outgoing connector (source handle) on its right boundary, preventing users from dragging connection edges to downstream tasks.
3. The root causes were threefold:
   - `WorkflowCreateDialog`: Initialized definitions with only a single task (`startTask`) and no end node.
   - `visual-dag-studio.tsx`: The `decoratedNodes` memo derived `isStartNode` and `isEndNode` purely via graph in/out degree (`degIn === 0`, `degOut === 0`). For an isolated start node with 0 outgoing edges, `degOut === 0` caused `isEndNode` to be set to `true`, which triggered `{!data.isEndNode && <Handle type="source" />}` to hide the right handle.
   - `workflow-ir-converter.ts`: Empty task arrays or single-start legacy definitions were not supplemented with a paired terminal end node or sequential linking edge.

## Solution Implemented
1. **Paired Start & End Initialization in `WorkflowCreateDialog`**:
   - `WorkflowCreateDialog.handleCreate()` now creates `initialIr` with paired NOOP boundary tasks (`workflow_start` and `workflow_end`) and coordinates in `layoutMetadata`.
2. **Mutual Exclusion & Guard in `visual-dag-studio.tsx` (`decoratedNodes`)**:
   - Explicit start nodes (`workflow_start`, `startTask`, `node-start`, or `data.isStartNode`) are recognized as start nodes and strictly set `isEnd = false`.
   - Explicit end nodes (`workflow_end`, `node-end`, or `data.isEndNode`) are recognized as end nodes and strictly set `isStart = false`.
   - Prevents degree calculation from marking a start node as an end node, ensuring the right-side source connector handle is always rendered.
3. **Resilient Blank IR and Single-Task Healing in `importFromWorkflowIR`**:
   - If `ir.tasks.length === 0`, gracefully returns `BLANK_WORKFLOW_NODES` and `BLANK_WORKFLOW_EDGES`.
   - If `ir.tasks.length === 1` with a solitary start task, automatically supplements with `workflow_end` and links them via fallback sequential edge synthesis.
4. **Automated Unit Tests**:
   - Added unit tests in `workflow-ir-converter.test.ts` verifying empty IR and legacy single-start definitions roundtrip to 2 nodes with 1 edge.

## Verification
- Ran `@acc/console` vitest suite across all 24 workflow test files (112 tests passing).
- Ran `tsc --noEmit` on `@acc/console` (0 errors).
