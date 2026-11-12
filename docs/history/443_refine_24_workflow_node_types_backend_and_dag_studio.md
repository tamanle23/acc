# 443 - Refine 24 Workflow Node Types Across Backend Engine and Visual DAG Studio

## Problem
In earlier iterations of the workflow orchestration engine:
1. **Uniform Port Topology**: Nodes in the Visual DAG Studio rendered generic single input (`target`) and single output (`source`) connector handles. Specialized control-flow nodes such as `DO_WHILE`, `SWITCH`, and `HUMAN` lacked dedicated semantic pin layouts, requiring error-prone manual configuration.
2. **Topological Cycle Rejection on Loops**: Standard Kahn's topological sort in `AcyclicityGuard.java` and `workflow-ir-converter.ts` rejected valid `DO_WHILE` loopback edges as cyclical dependency violations, preventing authoring and execution of iterative workflows.
3. **Missing Canonical Exit Boundary**: While workflows initialized with a `START_WORKFLOW` node, they lacked a formal symmetric terminal boundary node (`END_WORKFLOW`), causing ambiguity around fan-in termination semantics when branches converged.
4. **Loss of Port Metadata on IR Roundtrips**: Converting between ReactFlow DAG representations and backend `WorkflowDefinition` models dropped handle identifiers (`loop-back`, `loop-body`, `approved`, `rejected`), breaking multi-port graphs when reloaded.

## Plan
1. **Backend Engine & Strategy Formalization**:
   - Introduce `TaskType.END_WORKFLOW` with fan-in barrier execution strategy `EndWorkflowStrategy.java`.
   - Update `StartWorkflowStrategy.java` to act as root workflow pass-through when not triggering child workflows.
   - Implement mathematical back-edge isolation ($E_{\text{forward}} \cup E_{\text{back}}$) in `AcyclicityGuard.java` to validate forward DAG acyclicity alongside loop-body reachability.
2. **Visual Studio Multi-Port Pin Layouts**:
   - Update `dag-node.tsx` with dedicated port configurations:
     - `DO_WHILE`: 4 handles (Left inlet, Top loop-back, Right-Top loop-body, Right-Bottom loop-exit).
     - `SWITCH`: Dynamic case pins (`case-${key}`) and fallback (`case-default`).
     - `HUMAN`: Dual decision pins (`approved`, `rejected`).
     - Standard tasks: Bottom compensation pin (`compensate`).
     - Boundary nodes: `START_WORKFLOW` (output only) and `END_WORKFLOW` (input only).
3. **Interactive Canvas Ergonomics**:
   - Update `use-dag-studio-state.ts` to enforce port connection rules in `isValidConnection`.
   - Auto-provision closed-loop template on dropping `DO_WHILE`.
   - Prohibit deletion of permanent boundary nodes.
4. **Lossless Bi-directional IR Conversion**:
   - Update `workflow-ir-converter.ts` to persist and restore edge handles losslessly in `layoutMetadata.__edges`.
   - Synthesize branch arrays (`decisionCases`, `loopOver`, `compensateHandlerRef`) from handle connections.
5. **Unified Sandbox Parity & Full Verification**:
   - Synchronize `packages/sandbox/src/handlers/workflow-handler.ts` to mirror canonical blank initialization with `START_WORKFLOW` and `END_WORKFLOW`.
   - Verify unit tests across `@acc/api`, `@acc/console`, and `@acc/sandbox`.

## Changes

### 1. Backend Workflow Engine
- **`apps/api/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskType.java`**:
  - Added enum entry `END_WORKFLOW`.
- **`apps/api/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowDefinition.java`**:
  - Updated `WorkflowDefinition.createBlank(...)` to instantiate `START_WORKFLOW` and `END_WORKFLOW` with system boundary flags in `layoutMetadata`.
- **`apps/api/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/EndWorkflowStrategy.java`**:
  - Implemented fan-in barrier strategy to ensure non-compensation prerequisite tasks have completed before producing final workflow output.
- **`apps/api/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/StartWorkflowStrategy.java`**:
  - Enhanced root node pass-through behavior: if `workflowKey` is absent, validates and outputs input payload immediately.
- **`apps/api/workflow-engine/src/main/java/com/acc/workflow/core/decider/NodeStrategyRegistry.java`**:
  - Registered `EndWorkflowStrategy` under `TaskType.END_WORKFLOW`.
- **`apps/api/workflow-engine/src/main/java/com/acc/workflow/core/graph/AcyclicityGuard.java`**:
  - Implemented partition of graph edges into $E_{\text{forward}}$ and $E_{\text{back}}$.
  - Validated that return edges entering `loop-back` strictly originate from descendants within that loop's body.
  - Excluded back-edge origin tasks and compensation targets from terminal node count calculations.
