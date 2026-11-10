# Console Implementation Plan - Iteration 174
# Backend SSOT for Task Contracts & Preloaded Registry

## 1. Executive Summary
This implementation plan establishes the Backend as the Single Source of Truth (SSOT) for all task contracts (built-in and worker-defined), preloading the client-side registry into memory for zero-latency 60 FPS canvas rendering (eliminating hardcoded duplicate schemas), and displaying built-in nodes in read-only/inspect mode in the Task Definitions Catalog.

---

## 2. Technical Details & Component Signatures

### 2.1 Backend / Sandbox SSOT Contract Synthesis
- `packages/sandbox/src/handlers/workflow-handler.ts`:
  - `WorkflowTaskDefinitionsSandboxRepository.listLatest()` merges `SANDBOX_TASK_CONTRACTS` as immutable read-only records (`tenantId: 'SYSTEM'`, `status: 'ACTIVE'`, `isBuiltIn: true`).
  - Guards against deleting or mutating built-in system task definitions.
- `apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/TaskDefinitionController.java` & `TaskDefinitionRegistry.java`:
  - Returns canonical `BuiltInTaskContracts` merged with tenant tasks in `GET /api/v1/workflow/task-definitions`.

### 2.2 Client-Side Dynamic Hydration Engine
- `apps/console/src/features/workflows/components/studio/utils/contracts/task-contract-registry.ts`:
  - Strips 400+ lines of duplicate static schemas.
  - Implements `preload(records: TaskDefinitionRecord[])`: Dynamically populates in-memory `contracts` map from backend authoritative response.
- `apps/console/src/features/workflows/api/task-definition-api.ts`:
  - Invokes `taskContractRegistry.preload(list)` on successful query resolution.

### 2.3 Task Definitions Catalog Read-Only UI
- `apps/console/src/features/workflows/components/task-definitions/task-definition-columns.tsx`:
  - Renders `BUILT-IN` glass badge for system tasks.
  - Actions: "Inspect Contract" (read-only view), "Fork as Draft" (creates user draft from built-in template), disables "Delete Draft".
- `apps/console/src/features/workflows/components/task-definitions/task-definition-editor-dialog.tsx`:
  - Adds `mode === 'inspect'` support where configuration fields are locked, but Input Schema, Output Schema, and Test Sandbox are fully interactive.
- `apps/console/src/features/workflows/components/task-definitions/task-definition-table.tsx`:
  - Adds facet filter for scope (`All Tasks`, `Built-in System`, `Custom Worker`).

---

## 3. Verification Plan
- Unit tests: `task-definition-table.test.tsx`, `task-definition-editor.test.tsx`, `task-contract-registry.test.ts`.
- Sandbox offline parity: `pnpm --filter @acc/sandbox test`.
- Studio regression tests: `pnpm --filter @acc/console test "dag-palette|visual-dag-studio"`.
