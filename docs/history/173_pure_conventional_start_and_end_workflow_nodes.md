# 173. Pure Conventional START & END Workflow Boundary Nodes

## Problem
In previous iterations, the workflow START and END boundary nodes were overloaded with arbitrary task execution logic (e.g., `checkInventory` as start node with warehouse domains, retries, and timeouts; `completeOrder` as end node with execution parameters). This violated the architectural principle that boundary nodes in a workflow DAG should be pure conventional entry and exit points responsible solely for defining the workflow's input parameters (`workflow.input`) and mapping its output payload (`workflow.output`).

## Plan
1. **Directional Handle Constraints (`dag-node.tsx`)**:
   - Render strictly the source handle (right) on the START node to block incoming edges (in-degree 0).
   - Render strictly the target handle (left) on the END node to block outgoing edges (out-degree 0).
   - Display dedicated emerald `START` and purple `END` badges with parameter counts instead of worker timeouts/retries.
2. **Dedicated Property Inspector Surfaces (`dag-property-inspector.tsx`)**:
   - Special-case START nodes to display a focused Workflow Input definition view powered by `VisualJsonEditor` with copyable `${workflow.input.<field>}` reference pills. Strip out worker catalogs, retry policies, and execution timeouts.
   - Special-case END nodes to display a focused Workflow Output mapping view powered by `VisualJsonEditor` with upstream task output reference pills (`${<task>.output.*}`) and termination status options. Strip out worker catalogs, retry policies, and execution timeouts.
3. **Canvas Invariants & Connection Filtering (`visual-dag-studio.tsx`)**:
   - Update `INITIAL_NODES` to feature pure `node-start` (`workflow_start`, `NOOP`) and `node-end` (`workflow_end`, `TERMINATE`), with intermediate business tasks wired between them.
   - Implement `isValidConnection` on ReactFlow to reject connections targeting START, originating from END, or creating self-loops.
4. **Canonical IR Roundtripping (`workflow-ir-converter.ts`)**:
   - Preserve boundary flags (`isStartNode`, `isEndNode`, `isPermanent`) in `layoutMetadata` during export and restore them during import.
   - Add automated test suites covering handle visibility, property inspector rendering, and IR roundtrip fidelity.

## Changes

### apps/console
- [`dag-node.tsx`](file:///apps/console/src/features/metadata/components/studio/dag-node.tsx):
  - Directional handles: target handle omitted on START; source handle omitted on END.
  - Dedicated icons: `PlaySquare` emerald icon for START, `StopCircle` purple icon for END.
  - Body summary shows input parameter / output mapping count.
- [`dag-node.test.tsx`](file:///apps/console/src/features/metadata/components/studio/dag-node.test.tsx): Added assertions for directional handle visibility and summary labels.
- [`dag-property-inspector.tsx`](file:///apps/console/src/features/metadata/components/studio/dag-property-inspector.tsx):
  - START inspector: Pure Workflow Input definition with `VisualJsonEditor` and copyable expression chips.
  - END inspector: Pure Workflow Output mapping with `VisualJsonEditor`, termination status toggle, and upstream output chips.
- [`dag-property-inspector.test.tsx`](file:///apps/console/src/features/metadata/components/studio/dag-property-inspector.test.tsx): Added tests verifying dedicated inspector views for START and END nodes.
- [`visual-dag-studio.tsx`](file:///apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx):
  - Seeded initial canvas with conventional `node-start` and `node-end`.
  - Added `isValidConnection` filtering boundary node handles and self-loops.
- [`workflow-ir-converter.ts`](file:///apps/console/src/features/metadata/components/studio/workflow-ir-converter.ts):
  - Preserved boundary node metadata in `exportToWorkflowIR` and restored in `importFromWorkflowIR`.
- [`workflow-ir-converter.test.ts`](file:///apps/console/src/features/metadata/components/studio/workflow-ir-converter.test.ts): Added roundtrip test for pure START and END boundary nodes.

## Verification
- **Frontend Vitest**: 11 test suites passed, 50/50 tests passing (100% green).
- **TypeScript Check**: `pnpm --filter @unipost/console exec tsc --noEmit` exited `0` with 0 errors.
- **Backend Tests**: `mvnw.cmd test -pl workflow-engine -q` passed with code 0.

## Walkthrough
Detailed walkthrough available at:
[`apps/console/doc/walkthrough_137.md`](file:///apps/console/doc/walkthrough_137.md)

## Tasks
- [x] Omit target handle on START and source handle on END in `dag-node.tsx`.
- [x] Create dedicated pure Workflow Input inspector in `dag-property-inspector.tsx`.
- [x] Create dedicated pure Workflow Output inspector in `dag-property-inspector.tsx`.
- [x] Update canvas initial graph with pure START (`workflow_start`) and END (`workflow_end`).
- [x] Implement `isValidConnection` to forbid invalid edges to START or from END.
- [x] Preserve boundary metadata in IR converter import/export.
- [x] Verify all unit tests, typechecks, and backend engine tests.

## Enhancement
Future enhancements could include schema validation (e.g. JSON Schema Draft 7) for `workflow.input` so invalid payload structures are highlighted prior to workflow execution.
