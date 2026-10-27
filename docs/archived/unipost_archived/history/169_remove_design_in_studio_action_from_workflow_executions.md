# 169 - Remove "Design in Studio" Action from Workflow Execution Row Level

## Problem Statement
The user requested the removal of the `"Design in Studio"` row-level action from the `/workflow-executions` data table. When inspecting or managing runtime execution instances, navigating to authoring/designing the workflow definition is conceptually out of place; operators should only inspect runtime snapshots (`Inspect Execution`) or monitor real-time SSE execution (`Live Execution Stream`).

## Solution Plan
1. In `apps/console/src/features/workflow-executions/components/data-table-row-actions.tsx`:
   - Remove the `Design in Studio` `<DropdownMenuItem>`.
   - Remove the `handleOpenStudio` handler and unused `SlidersHorizontal` icon import and `useNavigate` hook.
2. Run TypeScript compilation (`tsc --noEmit`) and Vitest test suites.

## Changes Made
- `apps/console/src/features/workflow-executions/components/data-table-row-actions.tsx`:
  - Removed `SlidersHorizontal` and `useNavigate` imports.
  - Removed `handleOpenStudio` method.
  - Removed `Design in Studio` dropdown menu item.

## Verification
- Vitest: `useWorkflowExecutionStream` suite exits 0 (2/2 passing).
- TypeScript compiler: `tsc --noEmit` exits 0 (0 errors).
