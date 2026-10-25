# Implementation Plan 96: Phase 32 - Visual DAG Property Inspector, Bidirectional IR Synchronizer & Graph Validation

## 1. Goal & Architectural Overview
Implement **Phase 32** of the Integration Master Plan:
1. **Property Inspector Slide-Over Drawer (`dag-property-inspector.tsx`)**:
   - Slide-over sheet that opens when a DAG node is selected or clicked.
   - Tabs:
     - **General**: `taskReferenceName`, `label`, `description`, `domain` (`default`, `payment`, `shipping`, etc.).
     - **Parameters & Bindings**: Dynamic key-value editor for `inputParameters` supporting `${workflow.input.*}` and `${taskRef.output.*}` syntax with live validation badges.
     - **Reliability & Policies**: `retryCount` (0-10), `retryDelaySeconds`, `backoffRate`, `timeoutSeconds`, and `compensateHandlerRef` (for distributed Sagas).
     - **Conditions & Loops**: Expression editor for `SWITCH` condition routing (`decisionCases` mapping) and `DO_WHILE` loop constraints.
2. **Bidirectional JSON IR Synchronizer & Graph Cycle Validation**:
   - `workflow-ir-converter.ts`:
     - **Export**: Converts React Flow `nodes` and `edges` into canonical `workflow-ir-schema-v1.json` format, storing canvas coordinates in `layoutMetadata`.
     - **Import**: Parses valid Workflow IR JSON and instantiates React Flow `nodes` and `edges` preserving layout and parameters.
     - **Validation Engine**: Implements Kahn's topological sort and Tarjan's strongly connected components algorithm to detect cycles and missing input references; surfaces error badges on problematic nodes.
3. **Studio Top Toolbar Integration**:
   - Add **Import JSON IR**, **Export JSON IR**, and **Validate DAG** action buttons with dialog modal for viewing/copying/pasting JSON.
4. **Unified Sandbox Catalog Upgrade (`packages/sandbox/src/handlers/workflow-handler.ts`)**:
   - Provide `POST /api/v1/workflow/definitions` and `GET /api/v1/workflow/definitions` in the sandbox workflow handler.
   - Support saving and retrieving definitions with layout metadata.

---

## 2. Target Files & Artifacts
- **Console Feature**: `apps/console/src/features/metadata/components/studio/`
  - `dag-node.tsx`: Extend `DagNodeData` to support `domain`, `retryDelaySeconds`, `backoffRate`, `compensateHandlerRef`, `decisionCases`, `loopCondition`.
  - `dag-property-inspector.tsx`: Slide-over property drawer for node configuration.
  - `workflow-ir-converter.ts`: Canonical JSON IR export, import, cycle detection (Kahn/Tarjan), and syntax validation.
  - `workflow-ir-dialog.tsx`: Import / Export JSON modal.
  - `visual-dag-studio.tsx`: Wire node selection, property drawer mutations, import/export dialog, and validation error highlighting.
  - Unit tests: `dag-property-inspector.test.tsx`, `workflow-ir-converter.test.ts`.
- **Sandbox Package**: `packages/sandbox/src/handlers/workflow-handler.ts`
  - Add `GET /api/v1/workflow/definitions` and `POST /api/v1/workflow/definitions`.
  - Add tests in `packages/sandbox/src/__tests__/sandbox-engine.test.ts`.
- **Documentation**:
  - `apps/console/doc/implementation_plan_96.md`
  - `apps/console/doc/walkthrough_96.md`
  - `docs/history/102_phase_32_visual_dag_property_inspector_and_ir_sync.md`
  - `docs/history/README.md`

---

## 3. Verification Plan
- `pnpm --filter @acc/console exec vitest run src/features/metadata/components/studio`
- `pnpm --filter @acc/sandbox test`
- `pnpm --filter @acc/console test`
