# Integration Master Plan - Iteration 16: Pure Blank Workflow Canvas & Full Control Flow Node Architecture

## 1. Executive Summary
This iteration addresses canvas initialization for newly created workflows and the end-to-end architectural alignment of **Control Flow** nodes between the `@unipost/console` Visual DAG Studio and the `@unipost/backend` Workflow Engine, inspired by Netflix/Orkes Conductor OSS standards.

---

## 2. Aligned Decisions (from `/grill-me` Interactive Session)

1. **New Blank Workflow Canvas**:
   - Initialized strictly with **2 boundary nodes**: `START` (`workflow_start`, in-degree 0) and `END` (`workflow_end`, out-degree 0) connected directly by edge `e_start_to_end`.
   - **Zero intermediate nodes** by default.
   - Users can drag-and-drop nodes from the palette or click an interactive `+` split button on edges to insert intermediate nodes.

2. **Strict Fork-Join Pair (`FORK_JOIN` + `JOIN`)**:
   - Added `JOIN` as a first-class primitive in the Control Flow palette.
   - Invariant: Every `FORK_JOIN` must be paired with and converge into a matching `JOIN` node before continuing downstream.
   - Topology validator enforces that fork branches do not terminate or bypass their `JOIN`.

3. **Switch & Exclusive Join (`SWITCH` + `EXCLUSIVE_JOIN`)**:
   - Added `EXCLUSIVE_JOIN` to the Control Flow palette.
   - Evaluates to complete as soon as the single active branch completes (unlike `JOIN` which waits for all branches).

4. **Terminate Node Topology (`TERMINATE` -> `END`)**:
   - On the visual canvas, `TERMINATE` nodes connect downstream into `END`, preserving strictly 1 topological sink with out-degree 0.
   - In the backend runtime, reaching `TERMINATE` triggers an immediate fail-fast / early completion short-circuit.

5. **Do-While Loop Flat Modeling (`DO_WHILE`)**:
   - Modeled flat on the canvas with an iterative loopback edge (`isLoopbackEdge: true`) and a mandatory exit branch connecting downstream toward `END`.
   - Kahn cycle validation filters tagged loopback edges while verifying reachability to `END`.

---

## 3. Workstreams

### Workstream 1: Studio Canvas & Palette Refinement (`apps/console`)
- Add `JOIN` and `EXCLUSIVE_JOIN` to `PALETTE_ITEMS` in [`dag-palette.tsx`](file:///apps/console/src/features/metadata/components/studio/dag-palette.tsx).
- Add edge split `+` button in [`dag-condition-edge.tsx`](file:///apps/console/src/features/metadata/components/studio/dag-condition-edge.tsx).
- Initialize canvas with `BLANK_WORKFLOW_NODES` and `BLANK_WORKFLOW_EDGES` in [`visual-dag-studio.tsx`](file:///apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx).

### Workstream 2: Graph Invariants & IR Converter (`apps/console`)
- Update [`workflow-ir-converter.ts`](file:///apps/console/src/features/metadata/components/studio/workflow-ir-converter.ts):
  - Validate that `FORK_JOIN` strictly pairs with `JOIN`.
  - Validate that `SWITCH` cases converge into `EXCLUSIVE_JOIN` or `END`.
  - Validate that `DO_WHILE` has an exit branch leading to `END`.
  - Tag and filter `isLoopbackEdge` in Kahn cycle checks.

### Workstream 3: Full-Stack Contract Alignment (UI & Backend)
1. **Canvas Edges <-> `TaskDefinition.joinOn` Synchronization**:
   - `exportToWorkflowIR`: For any `JOIN` or `EXCLUSIVE_JOIN` node, compute its incoming edge source task references and assign to `task.joinOn: string[]`.
   - `importFromWorkflowIR`: Restore incoming edges from `joinOn` references.
2. **Synchronized Topology Validators (`AcyclicityGuard` <-> `workflow-ir-converter`)**:
   - Single start/end check parity.
   - `FORK_JOIN` -> `JOIN` pair completeness validation in backend.
   - Aligned error reporting codes.
3. **PureDecider Execution & Visual Studio Telemetry Alignment**:
   - Full alignment of task evaluation lifecycles (`ForkJoinStrategy`, `ExclusiveJoinStrategy`, `TerminateNodeStrategy`, `DoWhileStrategy`) with real-time SSE execution events and inspector telemetry.
4. **Simulation & Dry-Run Parity**:
   - Symmetrical simulation of Control Flow nodes between backend `WorkflowEngineService.simulateExecution` and designer `WorkflowDryRunModal`.

### Workstream 4: Comprehensive Test Verification
- Vitest unit tests in `dag-palette.test.tsx`, `workflow-ir-converter.test.ts`, `visual-dag-studio-modes.test.tsx`.
- Backend JUnit tests in `AcyclicityGuardTest.java` and `PureDeciderTest.java`.
- Typecheck (`tsc --noEmit`).
