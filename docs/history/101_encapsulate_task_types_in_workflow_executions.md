# 101: Encapsulate Internal Task Types and Add Active Step to Workflow Executions

## Problem
In Workstream 7 (Phase 31 & 32 architectural alignment), the Workflow Executions table inappropriately exposed a `Type` column showing low-level node execution mechanisms (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `WAIT`, `DO_WHILE`). 
In workflow orchestration, a **Task is an internal execution implementation of a node type** dispatched by the decider engine—it should not be exposed directly to users in the primary execution ledger. Users monitor Workflow Executions and their milestones, not low-level scheduler task types.

## Plan
1. Remove the `Type` column from `tasksColumns` in `apps/console/src/features/tasks/components/tasks-columns.tsx`.
2. Introduce an **Active Step / Milestone** column (`activeStep`), indicating the current graph frontier in the DAG (e.g. `expressCourier`, `Completed (All Steps)`).
3. Rebrand the palette in Visual DAG Studio from **"Task Palette"** to **"Node Palette"** in `apps/console/src/features/metadata/components/studio/dag-palette.tsx`.
4. Update `workflowExecutionSchema` and seed data to represent clean workflow execution instances with `activeStep`.
5. Update monorepo master plan `docs/integration_master_plan_iteration_4.md` and app walkthrough `apps/console/doc/walkthrough_95.md`.

## Changes Made
- `apps/console/src/features/tasks/data/schema.ts`: Added `activeStep` field and marked internal `taskType` as optional telemetry.
- `apps/console/src/features/tasks/data/schema.test.ts`: Verified `workflowExecutionSchema` validation with `activeStep`.
- `apps/console/src/features/tasks/data/tasks.ts`: Seeded realistic workflow execution instances with `activeStep` milestones.
- `apps/console/src/features/tasks/components/tasks-columns.tsx`: Replaced `Type` column with `Active Step / Milestone` badge.
- `apps/console/src/features/metadata/components/studio/dag-palette.tsx`: Rebranded to **Node Palette**.
- `apps/console/src/features/metadata/components/studio/dag-palette.test.tsx`: Verified palette assertions.
- `docs/integration_master_plan_iteration_4.md`: Updated table columns and formalized the encapsulation invariant.
- `apps/console/doc/walkthrough_95.md`: Updated changes summary and verification details.

## Verification
- Unit tests:
  - `pnpm --filter @acc/console exec vitest run src/features/tasks` (3/3 tests passed).
  - `pnpm --filter @acc/console exec vitest run src/features/metadata/components/studio` (12/12 tests passed).
- All 40 console test files passing.
