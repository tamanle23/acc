# Walkthrough 96: Phase 32 - Visual DAG Property Inspector, Bidirectional IR Synchronizer & Graph Validation

## 1. Executive Summary
Phase 32 has been implemented and verified across `@unipost/console` and `@unipost/sandbox`:
1. **Slide-Over Property Inspector Drawer (`dag-property-inspector.tsx`)**:
   - Opens when any node is selected or clicked in the Visual DAG Studio.
   - Four specialized configuration sections:
     - **General**: Task reference name, label, description, worker domain pool routing (`default`, `shipping`, `payment`).
     - **Bindings**: Key-value parameter editor with real-time validation badges supporting `${workflow.input.<field>}` and `${<taskRef>.output.<field>}` syntax.
     - **Policies**: Retry count (0-10), retry delay seconds, backoff multiplier, timeout seconds, and Saga reverse compensation handler (`compensateHandlerRef`).
     - **Routing**: `SWITCH` condition routing and `DO_WHILE` loop condition expression editor.
2. **Bidirectional Workflow JSON IR Synchronizer (`workflow-ir-converter.ts`)**:
   - **Export**: Serializes the visual canvas into canonical `workflow-ir-schema-v1.json` format, preserving layout coordinate metadata (`layoutMetadata`).
   - **Import**: Reconstructs the React Flow graph with 100% preservation of nodes, edges, and step configuration parameters.
   - **Topological Validation Engine**: Kahn's topological sort and cycle detector checks for invalid cycles, surfacing visual red border indicators and an interactive diagnostic notification panel.
3. **Workflow IR Dialog (`workflow-ir-dialog.tsx`)**:
   - Integrated modal allowing one-click export (copy to clipboard, download `.json`) or importing canonical IR definitions.
4. **Unified Sandbox Workflow Catalog (`packages/sandbox/src/handlers/workflow-handler.ts`)**:
   - Added support for `GET /api/v1/workflow/definitions`, `GET /api/v1/workflow/definitions/{key}`, and `POST /api/v1/workflow/definitions` in the sandbox route handler.

---

## 2. Key Changes Summary

### `@unipost/console` Visual DAG Studio
- [`dag-node.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/dag-node.tsx): Extended `DagNodeData` to support `domain`, `retryDelaySeconds`, `backoffRate`, `compensateHandlerRef`, `decisionCases`, and `validationError`. Added visual error banner and ring highlighting for invalid nodes.
- [`dag-property-inspector.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/dag-property-inspector.tsx): Slide-over sheet with General, Bindings, Policies, and Routing tabs.
- [`workflow-ir-converter.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/workflow-ir-converter.ts): Core engine for exporting/importing JSON IR and validating graph acyclicity and parameter bindings.
- [`workflow-ir-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/workflow-ir-dialog.tsx): Dialog for viewing, downloading, and applying Workflow IR JSON.
- [`visual-dag-studio.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx): Wired node selection click, Validate DAG toolbar button, Export/Import IR modal triggers, and validation error notification banner.
- [`dag-property-inspector.test.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/dag-property-inspector.test.tsx): Unit tests covering node selection and property changes.
- [`workflow-ir-converter.test.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/studio/workflow-ir-converter.test.ts): Unit tests covering export, import, cycle detection, and parameter expression validation.

### `@unipost/sandbox` Platform
- [`workflow-handler.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/sandbox/src/handlers/workflow-handler.ts): Added in-memory definitions catalog with GET and POST handlers, plus state reset.
- [`sandbox-engine.test.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/sandbox/src/__tests__/sandbox-engine.test.ts): Added tests for definitions catalog API.

---

## 3. Verification Results
- **Console Vitest Suite**: 42 test files passed, 204 tests passed cleanly:
  ```bash
  pnpm --filter @unipost/console exec vitest run
  ```
- **Unified Sandbox Test Suite**: 6 tests passed cleanly:
  ```bash
  pnpm --filter @unipost/sandbox test
  ```
