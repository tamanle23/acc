# 110. Eliminate Workflow Executions Sandbox Matcher Collision & Consolidate Handler

**Date**: 2026-10-15  
**Author**: Antigravity  
**Status**: Completed  
**Scope**: `packages/sandbox`, `apps/console`

---

## 1. Problem Statement
In `@acc/sandbox`, two separate route handlers competed for `/workflow` paths:
1. `workflow-handler.ts`: Matched `cleanPath.startsWith('/workflow')` with priority 95.
2. `workflow-executions-sandbox-handler.ts`: Matched `cleanPath.startsWith('/workflow/executions') || cleanPath.startsWith('/workflow-executions')` with priority 80.

Because `workflow-handler` had a higher priority (95 vs 80) and matched all paths beginning with `/workflow`, any incoming requests to `/workflow/executions` (such as `GET /api/workflow/executions` from the console `useWorkflowExecutionsQuery`) were intercepted by `workflow-handler`. However, `workflow-handler` only implemented `POST /workflow/executions` and single-instance `GET /workflow/executions/{id}`, returning a `404` error for collection queries (`GET /workflow/executions`).

Furthermore, having two handlers managing execution data created architectural duplication and violated single-source-of-truth invariants.

---

## 2. Proposed Architecture & Solution Plan
1. **Migrate Execution Operations into `workflow-handler.ts`**:
   - Move `WorkflowExecutionsSandboxRepository` into `packages/sandbox/src/handlers/workflow-handler.ts` (using `workflowExecutions` from `./data/workflow-executions` and `WorkflowExecution` contract from `@acc/client`).
   - Re-export `WorkflowExecutionsSandboxRepository` and `workflowExecutionsSandboxRepo`.
   - Update `workflowSandboxHandler`:
     - Expand its matcher to support both `/workflow` and `/workflow-executions`.
     - Implement `GET /workflow/executions` and `GET /workflow-executions` to return the multi-tenant execution list from `workflowExecutionsSandboxRepo.getAll(tenantId)`.
     - Implement `POST /workflow/executions`: If the payload contains a task `title`, handle it as a record creation via `workflowExecutionsSandboxRepo.create(...)`; otherwise, start an orchestration execution instance via `workflowSandboxRepo.startExecution(...)`.
     - Implement single-record operations (`GET`, `PATCH`, `PUT`, `DELETE`) on both `/workflow/executions/{id}` and `/workflow-executions/{id}`.
     - Export backward-compatible alias: `workflowExecutionsSandboxHandler = workflowSandboxHandler`.
2. **Eliminate Redundant Source File**:
   - Delete `packages/sandbox/src/handlers/workflow-executions-sandbox-handler.ts`.
3. **Update Registry & Consoles**:
   - In `packages/sandbox/src/index.ts`, remove the import, export, and redundant registration of the deleted file.
   - In `apps/console/tsconfig.app.json`, remove the deleted file path from `"include"`.
4. **Verification**:
   - Run `@acc/sandbox` tests (`pnpm --filter @acc/sandbox test`).
   - Run `@acc/console` sandbox unit and integration tests (`pnpm --filter @acc/console test src/core/sandbox`).
   - Verify workflow executions schema tests (`src/features/workflow-executions/schema.test.ts`).

---

## 3. Implementation Details

### A. `packages/sandbox/src/handlers/workflow-handler.ts`
- Imported `workflowExecutions` from `./data/workflow-executions` and `ClientWorkflowExecution` from `@acc/client`.
- Implemented `WorkflowExecutionsSandboxRepository` with multi-tenant partitioning (`SYSTEM`, `tenant-acme`, `tenant-us-east-1`) and automatic registration in `sandboxResetRegistry`.
- Updated `workflowSandboxHandler`:
  - Matcher: `cleanPath.startsWith('/workflow') || cleanPath.startsWith('/workflow-executions')`.
  - Added support for `GET` on `/workflow/executions` and `/workflow-executions`.
  - Unified `POST` handling for both tabular execution records and DAG executions.
  - Added unified `GET`, `PATCH`, `PUT`, and `DELETE` handling for `/workflow/executions/{id}` and `/workflow-executions/{id}`.
  - Exported `workflowExecutionsSandboxHandler = workflowSandboxHandler` alias for zero-breaking-change backwards compatibility.

### B. `packages/sandbox/src/index.ts`
- Cleaned up exports and removed redundant registration:
  - Removed `export * from './handlers/workflow-executions-sandbox-handler'`.
  - Removed `import { workflowExecutionsSandboxHandler } ...` from `./handlers/workflow-executions-sandbox-handler`.
  - Removed duplicate `sandboxRegistry.register(workflowExecutionsSandboxHandler)`.

### C. Deletion & Config Cleanup
- Deleted `packages/sandbox/src/handlers/workflow-executions-sandbox-handler.ts`.
- Removed reference to the deleted file from `"include"` in `apps/console/tsconfig.app.json`.

---

## 4. Verification
1. **`@acc/sandbox` test suite**:
   - Added assertions to `packages/sandbox/src/__tests__/sandbox-engine.test.ts` verifying both `GET /api/v1/workflow/executions` and `GET /api/workflow-executions` return status 200 with arrays of executions.
   - Executed `pnpm --filter @acc/sandbox test` -> 2 test files, 9 tests passed (100%).
   - Ran `npx tsc --noEmit -p packages/sandbox/tsconfig.json` -> 0 type errors.
2. **`@acc/console` sandbox tests**:
   - Executed `pnpm --filter @acc/console test src/core/sandbox` -> 10 test files, 65 tests passed (100%).
   - Executed `pnpm --filter @acc/console test src/features/workflow-executions` -> 1 test file, 3 tests passed (100%).
