# 172. Enforce Single-Start/End DAG Topology Invariants, Edge Condition Builder, and Debugger Alignment

## Problem
In workflow definition and DAG visualization:
1. **Unbounded Multi-Start & Multi-End Topologies**: Previous graph models permitted multiple unconnected start nodes and multiple dangling terminal nodes without structural discipline, leading to ambiguity in workflow dispatch lifecycles, race conditions, and uncontrolled completion semantics.
2. **Accidental Boundary Deletion**: Canvas deletion actions permitted users to delete terminal boundary nodes, stranding execution paths.
3. **Implicit Edge Transitions**: Edge transition conditions and `SWITCH` decision branches were buried inside node properties rather than being visually inspected and configured directly on connecting graph edges.
4. **Debugger Disconnect**: The Visual DAG Studio debugger lacked an integrated, slide-out variable watch inspection surface directly connected to the backend execution variable accumulator and task outputs.

## Plan
1. **Backend Graph Topology Invariant**:
   - Update `AcyclicityGuard` to calculate in-degree and out-degree across all workflow tasks.
   - For multi-task workflows, enforce Kahn cycle detection first, followed by strict validation that exactly one node has in-degree 0 (Start node) and exactly one node has out-degree 0 (End node).
   - Throw a dedicated `WorkflowTopologyException` (HTTP 400 Problem Detail) when multiple start/end nodes or disconnected graphs are submitted.
2. **Frontend Canvas & IR Converter Invariants**:
   - Extend `workflow-ir-converter.ts` with explicit graph topology validation (`MULTIPLE_START_NODES`, `MULTIPLE_END_NODES`, `NO_START_NODE`, `NO_END_NODE`, `DISCONNECTED_GRAPH`).
   - Disable the "Save DAG" action and display descriptive validation alert banners when any topology invariant is violated.
   - Enforce permanent boundary node protection (`isPermanent: true`) with emerald `START` and purple `END` badges in `DagNode`, preventing accidental deletion.
3. **Visual Edge Condition Builder**:
   - Create custom ReactFlow edge `DagConditionEdge` rendering interactive Liquid Glass condition badges on edge paths.
   - Implement `DagEdgeConditionModal` to configure edge transition labels, expressions, and switch case mappings.
4. **Interactive Variable Watch Drawer**:
   - Build `WorkflowVariableWatchDrawer` featuring live variable accumulator tables, task output inspection via `VisualJsonEditor`, active breakpoint management, and real-time step-over/pause/resume debugger controls.

## Changes

