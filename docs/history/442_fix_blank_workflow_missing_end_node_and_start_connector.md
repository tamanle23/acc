# 442 - Fix Blank Workflow Missing End Node and Start Connector Handle

## Problem
In `@acc/console`'s Visual DAG Studio:
1. When creating a new workflow from the catalog dialog, the definition only contained a single task (`startTask`) without a corresponding terminal `workflow_end` node.
2. The initial start node lacked an outgoing connector handle (source port) on its right edge, blocking users from connecting new tasks to it.
3. In `visual-dag-studio.tsx`, `decoratedNodes` calculated `isStartNode = degIn === 0` and `isEndNode = degOut === 0`. Because the start node had 0 outgoing edges, `isEndNode` evaluated to `true`, which hid the source handle (`{!data.isEndNode && <Handle type="source" />}`).

## Changes
- `apps/console/src/features/workflows/components/catalog/workflow-create-dialog.tsx`:
  - Updated `handleCreate()` to initialize blank workflows with paired boundary tasks `workflow_start` and `workflow_end` at positions (100, 200) and (500, 200) with `isPermanent` layout metadata.
- `apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.ts`:
  - Handled `ir.tasks.length === 0` by returning canonical `BLANK_WORKFLOW_NODES` and `BLANK_WORKFLOW_EDGES`.
  - Added legacy healing for definitions with a solitary start task, automatically complementing with `workflow_end` and linking them sequentially.
  - Normalized boundary node display labels to `'Workflow Start'` and `'Workflow End'`.
- `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`:
  - Refactored `decoratedNodes` so that explicit start nodes guarantee `isEndNode = false`, ensuring the right source handle is always rendered and never suppressed by an out-degree of 0.
- `apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.test.ts`:
  - Added unit test coverage for blank IR fallback and legacy single-start definitions.

## Verification
- `pnpm --filter @acc/console exec vitest run src/features/workflows` passed (24 test files, 112 passed).
- `pnpm --filter @acc/console exec tsc --noEmit` passed with 0 errors.
