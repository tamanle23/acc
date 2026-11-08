# 465 - Dedicated Task Definitions Manager & Studio Hub

## Problem
In workflow orchestration, task contracts, input/output schemas, and execution policies were historically conflated with worker capacity registrations, and lacked a dedicated visual authoring interface. Workflow designers had to manually create synthetic schemas or rely on external worker registrations, which restricted version progression, draft editing, and in-canvas drag-and-drop workflow authoring.

## Plan
Implement a dedicated **Task Definitions Manager** and Studio Hub fulfilling Iteration 76:
1. Extend API layer with draft deletion mutation and deterministic category resolution.
2. Build 4-metric Liquid Glass operational telemetry strip (`TaskDefinitionKpiBar`).
3. Build TanStack Table catalog (`TaskDefinitionTable`) with badges, version chips, execution policy summary, and action dropdowns.
4. Implement interactive visual property builder (`SchemaPropertyGrid`) with dual visual/raw JSON Schema editing and lossless AST synchronization.
5. Implement client-side validation test bench (`SchemaTestSandbox`) with sample mock generation and field error tracking.
6. Provide pre-built schema templates (`schema-templates.ts`) for fast-start authoring.
7. Build multi-tab authoring dialog (`TaskDefinitionEditorDialog`) with keyboard event shielding over React Flow.
8. Build append-only version history drawer (`TaskVersionHistoryDrawer`) with side-by-side schema diff comparison.
9. Integrate into `/workflows` hub view switcher and wire `+ New` button directly into `VisualDagStudio` palette.
10. Ensure 100% offline parity in `packages/sandbox` and verify through automated tests.

## Changes
- **API & Sandbox**:
  - `apps/console/src/features/workflows/api/task-definition-api.ts`: Added `useDeleteTaskDefinitionDraft` and `resolveTaskCategory`.
  - `packages/sandbox/src/handlers/workflow-handler.ts`: Supported draft deletion and canonical draft route matching.
- **UI Components**:
  - `apps/console/src/features/workflows/components/task-definitions/schema-templates.ts`: Predefined templates.
  - `apps/console/src/features/workflows/components/task-definitions/task-definition-kpi-bar.tsx`: 4 KPI metrics.
  - `apps/console/src/features/workflows/components/task-definitions/task-definition-columns.tsx`: TanStack column definitions.
  - `apps/console/src/features/workflows/components/task-definitions/task-definition-table.tsx`: Data table with filters and pagination.
  - `apps/console/src/features/workflows/components/task-definitions/schema-property-grid.tsx`: Visual property builder.
  - `apps/console/src/features/workflows/components/task-definitions/schema-test-sandbox.tsx`: Live payload validator.
  - `apps/console/src/features/workflows/components/task-definitions/task-definition-editor-dialog.tsx`: Multi-tab dialog.
  - `apps/console/src/features/workflows/components/task-definitions/task-version-history-drawer.tsx`: Version history drawer.
  - `apps/console/src/features/workflows/components/task-definitions/index.ts`: Barrel exports.
- **Hub & Studio Integration**:
  - `apps/console/src/features/workflows/index.tsx`: Tri-view switcher (`Definitions Catalog` | `Task Definitions` | `Approvals Inbox`).
  - `apps/console/src/features/workflows/components/studio/palette/dag-palette.tsx`: In-canvas `+ New` button in category header.
  - `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`: Wired dialog state and query invalidation.
- **Locales & Route Specs**:
  - Synchronized `en/console.json`, `vi/console.json`, and updated `apps/console/ROUTE.md` section 3.11.
- **Automated Tests**:
  - `apps/console/src/features/workflows/components/task-definitions/__tests__/task-definition-table.test.tsx`
  - `apps/console/src/features/workflows/components/task-definitions/__tests__/task-definition-editor.test.tsx`

## Verification
- `pnpm --filter @acc/console test "task-definition"`: All 9 tests passed.
- `pnpm --filter @acc/console test "dag-palette"`: All 3 tests passed.
- `pnpm --filter @acc/console test "visual-dag-studio"`: All 12 tests passed.
- `pnpm --filter @acc/sandbox test`: All 109 tests across 12 suites passed.

## Walkthrough
Refer to `apps/console/doc/walkthrough_173.md` for detailed UI flows and component specifications.

## Tasks
- [x] Extend API mutations and offline sandbox handlers.
- [x] Build KPI cards, column definitions, and filterable table.
- [x] Build dual-mode visual property grid and raw JSON Schema editor.
- [x] Build live client-side payload validation test bench.
- [x] Build multi-tab editor modal with hotkey shielding.
- [x] Build version history drawer with schema diff viewer.
- [x] Integrate into `/workflows` hub and Visual DAG Studio palette.
- [x] Synchronize locales and ROUTE.md.
- [x] Write automated tests and verify suite passes.

## Enhancement
Future enhancements may include automated schema migration codemods when promoting a breaking task definition version across active workflows, and OpenAPI/AsyncAPI specification importers.
