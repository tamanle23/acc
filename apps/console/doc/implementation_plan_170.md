# Implementation Plan 170 - Visual DAG Studio 2.0: Enterprise DAG Workflow Designer & Data Pipeline Studio

## Goal Description
Upgrade Visual DAG Studio to **Visual DAG Studio 2.0** in `@acc/console` by delivering first-class data semantics, in-canvas node I/O contracts and badges, upstream schema autocomplete, native ReactFlow glowing data flow lineage edges, dedicated node data inspection, and pre-flight semantic linting with roundtrip Workflow IR persistence.

---

## User Review Required
> [!IMPORTANT]
> **Dual Graph Representation**:
> The canvas visually maintains two graph layers rendered natively in ReactFlow:
> 1. Solid sequence edges representing Control Flow ($G_{control}$).
> 2. Glowing animated dashed wires representing Data Lineage ($G_{data}$), rendered as native ReactFlow custom edges (`type: 'dataLineage'`) and toggleable via the canvas header command bar.

> [!IMPORTANT]
> **Workflow IR Persistence**:
> `outputParameters`, `outputSchema`, and `mockOutputPayload` are formally integrated into `WorkflowTaskIR` and `workflow-ir-converter.ts`, guaranteeing roundtrip persistence without data loss.

---

## Proposed Changes

### Phase 1: Contracts, Schema Engine & IR Persistence
- [NEW] `apps/console/src/features/workflows/components/studio/utils/contracts/task-contract-registry.ts`:
  - Input parameter specifications, output schema definitions, and 4-tier fallback hierarchy for all 24 node types.
- [MODIFY] `apps/console/src/features/workflows/components/studio/canvas/dag-node.tsx`:
  - Extend `DagNodeData` with `mockOutputPayload?: Record<string, unknown>`, `outputParameters?: Record<string, unknown>`, and `outputSchema?: Record<string, unknown>`.
- [MODIFY] `apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.ts`:
  - Add `outputParameters`, `outputSchema`, and `mockOutputPayload` to `WorkflowTaskIR`.
  - Update `exportToWorkflowIR` and `importFromWorkflowIR` to persist these fields on save and load.

### Phase 2: Smart Variable Picker & `(fx)` Autocomplete
- [NEW] `apps/console/src/features/workflows/components/studio/canvas/variable-binding-popover.tsx`:
  - Categorized variable picker (Workflow Inputs, Topologically Valid Predecessors, System Variables).
  - Live expression evaluation preview (`↳ sampleValue`).

### Phase 3: Dedicated Node Data & Schema Inspector
- [MODIFY] `apps/console/src/features/workflows/components/studio/inspectors/dag-property-inspector.tsx`:
  - Introduce dedicated **Data & Schema (I/O)** tab:
    - Inputs table with inline `(fx)` trigger.
    - Outputs contract & editable Mock Output JSON editor.
    - Side-by-side Live Execution Payloads comparison with copyable JSONPath expressions.

### Phase 4: Canvas I/O Badges & Native ReactFlow Lineage Edges
- [MODIFY] `apps/console/src/features/workflows/components/studio/canvas/dag-node.tsx`:
  - In-canvas `📥 in` and `📤 out` interactive badges.
- [NEW] `apps/console/src/features/workflows/components/studio/canvas/data-lineage-edge.tsx`:
  - Native ReactFlow edge component (`type: 'dataLineage'`) rendering glowing, animated data dependency wires with hover highlighting.
- [MODIFY] `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`:
  - Register `dataLineage` in `edgeTypes`.
- [MODIFY] `apps/console/src/features/workflows/components/studio/toolbar/dag-header-command-bar.tsx`:
  - Add "Show Data Lineage" toggle button.

### Phase 5: Semantic Pre-Flight DAG Linter
- [NEW] `apps/console/src/features/workflows/components/studio/utils/validation/dag-semantic-linter.ts`:
  - Detects `UNRESOLVED_VARIABLE`, `TEMPORAL_ORDER_VIOLATION`, `CONDITIONAL_BRANCH_NULLABILITY`, and `MISSING_REQUIRED_INPUT`.
- [NEW] `apps/console/src/features/workflows/components/studio/toolbar/dag-diagnostic-drawer.tsx`:
  - Actionable diagnostic drawer with 1-click "Jump to Node" centering.

### Phase 6: Search, Density Modes & Step Sandbox Runner
- [NEW] `apps/console/src/features/workflows/components/studio/toolbar/dag-canvas-search.tsx`:
  - Floating `Ctrl+F` search bar.
- [MODIFY] `apps/console/src/features/workflows/components/studio/toolbar/dag-header-command-bar.tsx`:
  - View density mode selector (`Compact`, `Standard`, `Data Flow`).
- [NEW] `apps/console/src/features/workflows/components/studio/sandbox/dag-step-sandbox-runner.ts`:
  - Isolated step dry-run runner with sample inputs.

---

## Verification Plan

### Automated Tests
- `pnpm --filter @acc/console test "task-contract-registry.test.ts"`
- `pnpm --filter @acc/console test "workflow-ir-converter.test.ts"` (verifying IR roundtrip persistence)
- `pnpm --filter @acc/console test "variable-binding-popover.test.tsx"`
- `pnpm --filter @acc/console test "data-lineage-edge.test.tsx"`
- `pnpm --filter @acc/console test "dag-semantic-linter.test.ts"`
- `pnpm --filter @acc/console test "dag-canvas-search.test.tsx"`
- Full workflow suite: `pnpm --filter @acc/console test "src/features/workflows"`
- TypeScript strict check: `pnpm --filter @acc/console exec tsc --noEmit`
