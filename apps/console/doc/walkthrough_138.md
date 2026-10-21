# Walkthrough [138] - Blank Workflow Canvas, Edge Quick-Insert, and Full-Stack Control Flow Alignment

## Executive Summary
This walkthrough details the end-to-end execution of `docs/integration_master_plan_iteration16.md` (paired with `apps/console/doc/implementation_plan_138.md`). It achieves complete UI and backend alignment for workflow DAG authoring:
1. **Blank Workflow Default & Quick Split Insertion**:
   - New and blank workflows initialize strictly with pure `START` (`node-start`) and pure `END` (`node-end`) connected by a single direct edge `e_start_to_end` with zero intermediate nodes.
   - Edges render an interactive `+` quick-insert button that splits the edge and inserts a new node between source and target, complete with undo/redo snapshot tracking.
   - Dedicated "Blank" toolbar button to reset any canvas to pure `START` -> `END` boundaries.
2. **Full-Stack Control Flow Alignment (UI & Backend)**:
   - Palette updated with complete Control Flow nodes: `FORK_JOIN` (Parallel Split), `JOIN` (Parallel Barrier), `SWITCH`, `EXCLUSIVE_JOIN` (Switch Merge), `DO_WHILE` (Loop), and `TERMINATE` (Fail-Fast).
   - Validated pairing and convergence invariants: every `FORK_JOIN` must converge into a matching `JOIN` barrier before reaching `END`.
   - `DO_WHILE` tagged loopback edges (`isLoopbackEdge: true`) bypass Kahn DAG cycle detection, while enforcing downstream exit branch existence (`DO_WHILE_NO_EXIT`).
   - Bidirectional IR conversion synchronizes canvas incoming edges into `task.joinOn: string[]` on export and reconstructs graph edges from `joinOn`, `forkTasks`, and `decisionCases` on import.
   - Spring Boot `AcyclicityGuard` validates `FORK_JOIN` and `JOIN` pair completeness and single start/end topological invariants.

---

## Changes Implemented

### 1. Studio Palette & Component Ergonomics
- `apps/console/src/features/metadata/components/studio/dag-palette.tsx`:
  - Added `JOIN` (`Join (Parallel Barrier)`) and `EXCLUSIVE_JOIN` (`Exclusive Join (Switch Merge)`).
  - Clarified `FORK_JOIN` as `Fork (Parallel Split)` and `TERMINATE` as `Terminate (Fail-Fast)`.
- `apps/console/src/features/metadata/components/studio/dag-condition-edge.tsx`:
  - Added `onSplitEdge?: (edgeId: string) => void` to `DagConditionEdgeData`.
  - Rendered a Liquid Glass `+` quick-insert button in the center of edges that triggers edge splitting.
- `apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`:
  - Defined `BLANK_WORKFLOW_NODES` (`node-start` and `node-end` only) and `BLANK_WORKFLOW_EDGES` (`e_start_to_end`).
  - Added `handleSplitEdge` to interpolate position, create node, split edge into two, and record undo snapshot.
  - Added `Blank` reset button in the authoring toolbar.
  - Passed `onSplitEdge` to `decoratedEdges`.

### 2. Graph Invariants & Bidirectional IR Conversion
- `apps/console/src/features/metadata/components/studio/workflow-ir-converter.ts`:
  - Enhanced `validateGraphTopology`:
    - Loopback edges (`isLoopbackEdge: true`) are excluded from forward Kahn DAG cycle detection.
    - Verified `FORK_JOIN` branches converge into a `JOIN` barrier before reaching `END` (`FORK_WITHOUT_JOIN`).
    - Verified `DO_WHILE` nodes have downstream exit branch leading toward `END` (`DO_WHILE_NO_EXIT`).
  - Enhanced `exportToWorkflowIR`:
    - Computed incoming edges to populate `task.joinOn: string[]` for `JOIN` and `EXCLUSIVE_JOIN`.
    - Populated `task.forkTasks: string[][]` for `FORK_JOIN`.
  - Enhanced `importFromWorkflowIR`:
    - Reconstructed canvas edges from `joinOn`, `decisionCases`, and `defaultCase`.

### 3. Backend Verification & Invariants
- `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/graph/AcyclicityGuard.java`:
  - Enforced that workflows containing a `FORK_JOIN` task must contain a matching `JOIN` task barrier.
- `apps/backend/workflow-engine/src/test/java/com/unipost/workflow/core/graph/AcyclicityGuardTest.java`:
  - Added tests for `shouldRejectForkWithoutJoin` and `shouldAcceptValidForkJoinPair`.

---

## Verification Results

### Unit & Integration Tests
1. **Frontend Studio Vitest Suites**:
   - `dag-condition-edge.test.tsx`: 1/1 passed.
   - `workflow-ir-converter.test.ts`: 14/14 passed.
   - `dag-palette.test.tsx`: 2/2 passed.
   - `visual-dag-studio-modes.test.tsx`: 9/9 passed.
   - Total studio tests: **54/54 passing across 12 test suites**.
2. **TypeScript Compilation**:
   - `pnpm --filter @unipost/console exec tsc --noEmit`: 0 errors.
3. **Backend Maven Tests**:
   - `cmd.exe /c "mvnw.cmd test -pl workflow-engine -q"`: 100% green.
