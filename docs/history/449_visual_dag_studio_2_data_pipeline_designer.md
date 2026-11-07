# 449. Visual DAG Studio 2.0 - Enterprise Data Pipeline & DAG Designer Upgrade

## Problem
In Visual DAG Studio 1.x / early 2.0, the visual editor focused predominantly on control flow and sequence management (handles, execution states, breakpoints, replay timeline). Several essential capabilities of a real DAG workflow and data pipeline designer were missing:
1. **Opaque Data Contracts**: Nodes did not declare or display input parameters or output schemas on the canvas, forcing developers to mentally track JSON payloads.
2. **Error-Prone Manual Expression Writing**: Authors had to manually type `${task_ref.output.field}`, leading to typo-driven runtime task failures.
3. **Hidden Data Dependencies**: Visual edges showed execution control transitions, but data lineage (which task consumes which upstream output) was completely invisible.
4. **Lack of Pre-Flight Semantic Validation**: Topological temporal violations (forward references, parallel sibling bindings) and conditional nullability from `SWITCH` branches went undetected until execution failures.
5. **No Isolated Step Testing**: Users could not verify a single step's expression evaluation and mock payload transformation without executing the full workflow.

---

## Plan
Implement the 6 core pillars defined in Iteration 72:
1. **Node I/O Schemas & Canvas Badges**: Build `TaskContractRegistry` across all 24 node types, 4-tier schema fallback hierarchy, and roundtrip `WorkflowTaskIR` persistence (`outputParameters`, `outputSchema`, `mockOutputPayload`).
2. **Smart Upstream Variable Picker & `(fx)` Autocomplete**: Create `VariableBindingPopover` with topological ancestor filtering, expression evaluation, and live preview.
3. **Dual-Layer DAG Topology (Control Flow vs. Lineage)**: Implement native ReactFlow custom edges (`type: 'dataLineage'`) rendering dashed purple spline overlays for data references.
4. **Dedicated Node Data & Schema Inspector**: Expand `DagPropertyInspector` with a 3-way `Data (I/O)` tab (`Inputs & Bindings`, `Outputs & Contract`, `Live Payloads`).
5. **Pre-Flight Semantic DAG Linter**: Build `dag-semantic-linter.ts` and `DagDiagnosticDrawer` catching `UNRESOLVED_VARIABLE`, `TEMPORAL_ORDER_VIOLATION`, `CONDITIONAL_BRANCH_NULLABILITY`, and `MISSING_REQUIRED_INPUT`.
6. **Canvas Ergonomics**: Implement floating `Ctrl+F` quick search dialog, view density modes (`Compact`, `Standard`, `Data Flow`), and isolated "Test Step" sandbox runner.

---

## Changes

### 1. Contracts & Schema Registry
- Created [`task-contract-registry.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/utils/contracts/task-contract-registry.ts) registering data contracts for all 24 Conductor node types.
- Implemented 4-tier schema fallback hierarchy (`declaredOutputSchema` -> `mockOutputPayload` -> `workerDescriptor.outputSchema` -> `defaultMockOutput`).
- Updated [`dag-node.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/canvas/dag-node.tsx) adding in-canvas input/output badges and density modes (`compact`, `standard`, `dataFlow`).
- Updated [`workflow-ir-converter.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.ts) with roundtrip persistence for output parameters, schemas, and mock payloads.

### 2. Variable Picker & Expression Autocomplete
- Created [`variable-binding-popover.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/canvas/variable-binding-popover.tsx) providing topological ancestor resolution, expression previews, and searchable tree views.

### 3. Data Flow Lineage Overlay
- Created [`data-lineage-edge.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/canvas/data-lineage-edge.tsx) providing `buildDataLineageEdges` and `DataLineageEdgeComponent`.
- Wired into [`visual-dag-studio.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx) and [`dag-header-command-bar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/toolbar/dag-header-command-bar.tsx).

### 4. Property Inspector & Sandbox Runner
- Updated [`dag-property-inspector.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/inspectors/dag-property-inspector.tsx) with a dedicated `Data (I/O)` tab and sub-views.
- Created [`dag-step-sandbox-runner.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/sandbox/dag-step-sandbox-runner.ts) to execute zero-run simulated step tests in <15ms.

### 5. Semantic Pre-Flight Linter & Canvas Search
- Created [`dag-semantic-linter.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/utils/validation/dag-semantic-linter.ts) and [`dag-diagnostic-drawer.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/toolbar/dag-diagnostic-drawer.tsx).
- Created [`dag-canvas-search.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/toolbar/dag-canvas-search.tsx) with `Ctrl+F` shortcut and smooth viewport centering.

---

## Verification
- Unit & Integration Test Suites:
  - `pnpm --filter @acc/console test "src/features/workflows"`: **37 test files, 179 tests passed (100%)**.
  - `task-contract-registry.test.ts`: 6/6 passed.
  - `variable-binding-popover.test.tsx`: 6/6 passed.
  - `data-lineage-edge.test.tsx`: 2/2 passed.
  - `dag-semantic-linter.test.ts`: 5/5 passed.
  - `dag-diagnostic-drawer.test.tsx`: 3/3 passed.
  - `dag-canvas-search.test.tsx`: 3/3 passed.
  - `dag-step-sandbox-runner.test.ts`: 2/2 passed.
  - `dag-property-inspector.test.tsx`: 5/5 passed.
  - `visual-dag-studio-2.test.tsx`: 3/3 passed.
- Strict Type Check:
  - `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.

---

## Walkthrough
See companion documentation: [`apps/console/doc/walkthrough_170.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/walkthrough_170.md).

---

## Tasks
- [x] Phase 1: Contracts, Schema Engine & IR Persistence
- [x] Phase 2: Smart Variable Picker & `(fx)` Autocomplete Engine
- [x] Phase 3: Dedicated Node Data & Schema Inspector
- [x] Phase 4: Dual-Layer Topology (Data Flow Lineage Overlay & Badges)
- [x] Phase 5: Pre-Flight Semantic DAG Linter & Diagnostic Drawer
- [x] Phase 6: Canvas Ergonomics (Quick Search, View Density & Sandbox Runner)
- [x] Comprehensive test suite execution (179 tests) and type-checking
- [x] Register history and commit changes

---

## Enhancement
Future iterations can leverage the `TaskContractRegistry` to auto-generate OpenAPI / AsyncAPI client SDKs for Conductor worker definitions, and stream runtime live data samples back into `mockOutputPayload` during replay scrubbing.
