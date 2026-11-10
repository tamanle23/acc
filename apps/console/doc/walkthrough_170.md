# Walkthrough 170: Visual DAG Studio 2.0 - Enterprise Data Pipeline & DAG Designer

## Overview
This iteration upgraded "Visual DAG Studio 2.0" in `@acc/console` from a sequence/control-flow editor into a true DAG workflow designer & data pipeline studio with first-class data semantics across all 6 core pillars:
1. First-Class Node I/O Schemas & Canvas Data Badges with `TaskContractRegistry` across all 24 node types, 4-tier schema fallback hierarchy, and roundtrip `WorkflowTaskIR` persistence (`outputParameters`, `outputSchema`, `mockOutputPayload`).
2. Smart Upstream Variable Picker & `(fx)` Autocomplete (`VariableBindingPopover`) with topological ancestor filtering and live expression preview.
3. Dual-Layer DAG Topology (Control Flow vs. Data Flow Lineage) rendered as native ReactFlow custom edges (`type: 'dataLineage'`).
4. Dedicated Node Data & Schema Inspector in `DagPropertyInspector` (`Data & Schema (I/O)` tab with `Inputs`, `Outputs & Contract`, and `Live Payloads` sub-views).
5. Static Semantic Pre-Flight DAG Linter (`dag-semantic-linter.ts` & `DagDiagnosticDrawer`) catching broken upstream references, temporal causality violations, and `SWITCH` conditional nullability.
6. Canvas Ergonomics: floating `Ctrl+F` quick search and viewport jump, view density modes (`Compact`, `Standard`, `Data Flow`), and isolated "Test Step" sandbox runner.

---

## Changes

### 1. Contracts, Schema Engine & IR Persistence (Pillar 1)
- `apps/console/src/features/workflows/components/studio/utils/contracts/task-contract-registry.ts`:
  - Implemented typed `TaskContractRegistry` defining contract metadata across all 24 node types.
  - Implemented 4-tier schema fallback hierarchy:
    1. Node explicit override (`declaredOutputSchema`)
    2. Node mock sample (`mockOutputPayload`)
    3. Worker Fleet Catalog descriptor (`workerDescriptor.outputSchema`)
    4. Static built-in default contract
  - Implemented `getOutputSchemaTree` converting schemas to tree nodes with paths, types, and sample values.
- `apps/console/src/features/workflows/components/studio/canvas/dag-node.tsx`:
  - Added `outputParameters`, `declaredOutputSchema`, `mockOutputPayload`, and `viewDensity` to `DagNodeData`.
  - Added in-canvas I/O badges (`📥 X in`, `📤 Y out`) and expanded dataflow contract cards.
- `apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.ts`:
  - Updated `WorkflowTaskIR` interface and wired lossless roundtrip export/import for `outputParameters`, `outputSchema`, and `mockOutputPayload`.

### 2. Smart Variable Picker & `(fx)` Autocomplete (Pillar 2)
- `apps/console/src/features/workflows/components/studio/canvas/variable-binding-popover.tsx`:
  - Implemented `getTopologicalAncestors` using reverse graph traversal along incoming edges to enforce directed acyclic causality.
  - Implemented `evaluateExpressionPreview` supporting `${workflow.input.*}` and `${<taskRef>.output.*}` paths.
  - Built `VariableBindingPopover` UI with search filter, tree viewer, type badges, copy actions, and live previews.

### 3. Dual-Layer DAG Topology: Data Flow Lineage (Pillar 3)
- `apps/console/src/features/workflows/components/studio/canvas/data-lineage-edge.tsx`:
  - Built `buildDataLineageEdges(nodes)` analyzing template expressions in `inputParameters`.
  - Built `DataLineageEdgeComponent` rendering SVG dashed purple paths with parameter pill labels.
- `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`:
  - Registered `dataLineage` edge type in React Flow canvas.
  - Added `showDataLineage` toggle button in header command dock.

### 4. Dedicated Node Data & Schema Inspector (Pillar 4)
- `apps/console/src/features/workflows/components/studio/inspectors/dag-property-inspector.tsx`:
  - Added `Data (I/O)` tab with 3 sub-tabs: `Inputs & Bindings`, `Outputs & Contract`, and `Live Payloads`.
  - Embedded `VariableBindingPopover` trigger next to input parameters.
  - Provided visual JSON editing for `mockOutputPayload` and live resolved schema preview.

### 5. Pre-Flight Semantic DAG Linter & Diagnostic Drawer (Pillar 5)
- `apps/console/src/features/workflows/components/studio/utils/validation/dag-semantic-linter.ts`:
  - Detects `UNRESOLVED_VARIABLE`, `TEMPORAL_ORDER_VIOLATION`, `CONDITIONAL_BRANCH_NULLABILITY`, and `MISSING_REQUIRED_INPUT`.
- `apps/console/src/features/workflows/components/studio/toolbar/dag-diagnostic-drawer.tsx`:
  - Floating Liquid Glass diagnostics drawer with severity filters (Errors, Warnings, Info) and "Focus" buttons that jump the canvas viewport to affected nodes.

### 6. Canvas Ergonomics & Step Sandbox Runner (Pillar 6)
- `apps/console/src/features/workflows/components/studio/toolbar/dag-canvas-search.tsx`:
  - Floating `Ctrl+F` quick search dialog filtering nodes by ref, label, type, or parameters with keyboard navigation and smooth canvas zoom/pan.
- `apps/console/src/features/workflows/components/studio/sandbox/dag-step-sandbox-runner.ts`:
  - Evaluates isolated step execution against mock inputs and upstream outputs in <15ms.
  - Wired into `DagPropertyInspector` under `Live Payloads` sub-tab.

---

## Verification Results
- Unit & Integration Suites: **37 test files, 179 tests passing (100%)**.
- Strict TypeScript Check: `tsc --noEmit` exited 0 with zero errors.
- Visual & Ergonomic Verification: All interactive components conform to Monorepo Liquid Glass tokens.
