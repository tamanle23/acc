# 099: Phase 31 - Visual DAG Drag-and-Drop Studio & Tasks Execution Units Ledger

## Problem
In Workstream 7 (Phase 31), the workflow orchestration system needed two critical frontend capabilities:
1. The **Visual DAG Studio** (`/workflows`) lacked interactive drag-and-drop authoring tools for adding nodes from a task palette into the React Flow canvas.
2. The `/tasks` route rendered a generic, static Kanban/mock list completely detached from the distributed workflow orchestration engine, lacking execution unit semantics (`workflowId`, `taskReferenceName`, `taskType`, worker lease telemetry, retries, and direct bi-directional navigation to the Visual DAG Studio).

## Plan
1. **Visual DAG Studio Canvas**:
   - Create `DagPalette` with draggable task nodes (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, `DO_WHILE`).
   - Integrate drag-and-drop onto the React Flow canvas with `screenToFlowPosition`, edge connect snapping, and node deletion controls.
2. **Tasks Execution Units Ledger**:
   - Refactor `taskSchema` and introduce `workflowTaskExecutionSchema` capturing workflow instance and worker lease telemetry.
   - Add dual-mode tabs: **Workflow Tasks** (active/historical execution units) vs **Manual Backlog**.
   - Enhance table columns with workflow plan badges, task type indicators, lease owner information, and duration.
   - Build `TaskPayloadInspectorDialog` to inspect input/output JSON payloads and error logs.
   - Add **"View in Visual DAG"** cross-navigation linking directly to the visual workflow canvas.
3. **Verification**:
   - Unit tests for `DagPalette` and `workflowTaskExecutionSchema`.
   - Full Vitest test suite execution across `@unipost/console` and `@unipost/sandbox`.

## Changes Made
- `apps/console/src/features/metadata/components/studio/dag-palette.tsx`: Draggable palette with all DAG node types.
- `apps/console/src/features/metadata/components/studio/dag-palette.test.tsx`: Palette unit tests.
- `apps/console/src/features/metadata/components/studio/dag-node.tsx`: Added `DYNAMIC_FORK` support.
- `apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`: Wrapped in `ReactFlowProvider` with drop listeners, edge connections, and deletion controls.
- `apps/console/src/features/tasks/data/schema.ts`: Added `workflowTaskExecutionSchema`, `taskExecutionStatusSchema`, and unified `Task` type.
- `apps/console/src/features/tasks/data/schema.test.ts`: Schema validation and backward compatibility tests.
- `apps/console/src/features/tasks/data/data.tsx`: Added execution statuses and `taskTypeMeta`.
- `apps/console/src/features/tasks/data/tasks.ts`: Seeded initial workflow execution units with full payloads.
- `apps/console/src/features/tasks/index.tsx`: Dual-mode switcher between Workflow Tasks and Manual Backlog.
- `apps/console/src/features/tasks/components/tasks-columns.tsx`: Display workflow plan links, type badges, and worker leases.
- `apps/console/src/features/tasks/components/task-payload-inspector-dialog.tsx`: Execution payload and telemetry inspector dialog.
- `apps/console/src/features/tasks/components/data-table-row-actions.tsx`: Added inspect payload and jump to Visual DAG actions.
- `apps/console/src/features/tasks/components/tasks-provider.tsx` & `tasks-dialogs.tsx`: Supported `inspect` dialog state.
- `apps/console/src/features/tasks/api/use-tasks.ts`: Hardened mutation payloads and typing.
- `apps/console/src/features/tasks/components/tasks-mutate-drawer.tsx`: Typed status field safely.
- `apps/console/doc/walkthrough_95.md`: Documentation of changes and verification.

## Verification
- Vitest suite in `@unipost/console`: 40/40 test files passed, 197/197 tests passed.
- Vitest suite in `@unipost/sandbox`: 5/5 tests passed.

## Tasks Completed
- [x] Create draggable `DagPalette` in Visual DAG Studio.
- [x] Wire HTML5 drop handlers and canvas coordinate projection in `visual-dag-studio.tsx`.
- [x] Model tasks as Workflow Execution Units in `schema.ts`.
- [x] Build `TaskPayloadInspectorDialog` for execution payload review.
- [x] Add dual-mode tabs and cross-navigation from `/tasks` to `/workflows`.
