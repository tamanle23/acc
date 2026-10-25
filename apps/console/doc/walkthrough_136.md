# Walkthrough: Iteration 15 - DAG Graph Topology Invariants, Canvas Authoring & Existing Visual Debugger Alignment

## Overview
Iteration 15 implements strict workflow DAG graph topology invariants (conventional single start and single end node), canvas boundary permanence protection and badges, an interactive Visual Edge Condition Editor, and aligns the existing Visual DAG Studio Debugger with the backend execution state machine.

---

## Changes Implemented

### 1. Single-Start & Single-End Graph Topology Invariant
- **Backend (`AcyclicityGuard.java`, `WorkflowTopologyException.java`)**:
  - In addition to Kahn's cycle detection and Tarjan SCC cycle tracing, `AcyclicityGuard` validates that for multi-task definitions ($|V| > 1$):
    - Exactly 1 task has `inDegree == 0` (Start node). If $>1$, throws `WorkflowTopologyException("Workflow definition must have exactly one start node, found: ...")`.
    - Exactly 1 task has `outDegree == 0` (End node). If $>1$, throws `WorkflowTopologyException("Workflow definition must have exactly one end node, found: ...")`.
  - Added unit test cases in `AcyclicityGuardTest.java` verifying detection and rejection of multi-start, multi-end graphs and accepting single-node and converged diamond graphs.
- **Frontend (`workflow-ir-converter.ts`)**:
  - Extended `validateGraphTopology` to calculate in-degree and out-degree maps.
  - Generates `MULTIPLE_START_NODES`, `MULTIPLE_END_NODES`, `NO_START_NODE`, `NO_END_NODE`, and `DISCONNECTED_GRAPH` errors with actionable diagnostics.
  - Added 4 unit test cases in `workflow-ir-converter.test.ts` covering multi-start, multi-end, disconnected reachability, and converged diamond DAG topologies.

### 2. Canvas Boundary Protection & Badges
- **Node Component (`dag-node.tsx`)**:
  - Added `isPermanent`, `isStartNode`, `isEndNode` flags to `DagNodeData`.
  - Renders an emerald `START` badge on nodes with `isStartNode: true`.
  - Renders a purple `END` badge on nodes with `isEndNode: true`.
- **Canvas Protection (`visual-dag-studio.tsx`, `dag-property-inspector.tsx`)**:
  - Seeded initial canvas with `node-inventory` as permanent `START` and `node-complete` as permanent `END` (`isPermanent: true`).
  - Updated `handleClearSelected` to prevent deleting permanent nodes.
  - Hard-blocked the "Save DAG" button when topology validation errors exist.
  - Added "Protected Boundary Node" badge in `DagPropertyInspector` header.

### 3. Visual Edge Condition Editor
- **Custom Edge (`dag-condition-edge.tsx`)**:
  - Implemented `DagConditionEdge` using ReactFlow `BaseEdge` + `EdgeLabelRenderer`.
  - Renders a Liquid Glass frosted pill badge on edges displaying the branch condition or switch case (e.g. `EXPRESS`, `STANDARD`, `${condition}`).
  - Clicking the edge label opens the condition configuration dialog.
- **Condition Modal (`dag-edge-condition-modal.tsx`)**:
  - Interactive dialog for configuring Connector Label, Transition Evaluation Expression, and `SWITCH` Decision Case Key / Default Fallback Route.
  - Automatically synchronizes updates into edge labels and connected `SWITCH` node's `decisionCases` and `defaultCase`.
  - Unit tests added in `dag-edge-condition-modal.test.tsx`.

### 4. Existing Visual DAG Studio Debugger Alignment
- **Variable Watch Drawer (`workflow-variable-watch-drawer.tsx`)**:
  - Replaced temporary floating panel with a dedicated right-hand slide-out drawer.
  - Displays frontier paused node, execution status, live variable accumulator, task outputs tree via `VisualJsonEditor`, and active breakpoint management with remove triggers.
  - Directly wired to Step Over, Pause, and Resume mutations.
  - Unit tests added in `workflow-variable-watch-drawer.test.tsx`.

---

## Verification Results

### Automated Tests
1. **Frontend Studio Vitest Suite**:
   ```bash
   pnpm --filter @acc/console exec vitest run src/features/metadata/components/studio/
   ```
   **Result:** 11 test files passed, 47 tests passed (100% green).
2. **Frontend Typecheck**:
   ```bash
   pnpm --filter @acc/console exec tsc --noEmit
   ```
   **Result:** Clean exit code `0`.
3. **Backend Maven Tests**:
   ```bash
   node mvnw.cjs test -pl "workflow-engine,acc-ms-aio" '-Dtest=AcyclicityGuardTest,WorkflowIteration13ControllersTest,TopologicalCompatibilityValidatorTest' -q
   ```
   **Result:** Clean exit code `0`.
