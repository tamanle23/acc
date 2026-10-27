# 195. Consistent Sandbox Data Across Workflows, Workflow Executions, and Dead-Letter Queues

## Problem
In offline/sandbox development mode, the mock datasets across the three interrelated workflow subsystems were disconnected:
1. **Disconnected Workflow Definitions & Executions:** In `data/workflow-executions.ts`, executions `wf_exec_9104` (`batch-etl-v3`) and `wf_exec_9105` (`subscription-billing-v1`) had no matching workflow definitions in `DEFAULT_DEFINITIONS`. Opening execution details or DAG Studio for these items failed to resolve node definitions.
2. **Disconnected Dead-Letter Queues:** In `dlq-sandbox-handler.ts`, `INITIAL_DLQ_SEED` referenced synthetic workflow keys (`wf-order-982`, `wf-content-441`, etc.) that did not exist in `workflowExecutions`. When an operator inspected a poisoned task in `/system/dlq`, the workflow execution was nowhere to be found in `/workflow-executions`.
3. **Missing Cross-Store Synchronization:** Replaying or discarding a poison task in DLQ only modified local in-memory DLQ state; it did not update the workflow execution status (from `FAILED` to `IN_PROGRESS` or `DISCARDED`) or the DAG execution graph nodes in `workflowSandboxRepo`.
4. **Empty DAG Graph Snapshots on Reset:** `workflowSandboxRepo.tenantExecutions` was left empty on reset, causing the execution detail drawer to have no runtime snapshot states for seeded tabular executions.

## Plan
1. Synchronize `workflowExecutions` dataset with 8 consistent enterprise workflow executions covering active, scheduled, completed, and DLQ-isolated states.
2. Expand `DEFAULT_DEFINITIONS` in `workflow-handler.ts` to include complete node topologies and layout metadata for all 8 workflows (`batch-etl-v3`, `subscription-billing-v1`, `content-enrichment-v1`, `inventory-sync-v1`, `audit-pipeline-v1`).
3. Align `INITIAL_DLQ_SEED` in `dlq-sandbox-handler.ts` so `dlq-101` through `dlq-104` map directly to `wf_exec_9105` through `wf_exec_9108` and their specific isolated task IDs.
4. Implement reactive bi-directional synchronization in `dlqSandboxRepo.replay()` and `dlqSandboxRepo.discard()` to automatically update `workflowExecutionsSandboxRepo` and `workflowSandboxRepo` active DAG nodes in real time.
5. Pre-populate `workflowSandboxRepo.tenantExecutions` with realistic node states (COMPLETED, IN_PROGRESS, FAILED, SCHEDULED) during repository reset.
6. Enhance console UI navigation:
   - Clickable `WF: <id>` links in DLQ table and inspector sheet to jump directly to `/workflow-executions`.
   - Distinctive DLQ badges (`DLQ: dlq-101 (ISOLATED/REPLAYED/DISCARDED)`) in workflow execution titles and row action dropdowns linking to `/system/dlq`.
7. Author comprehensive automated cross-store test suite in `@acc/sandbox`.

## Changes
- **`packages/sandbox/src/handlers/data/workflow-executions.ts`**: Updated and expanded 8 consistent workflow executions with exact definition keys, active steps, task IDs, and DLQ reference links (`dlqId`, `dlqStatus`).
- **`packages/sandbox/src/handlers/workflow-handler.ts`**:
  - Added full workflow definitions for `batch-etl-v3`, `subscription-billing-v1`, `content-enrichment-v1`, `inventory-sync-v1`, and `audit-pipeline-v1`.
  - Added global cross-tenant fallback to `workflowExecutionsSandboxRepo.getById()` and `workflowSandboxRepo.getExecution()`.
  - Pre-populated `tenantExecutions` with complete DAG task runtime snapshots matching `workflowExecutions`.
- **`packages/sandbox/src/handlers/dlq-sandbox-handler.ts`**:
  - Updated `INITIAL_DLQ_SEED` to reference `wf_exec_9105` through `wf_exec_9108`.
  - Implemented `syncWorkflowReplay` and `syncWorkflowDiscard` to update execution records and active DAG graph nodes upon replay/discard.
  - Exported `dlqSandboxRepo` singleton alias.
- **`apps/console/src/features/workflow-executions/schema.ts`**: Expanded `taskType` schema union to support extended task types (`HTTP`, `JDBC`, `KAFKA_PUBLISH`, `LLM_CHAT_COMPLETE`, etc.).
- **`apps/console/src/features/workflow-executions/components/workflow-executions-columns.tsx`**: Added clickable DLQ status badge linking to `/system/dlq` for executions with quarantined tasks.
- **`apps/console/src/features/workflow-executions/components/data-table-row-actions.tsx`**: Added "View in DLQ ({dlqId})" action item.
- **`apps/console/src/features/dlq/components/dlq-columns.tsx`**: Converted workflow ID text into a clickable link to `/workflow-executions`.
- **`apps/console/src/features/dlq/components/dlq-inspector-sheet.tsx`**: Added link with external icon navigating to the workflow execution.
- **`packages/sandbox/src/handlers/__tests__/workflow-dlq-consistency.test.ts`**: Added 4 automated integration tests verifying cross-store referential integrity and bi-directional replay synchronization.

## Verification
- Sandbox Unit & Integration Suites: `pnpm --filter @acc/sandbox test` (10/10 test files passed, 98/98 tests green).
- Sandbox Typecheck: `pnpm --filter @acc/sandbox check-types` (0 errors).
- Console Unit Tests: `pnpm --filter @acc/console test:run src/features/dlq/__tests__/dlq-feature.test.tsx src/features/workflow-executions/schema.test.ts src/features/workflows/__tests__/workflow-simulation-engine.test.ts src/features/workflows/__tests__/workflow-execution-stream.test.tsx src/features/workflow-executions/components/__tests__/workflow-ui-kpi-bars.test.tsx` (17/17 tests green).
- Console Typecheck: `pnpm --filter @acc/console exec tsc --noEmit` (0 errors).

## Walkthrough
1. Navigate to `/system/dlq`:
   - Inspect `dlq-101`: see execution `wf_exec_9105` for task `wf_exec_9105_chargeRecurringCard_att3`.
   - Click the workflow ID link to open `/workflow-executions`.
2. On `/workflow-executions`:
   - `wf_exec_9105` is listed with a red `DLQ: dlq-101 (ISOLATED)` badge and `FAILED` status.
   - Click "Inspect Execution": the detail drawer opens Visual DAG Studio showing `checkEntitlements` (COMPLETED), `chargeRecurringCard` (FAILED with timeout error), and subsequent tasks (SCHEDULED).
3. Back in `/system/dlq`:
   - Click "Replay" on `dlq-101`:
   - The task transitions to `REPLAYED`.
   - In `/workflow-executions`, `wf_exec_9105` automatically updates to `IN_PROGRESS` (attempt 4), error is cleared, and retryStatus is `RE-ENQUEUED`.
   - In Visual DAG Studio, `chargeRecurringCard` updates to `SCHEDULED`.

## Tasks
- [x] Unify seed IDs and definition keys across definitions, executions, and DLQ
- [x] Pre-populate DAG runtime execution graphs on sandbox reset
- [x] Implement bi-directional cross-store replay/discard reactive hooks
- [x] Add bi-directional navigation links and badges between DLQ and Executions
- [x] Verify all test suites pass with zero regressions
