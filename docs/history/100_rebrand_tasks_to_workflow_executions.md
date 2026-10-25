# 100: Rebrand Tasks to Workflow Executions & Remove Synthetic Demo Backlog

## Problem
In Workstream 7 (Phase 31 follow-up), the terminology between tasks, workflow nodes, and execution instances required clarification.
A Task in the UI ledger is an execution unit of a runtime Workflow Execution instance, rather than a generic ad-hoc Kanban todo item or an isolated visual node. Retaining a synthetic "Manual Backlog" tab seeded with lorem-ipsum placeholder items (`tasks-mock.json`) created conceptual confusion.

## Plan
1. Rebrand the navigation item and page heading from **"Tasks"** to **"Workflow Executions"**.
2. Remove synthetic demo task fixtures (`tasks-mock.json`), dedicating the screen 100% to runtime workflow execution instances.
3. Replace the artificial "Workflow Tasks vs Manual Backlog" tabs with real execution lifecycle filters:
   - **All Executions**
   - **In Progress / Running**
   - **Completed**
   - **Failed / Action Required**
4. Update table headers (`Execution Unit / ID`, `Workflow Definition`) and inspector modal (`Workflow Execution Instance Details`).
5. Update monorepo planning artifacts ([`docs/integration_master_plan_iteration_4.md`](../integration_master_plan_iteration_4.md), [`apps/console/doc/implementation_plan_95.md`](../../apps/console/doc/implementation_plan_95.md), [`apps/console/doc/walkthrough_95.md`](../../apps/console/doc/walkthrough_95.md)).

## Changes Made
- `apps/console/src/components/layout/data/sidebar-data.ts`: Renamed sidebar navigation item to **Workflow Executions** (`t('sidebar.items.workflowExecutions', 'Workflow Executions')`).
- `apps/console/src/locales/en/console.json` & `vi/console.json`: Synchronized `workflowExecutions` keys.
- `apps/console/src/features/tasks/data/tasks.ts`: Replaced synthetic `tasks-mock.json` dependencies with pure workflow execution records (`order-fulfillment-v1`, `checkout-pipeline-v2`, `invoice-billing-v1`, `batch-etl-v3`, `subscription-billing-v1`).
- `apps/console/src/features/tasks/index.tsx`: Rebranded page to **Workflow Executions** and added lifecycle filter tabs (**All**, **In Progress**, **Completed**, **Failed**).
- `apps/console/src/features/tasks/components/tasks-columns.tsx`: Renamed columns to `Execution Unit / ID` and `Workflow Definition`.
- `apps/console/src/features/tasks/components/task-payload-inspector-dialog.tsx`: Rebranded to **Workflow Execution Instance Details**.
- Monorepo and app plans: Updated `docs/integration_master_plan_iteration_4.md`, `apps/console/doc/implementation_plan_95.md`, and `apps/console/doc/walkthrough_95.md`.

## Verification
- Unit tests:
  - `pnpm --filter @acc/console exec vitest run src/features/tasks` (3/3 tests passed).
  - `pnpm --filter @acc/console exec vitest run src/features/metadata/components/studio` (12/12 tests passed).
- Integration test suite: 40/40 test files passed across `@acc/console`.
