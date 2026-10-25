# Walkthrough 95: Phase 31 - Visual DAG Drag-and-Drop & Workflow Executions Ledger

## 1. Executive Summary
Phase 31 has been implemented and refined to enforce strict domain boundaries:
1. **Drag-and-Drop Workflow Authoring in Visual DAG Studio (`/workflows`)**:
   - Implemented [`dag-palette.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/studio/dag-palette.tsx) featuring standard workflow task types: `SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, `DO_WHILE`.
   - Enhanced [`visual-dag-studio.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx) with HTML5 drag-and-drop support, `screenToFlowPosition` coordinate translation, edge connect snapping, and node deletion controls.
2. **Refactored `/tasks` into the Workflow Executions Ledger**:
   - Clarified domain model: Task is an execution unit of a runtime Workflow Execution instance.
   - Rebranded screen and sidebar from **Tasks** to **Workflow Executions** across UI and i18n locales (`en`, `vi`).
   - Eliminated synthetic demo backlog data (`tasks-mock.json`). The ledger is 100% dedicated to runtime workflow execution instances.
   - Built execution lifecycle tabs: **All Executions**, **In Progress / Running**, **Completed**, and **Failed / Action Required**.
   - Upgraded [`tasks-columns.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/tasks/components/tasks-columns.tsx) with `Execution Unit / ID`, `Workflow Definition` badges linking directly to `/workflows`, and worker lease telemetry.
   - Upgraded [`task-payload-inspector-dialog.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/tasks/components/task-payload-inspector-dialog.tsx) as the **Workflow Execution Instance Details** modal.

---

## 2. Key Changes Summary

### Visual DAG Studio
- [`dag-node.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/studio/dag-node.tsx): Added `DYNAMIC_FORK` task type and icon.
- [`dag-palette.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/studio/dag-palette.tsx): Rebranded to **Node Palette** for designing workflow steps.
- [`dag-palette.test.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/studio/dag-palette.test.tsx): Unit tests covering palette items and drag data.
- [`visual-dag-studio.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx): Wrapped canvas with `ReactFlowProvider`, wired `onDrop`, `onDragOver`, node connection handler `onConnect`, and delete buttons.

### Workflow Executions Ledger
- [`sidebar-data.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/data/sidebar-data.ts): Updated navigation item to **Workflow Executions**.
- [`en/console.json`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/locales/en/console.json) & [`vi/console.json`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/locales/vi/console.json): Added `workflowExecutions` translation keys.
- [`tasks.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/tasks/data/tasks.ts): Seeded pure workflow execution instances with `activeStep`, discarding synthetic template mocks.
- [`index.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/tasks/index.tsx): Integrated lifecycle filtering (**All**, **In Progress**, **Completed**, **Failed**) and Visual DAG engine badge.
- [`tasks-columns.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/tasks/components/tasks-columns.tsx): Added `Workflow Definition` links, `Active Step / Milestone` badges, lease owner information, and execution status styling (encapsulating low-level task types).
- [`task-payload-inspector-dialog.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/tasks/components/task-payload-inspector-dialog.tsx): Detailed modal inspecting JSON payload input/output and lease telemetry.
- [`data-table-row-actions.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/tasks/components/data-table-row-actions.tsx): Cross-navigation and inspection triggers.
- [`schema.test.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/tasks/data/schema.test.ts): Unit tests validating workflow task schema parsing.

---

## 3. Verification Results
- **Vitest Suite**: 40 test files passed, 197 tests passed cleanly:
  ```bash
  pnpm --filter @acc/console exec vitest run src/features/tasks
  pnpm --filter @acc/console exec vitest run src/features/metadata/components/studio
  ```
- **Sandbox Test Suite**: 5/5 tests passed in `@acc/sandbox`.
  ```bash
  pnpm --filter @acc/sandbox test
  ```