- **`apps/api/workflow-engine/src/test/java/com/acc/workflow/core/graph/AcyclicityGuardTest.java`**:
  - Added test cases verifying valid `DO_WHILE` loops with back-edges, invalid external returns, and end node detection.
- **`apps/api/workflow-engine/src/test/java/com/acc/workflow/core/PureDeciderTest.java`**:
  - Added unit test verifying `END_WORKFLOW` decider execution.
- **`apps/api/acc-ms-aio/src/test/java/com/acc/aio/controller/workflow/WorkflowEngineRestApiTest.java`**:
  - Verified blank workflow creation returns `START_WORKFLOW` and `END_WORKFLOW`.

### 2. Console Visual DAG Studio
- **`apps/console/src/features/workflows/components/studio/canvas/dag-node.tsx`**:
  - Added `END_WORKFLOW` to `DagNodeType`.
  - Implemented 4-port layout for `DO_WHILE` (`target-left`, `loop-back`, `loop-body`, `loop-exit`).
  - Implemented dual right-side decision handles for `HUMAN` (`approved`, `rejected`).
  - Implemented dynamic case handles and `case-default` handle for `SWITCH`.
  - Added bottom compensation handle (`compensate`) to standard tasks.
- **`apps/console/src/features/workflows/components/studio/canvas/dag-node.test.tsx`**:
  - Added 11 component tests validating multi-port rendering and handle placement across all specialized node types.
- **`apps/console/src/features/workflows/components/studio/hooks/use-dag-studio-state.ts`**:
  - Enhanced `isValidConnection` to reject inbound edges to `START_WORKFLOW`, reject outbound edges from `END_WORKFLOW` and `TERMINATE`, reject self-loops, and restrict `loop-back` in-degree and ancestor lineage.
  - Added auto-provisioning template for `DO_WHILE` drops in `onDrop`.
  - Guarded `handleBulkDelete` against removing permanent boundary nodes.
- **`apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.ts`**:
  - Updated `validateGraphTopology` with back-edge isolation and compensation exclusion from `endNodes`.
  - Updated `exportToWorkflowIR` to losslessly save edge handle mappings in `layoutMetadata.__edges` and synchronize `decisionCases`, `loopOver`, and `compensateHandlerRef`.
  - Updated `importFromWorkflowIR` to restore edge handles and synthesize missing multi-port definitions.
- **`apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.test.ts`**:
  - Added 17 unit tests verifying topology validation, handle extraction, and bi-directional lossless conversion.

### 3. Unified Sandbox Offline Parity
- **`packages/sandbox/src/handlers/workflow-handler.ts`**:
  - Updated `WorkflowSandboxRepository.saveDefinition` to initialize canonical blank definitions with `START_WORKFLOW` and `END_WORKFLOW`.

---

## Verification
1. **Console Vitest Suite**:
   `pnpm --filter @acc/console test "src/features/workflows"` passed (24 test files, 118 tests).
2. **Console Strict TypeScript**:
   `pnpm --filter @acc/console exec tsc --noEmit` passed (0 errors).
3. **Sandbox Vitest Suite**:
   `pnpm --filter @acc/sandbox test` passed (11 test files, 103 tests).
4. **Backend Maven Tests**:
   `pnpm --filter @acc/api exec node mvnw.cjs -am -pl acc-ms-aio test "-Dtest=WorkflowEngineRestApiTest,AcyclicityGuardTest,PureDeciderTest"` passed across all modules (`BUILD SUCCESS`).

---

## Walkthrough
Refer to [Walkthrough 166: 24 Workflow Node Types Formalization, Multi-Port Studio Topology, and Closed-Loop Cycle Elimination](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/walkthrough_166.md).

---

## Tasks
- [x] Backend strategy & schema formalization (`END_WORKFLOW`, `EndWorkflowStrategy`, `AcyclicityGuard`).
- [x] Visual DAG Studio multi-port pin layouts in `dag-node.tsx`.
- [x] Interactive connection validation and auto-template provisioning in `use-dag-studio-state.ts`.
- [x] Lossless bi-directional IR conversion in `workflow-ir-converter.ts`.
- [x] Unified Sandbox offline parity in `workflow-handler.ts`.
- [x] Complete test suite verification across backend, console, and sandbox.

---

## Enhancement
Future iterations can build upon this multi-port foundation to support:
- Live visual animation of loop iteration counts and condition evaluation values during execution playback.
- Sub-graph nested workflow canvas expansion inline within `SUB_WORKFLOW` nodes.
