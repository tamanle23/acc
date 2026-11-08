# 466 - Backend SSOT Task Contracts & In-Memory Preloaded Registry

## Problem
In the Visual DAG Studio and Workflow Task Definitions Catalog:
1. Canonical task schemas for built-in nodes (e.g. `HTTP`, `LLM_CHAT_COMPLETE`, `CALL_MCP_TOOL`, `KAFKA_PUBLISH`, etc.) were hardcoded client-side in `task-contract-registry.ts` (~400 lines of duplicated schema AST), violating the Single Source of Truth (SSOT) principle with backend `BuiltInTaskContracts.java`.
2. Built-in nodes did not appear in the Task Definitions Catalog, giving users no direct visibility into built-in parameters, schemas, or test sandboxes, nor an easy mechanism to clone/fork them as customizable tenant drafts.

## Plan
1. Establish Backend as Single Source of Truth (SSOT) by exposing all canonical built-in contracts via `/v1/workflow/task-definitions` in both the Java workflow engine (`TaskDefinitionRegistry.java`) and the Unified Sandbox Platform (`workflow-handler.ts`).
2. Implement dynamic client-side preloading in `task-contract-registry.ts` (`preload()`), stripping hardcoded schemas while maintaining $O(1)$ memory lookups for 60 FPS synchronous canvas rendering without visual jitter.
3. Automatically preload the registry within `useTaskDefinitions()` query lifecycle.
4. Expose built-in tasks in the Task Definitions Catalog with a `BUILT-IN` badge, read-only "Inspect Contract" view, disabled draft mutation/deletion, live schema testing sandbox, and 1-click "Fork as Custom Draft" action.
5. Create comprehensive automated unit and integration tests across console, studio, and sandbox platforms.

## Changes
- **Backend Workflow Engine (`apps/backend/workflow-engine`)**:
  - `TaskDefinitionRegistry.java`: `listLatest()` now prepends all 24 built-in contracts from `BuiltInTaskContracts.getContracts()` as canonical `v1 ACTIVE SYSTEM` task definitions with `isBuiltIn: true`.
- **Unified Sandbox Platform (`packages/sandbox`)**:
  - `workflow-handler.ts`: `WorkflowTaskDefinitionsSandboxRepository` synthesizes all 24 built-in contracts from `SANDBOX_TASK_CONTRACTS` into `TaskDefinitionRecordIR` entries (`tenantId = 'SYSTEM'`, `status = 'ACTIVE'`, `isBuiltIn = true`).
  - Added guard in `deleteDraftVersion()` to reject deletion of built-in system task definitions.
- **Client Dynamic Registry (`apps/console`)**:
  - `task-contract-registry.ts`: Added `preload(records: TaskDefinitionRecord[])`, `hasPreloaded()`, and `isBuiltIn(taskType: string)`. Removed duplicate static schema definitions.
  - `task-definition-api.ts`: Updated `TaskDefinitionRecord` type with `isBuiltIn?: boolean`, hooked `taskContractRegistry.preload(list)` in `useTaskDefinitions()`, and classified built-ins under `AI` or `SYSTEM` categories.
- **Catalog UI & Inspect Mode (`apps/console`)**:
  - `task-definition-columns.tsx`: Renders `BUILT-IN` glass badge; offers "Inspect Contract" for both custom and built-in task definitions, "Fork as Custom Draft", "Edit Draft", "Fork Next Version", and lifecycle actions.
  - `task-definition-table.tsx`: Groups task definitions into **Custom Task Definitions** and **Built-in System Tasks** sections. Adds scope tabs (`All Tasks`, `Custom Definitions`, `Built-in System`) with item counts, a collapsible toggle for built-in contracts, and shared filter synchronization.
  - `task-definition-editor-dialog.tsx`: Added universal `mode === 'inspect'` with context-aware read-only badges, lock banner alerts, disabled inputs and schema grids, live test sandbox access, and custom draft fork/edit buttons.
  - `workflows/index.tsx`: Wired `handleInspectTaskDef`, `handleForkDraft`, and clean scope routing.
- **Automated Tests**:
  - `task-contract-registry.test.ts`: Added preloading verification, $O(1)$ lookup tests, and `isBuiltIn` classification tests.
  - `task-definition-table.test.tsx`: Added tests verifying built-in tasks render `BUILT-IN` badge, inspect actions for custom and built-in tasks, grouped sections, and scope switcher navigation.

## Verification
- `pnpm --filter @acc/console test -- task-contract-registry`: 11 passed.
- `pnpm --filter @acc/console test -- task-definition`: 12 passed across 2 suites.
- `pnpm --filter @acc/console test -- dag-palette`: 3 passed.
- `pnpm --filter @acc/sandbox test`: 109 tests across 12 suites passed.
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
- Java Backend: `workflow-engine` tests passed (Java 21 / Maven 3.9.9).

## Walkthrough
Refer to `apps/console/doc/walkthrough_174.md` for detailed UI flows and component specifications.

## Tasks
- [x] Expose canonical built-in contracts from backend and sandbox repositories.
- [x] Strip duplicate client static schemas and implement preloaded in-memory cache.
- [x] Wire query-driven preloading on `/workflows` entry.
- [x] Render `BUILT-IN` badges and inspect actions in Task Definitions Catalog.
- [x] Support read-only inspect mode and 1-click fork in editor dialog.
- [x] Pass all automated test suites and typechecks.
