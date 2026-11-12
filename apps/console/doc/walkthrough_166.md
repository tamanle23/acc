# Walkthrough 166 - 24 Workflow Node Types Formalization, Multi-Port Studio Topology, and Closed-Loop Cycle Elimination

## Architectural Root Cause & Decision
In previous iterations, the workflow orchestration subsystem treated node connectors and port topology uniformly: every task displayed standard single input and single output handles, while control flow (branching, loops, compensation) was inferred implicitly or stubbed in modal settings.

To elevate both the visual DAG studio and the execution engine to enterprise-grade rigor:
1. **24 Concrete Node Types**: Formalized all 24 node types across `@acc/api`, `@acc/console`, and `packages/sandbox`, introducing canonical `END_WORKFLOW` to symmetrically pair with `START_WORKFLOW`.
2. **Mathematical Back-Edge Elimination for DAG Cycles**: A cycle created by returning to a loop entry node (`DO_WHILE`) violates Kahn's topological sort unless cleanly partitioned. We define $E = E_{\text{forward}} \cup E_{\text{back}}$, where $E_{\text{back}} = \{ (u, v) \in E \mid v.\text{type} = \text{DO\_WHILE} \land \text{targetPort} = \text{'loop-back'} \}$. Topological sorting runs over the forward DAG $G_{\text{DAG}} = (V, E_{\text{forward}})$, while loop-body reachability and origin verification are enforced independently.
3. **Dedicated Multi-Port Pin Layouts**:
   - `DO_WHILE`: 4 distinct ports (Left: input entry, Top: loop-back entry, Right-Top: loop-body exit, Right-Bottom: loop-exit).
   - `SWITCH`: Dynamic case pins (`case-${key}`) on the right boundary plus a fallback (`case-default`).
   - `HUMAN`: Dual decision pins on the right boundary (`approved` on top, `rejected` on bottom).
   - Standard tasks: Bottom compensation pin (`compensate`).
   - Boundary nodes: `START_WORKFLOW` has only an output pin; `END_WORKFLOW` has only an input pin.
4. **Lossless Bi-directional IR Conversion**: `workflow-ir-converter.ts` converts between ReactFlow nodes/edges and execution engine `WorkflowDefinition` without losing pin metadata, while automatically synthesizing legacy workflow structures into canonical multi-port representations.
5. **Interactive Canvas Ergonomics**: Dropping a `DO_WHILE` node automatically provisions a closed loop template (`DO_WHILE -> bodyTask -> DO_WHILE.loop-back`), eliminating orphan loop errors.

---

## Changes Implemented

### 1. Backend Engine & Strategy Formalization
- **`TaskType.java`**:
  - Added `END_WORKFLOW` enum value with category `SYSTEM`.
- **`WorkflowDefinition.java`**:
  - Updated `WorkflowDefinition.createBlank(...)` to instantiate `START_WORKFLOW` (entry) and `END_WORKFLOW` (exit).
- **`EndWorkflowStrategy.java`**:
  - Implemented fan-in barrier strategy ensuring all prerequisite non-compensation tasks have completed before concluding the workflow execution with the combined state payload.
- **`StartWorkflowStrategy.java`**:
  - Updated to act as a pass-through entry node when no child `workflowKey` is specified, completing immediately and propagating the initial input payload.
- **`NodeStrategyRegistry.java`**:
  - Registered `EndWorkflowStrategy` under `TaskType.END_WORKFLOW`.
- **`AcyclicityGuard.java`**:
  - Partitioned graph edges into $E_{\text{forward}}$ and $E_{\text{back}}$.
  - Validated that `loop-back` edges strictly originate from descendants within that loop's body.
  - Excluded back-edge source nodes and compensation targets from terminal `endNodes` calculations.
  - Enforced single-entry (`START_WORKFLOW`) and single-exit (`END_WORKFLOW`) graph invariants.

### 2. Visual DAG Studio Multi-Port Architecture
- **`dag-node.tsx`**:
  - Added `END_WORKFLOW` to `DagNodeType`.
  - Implemented 4-port topology for `DO_WHILE`:
    - `target-left`: Primary inlet handle.
    - `loop-back`: Top loop return handle.
    - `loop-body`: Upper right outlet handle.
    - `loop-exit`: Lower right outlet handle.
  - Implemented dual handles for `HUMAN` (`approved` at top-right, `rejected` at bottom-right).
  - Implemented dynamic case handles for `SWITCH` based on configured `decisionCases`, plus fallback `case-default`.
  - Added bottom compensation handle (`compensate`) to standard tasks.
  - Preserved backward-compatible test IDs (`dag-handle-target-*`, `dag-handle-source-*`).

### 3. Interactive Connection Validation & Templates
- **`use-dag-studio-state.ts`**:
  - Updated `isValidConnection` to:
    - Reject inbound edges to `START_WORKFLOW`.
    - Reject outbound edges from `END_WORKFLOW` and `TERMINATE`.
    - Reject self-loops (`source === target`).
    - Enforce that `loop-back` ports only accept edges originating from descendants of that loop's body.
    - Limit `loop-back` port in-degree to at most 1.
  - Updated `onDrop` to auto-provision a connected `DO_WHILE` loop template upon dropping a loop node on the canvas.
  - Guarded `handleBulkDelete` to prohibit deleting permanent boundary nodes.

### 4. Lossless IR Converter & Schema Parity
- **`workflow-ir-converter.ts`**:
  - In `validateGraphTopology`:
    - Filtered out `loop-back` edges before topological Kahn sort.
    - Excluded compensation targets and loopback sources from primary terminal node counts.
    - Enforced canonical start and end boundary nodes.
  - In `exportToWorkflowIR`:
    - Extracted branch routes from `case-*` source handles into `decisionCases` and `defaultCase`.
    - Extracted loop body from `loop-body` handle into `loopOver`.
    - Extracted compensation route from `compensate` handle into `compensateHandlerRef`.
    - Preserved complete edge topology losslessly in `layoutMetadata.__edges`.
  - In `importFromWorkflowIR`:
    - Restored full port handles from saved `__edges`.
    - Reconstructed multi-port edge structures from raw definitions for backward compatibility.

### 5. Unified Sandbox Offline Parity
- **`packages/sandbox/src/handlers/workflow-handler.ts`**:
  - Synchronized `saveDefinition` to initialize canonical `START_WORKFLOW` and `END_WORKFLOW` nodes for empty workflows.

---

## Verification
- **Console Unit & Component Tests**:
  - `pnpm --filter @acc/console test "src/features/workflows"`: 24 test files passed, 118 tests passed.
  - Verified `dag-node.test.tsx` (11/11 passed) covering all multi-port layouts.
  - Verified `workflow-ir-converter.test.ts` (17/17 passed) covering roundtrip lossless conversion and loop validation.
- **Console TypeScript Strict Typing**:
  - `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
- **Unified Sandbox Tests**:
  - `pnpm --filter @acc/sandbox test`: 11 test files passed, 103 tests passed.
- **Backend Tests**:
  - `pnpm --filter @acc/api exec node mvnw.cjs -am -pl acc-ms-aio test "-Dtest=WorkflowEngineRestApiTest,AcyclicityGuardTest,PureDeciderTest"`: All unit and sliced integration tests passed (`BUILD SUCCESS`).
