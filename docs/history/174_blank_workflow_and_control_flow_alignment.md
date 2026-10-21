# [174] Blank Workflow Canvas, Edge Quick-Insert, and Full-Stack Control Flow Alignment

## Problem
1. When creating a blank workflow, the DAG studio previously loaded sample multi-task graphs rather than starting strictly with pure `START` and `END` conventional nodes with no intermediate tasks.
2. Inserting tasks between existing nodes required tedious manual wiring, disconnecting, and dragging.
3. Control Flow nodes (`FORK_JOIN` vs `JOIN`, `SWITCH` vs `EXCLUSIVE_JOIN`, `DO_WHILE` loopback vs exit, `TERMINATE`) lacked UI-to-backend contract alignment regarding edge representations, `TaskDefinition.joinOn`, and convergence guarantees.

## Plan
1. Define `BLANK_WORKFLOW_NODES` (`node-start` -> `node-end` only) and `BLANK_WORKFLOW_EDGES` (`e_start_to_end`).
2. Implement edge quick-split `+` button in `dag-condition-edge.tsx` and `handleSplitEdge` in `visual-dag-studio.tsx`.
3. Update `dag-palette.tsx` with `JOIN` and `EXCLUSIVE_JOIN` nodes.
4. Enforce `FORK_JOIN` -> `JOIN` pairing, `DO_WHILE` loopback filtering & exit branch validation in `workflow-ir-converter.ts`.
5. Synchronize canvas edges with `task.joinOn: string[]` bidirectionally in `exportToWorkflowIR` and `importFromWorkflowIR`.
6. Enforce `FORK_JOIN` and `JOIN` pair validation in backend `AcyclicityGuard.java`.
7. Verify with backend JUnit 5 suites, console Vitest suites, and `tsc --noEmit`.

## Changes
- `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/graph/AcyclicityGuard.java`:
  - Added validation requiring matching `JOIN` task barrier when `FORK_JOIN` is present.
- `apps/backend/workflow-engine/src/test/java/com/unipost/workflow/core/graph/AcyclicityGuardTest.java`:
  - Added unit test cases for fork-without-join rejection and valid fork-join pair acceptance.
- `apps/console/src/features/metadata/components/studio/dag-palette.tsx`:
  - Added `JOIN` and `EXCLUSIVE_JOIN` node definitions under Control Flow category.
- `apps/console/src/features/metadata/components/studio/dag-condition-edge.tsx`:
  - Added `onSplitEdge` callback and rendered Liquid Glass `+` quick-insert button.
- `apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`:
  - Exported `BLANK_WORKFLOW_NODES` and `BLANK_WORKFLOW_EDGES`.
  - Added `handleSplitEdge` and wired `onSplitEdge` to `decoratedEdges`.
  - Added "Blank" reset button to authoring toolbar.
- `apps/console/src/features/metadata/components/studio/workflow-ir-converter.ts`:
  - Implemented `forwardAdj` Kahn cycle detection ignoring `isLoopbackEdge: true`.
  - Added `FORK_WITHOUT_JOIN` and `DO_WHILE_NO_EXIT` topology validators.
  - Implemented edge-to-`joinOn` bidirectional export/import mapping.
- Tests & Docs:
  - `dag-condition-edge.test.tsx`: Added unit test for split button and label interactions.
  - `workflow-ir-converter.test.ts`: Added tests for fork convergence, loopback bypass, and `joinOn` roundtrip.
  - `dag-palette.test.tsx` & `visual-dag-studio-modes.test.tsx`: Updated for 23 palette items and blank workflow button.
  - `apps/console/doc/implementation_plan_138.md` & `apps/console/doc/walkthrough_138.md`.

## Verification
- Vitest: 54/54 tests passing across 12 test suites in `src/features/metadata/components/studio/`.
- TypeScript: `pnpm --filter @unipost/console exec tsc --noEmit` exited 0.
- Maven: `cmd.exe /c "mvnw.cmd test -pl workflow-engine -q"` exited 0.

## Walkthrough
See `apps/console/doc/walkthrough_138.md`.

## Tasks
- [x] Workstream 1: Studio Ergonomics, Blank Canvas & Edge Quick-Insert
- [x] Workstream 2: Control Flow Nodes & Graph Invariants
- [x] Workstream 3: Full-Stack Contract Alignment (UI & Backend)
- [x] Workstream 4: Automated Verification & Documentation

## Enhancement
Future iterations can expand edge quick-split with an inline radial menu allowing instantaneous selection of node type directly upon clicking `+`.