### apps/backend/workflow-engine
- [`WorkflowTopologyException.java`](file:///apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/graph/WorkflowTopologyException.java): Custom runtime exception for DAG graph topology invariant violations.
- [`AcyclicityGuard.java`](file:///apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/graph/AcyclicityGuard.java):
  - Added in-degree and out-degree validation post-Kahn topological sorting.
  - Enforces exactly one source node (in-degree 0) and one sink node (out-degree 0) for workflows with more than 1 task.
- [`AcyclicityGuardTest.java`](file:///apps/backend/workflow-engine/src/test/java/com/unipost/workflow/core/graph/AcyclicityGuardTest.java): Added unit tests for multiple start nodes, multiple end nodes, cycle priority, and single-node valid graphs.
- [`WorkflowEngineService.java`](file:///apps/backend/workflow-engine/src/main/java/com/unipost/workflow/application/WorkflowEngineService.java): Imported `TaskType` for designer simulation harness.

### apps/console
- [`workflow-ir-converter.ts`](file:///apps/console/src/features/metadata/components/studio/workflow-ir-converter.ts):
  - Extended `GraphValidationError` with `MULTIPLE_START_NODES`, `MULTIPLE_END_NODES`, `NO_START_NODE`, `NO_END_NODE`, `DISCONNECTED_GRAPH`.
  - Added BFS reachability check to guarantee all nodes are connected in a single path from Start to End.
- [`workflow-ir-converter.test.ts`](file:///apps/console/src/features/metadata/components/studio/workflow-ir-converter.test.ts): Added test coverage for invalid start/end topologies, disconnected graphs, and diamond topologies.
- [`dag-node.tsx`](file:///apps/console/src/features/metadata/components/studio/dag-node.tsx):
  - Rendered emerald `START` and purple `END` boundary badges.
  - Protected nodes marked `isPermanent`.
- [`dag-node.test.tsx`](file:///apps/console/src/features/metadata/components/studio/dag-node.test.tsx): Added unit tests for boundary badges and permanent node indicators.
- [`dag-condition-edge.tsx`](file:///apps/console/src/features/metadata/components/studio/dag-condition-edge.tsx): Created custom edge component rendering interactive Liquid Glass condition badge pills.
- [`dag-edge-condition-modal.tsx`](file:///apps/console/src/features/metadata/components/studio/dag-edge-condition-modal.tsx): Created modal to edit edge condition labels, transition expressions, and switch case mappings.
- [`dag-edge-condition-modal.test.tsx`](file:///apps/console/src/features/metadata/components/studio/dag-edge-condition-modal.test.tsx): Unit tests for edge condition editing.
- [`workflow-variable-watch-drawer.tsx`](file:///apps/console/src/features/metadata/components/studio/workflow-variable-watch-drawer.tsx): Created slide-out drawer with variable accumulator, `VisualJsonEditor` for outputs, and step-over/pause/resume controls.
- [`workflow-variable-watch-drawer.test.tsx`](file:///apps/console/src/features/metadata/components/studio/workflow-variable-watch-drawer.test.tsx): Unit tests for variable watch drawer.
- [`visual-dag-studio.tsx`](file:///apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx):
  - Wired permanent Start and End nodes into default initial canvas.
  - Registered `DagConditionEdge` in `edgeTypes`.
  - Prevented deletion of permanent nodes in `handleClearSelected`.
  - Wired `WorkflowVariableWatchDrawer` to the watch button in debug toolbar.
  - Disabled Save DAG action when `validationErrors.length > 0`.
- [`dag-property-inspector.tsx`](file:///apps/console/src/features/metadata/components/studio/dag-property-inspector.tsx): Added "Protected Boundary Node" badge indicator in the header.

## Verification
- **Frontend Unit Tests**: 11 test suites passing (47 tests total):
  - `dag-node.test.tsx`: 4 passed
  - `dag-edge-condition-modal.test.tsx`: 4 passed
  - `workflow-variable-watch-drawer.test.tsx`: 4 passed
  - `workflow-ir-converter.test.ts`: 7 passed
  - `workflow-studio-debugger.test.ts`: 5 passed
  - `visual-json-editor.test.tsx`: 7 passed
  - Other workflow studio suites: 16 passed
- **Frontend Typecheck**: `pnpm --filter @unipost/console exec tsc --noEmit` exited `0` with 0 errors.
- **Backend Unit Tests**: `mvn test -Dtest=AcyclicityGuardTest,WorkflowIteration13ControllersTest,TopologicalCompatibilityValidatorTest -q` passed 100%.

## Walkthrough
Detailed walkthrough documentation available at:
[`apps/console/doc/walkthrough_136.md`](file:///apps/console/doc/walkthrough_136.md)

## Tasks
- [x] Create `WorkflowTopologyException` in backend workflow engine.
- [x] Implement in-degree/out-degree enforcement in `AcyclicityGuard` and add test suite.
- [x] Extend `workflow-ir-converter.ts` with single-start/end and reachability checks.
- [x] Add boundary badges and permanent node protections to `DagNode` and `VisualDagStudio`.
- [x] Build `DagConditionEdge` and `DagEdgeConditionModal`.
- [x] Build `WorkflowVariableWatchDrawer` and wire to debugger toolbar.
- [x] Verify all unit tests, typechecks, and backend tests.

## Enhancement
Future iterations may introduce automatic auto-completion for variable paths (e.g. `${workflow.input.userId}`) directly inside `DagEdgeConditionModal` condition expression inputs.
