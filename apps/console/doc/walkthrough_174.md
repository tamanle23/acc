# Walkthrough 174 - Backend SSOT for Task Contracts & In-Memory Preloaded Registry

## 1. Executive Summary
We eliminated duplicated client-side JSON Schema definitions by establishing the **Backend as the Single Source of Truth (SSOT)** for task contracts. The workflow engine backend and unified sandbox platform serve canonical built-in contracts via `/v1/workflow/task-definitions`, which are preloaded into client in-memory cache upon route/query entry. This guarantees **60 FPS synchronous canvas rendering** in React Flow while surfacing all 24 built-in nodes in the Task Definitions Catalog with interactive read-only inspect capabilities and 1-click custom draft forking.

---

## 2. Key Architecture & Implemented Components

### A. Authoritative Backend & Sandbox Task Contract Exposure
- **Backend SSOT Registry (`TaskDefinitionRegistry.java`)**:
  - `listLatest()` synthesizes and prepends all 24 canonical system task contracts from `BuiltInTaskContracts.getContracts()` as immutable `v1 ACTIVE SYSTEM` task definition records.
  - `resolve()` provides fallback to `BuiltInTaskContracts` for version 1 if not overridden by custom tenant versions.
- **Unified Sandbox Platform (`workflow-handler.ts`)**:
  - `WorkflowTaskDefinitionsSandboxRepository.listLatest()` generates canonical `TaskDefinitionRecordIR` entries for all 24 built-in contracts (`isBuiltIn: true`, `tenantId: 'SYSTEM'`).
  - Guards `deleteDraftVersion()` to reject deletion of built-in system task definitions.

### B. Client-Side Preloaded In-Memory Registry
- **Dynamic Hydration (`task-contract-registry.ts`)**:
  - Implemented `preload(records: TaskDefinitionRecord[])`: Converts JSON Schemas from backend records into `NodeDataContract` entries in a synchronous `Map<DagNodeType, NodeDataContract>`.
  - Implemented `hasPreloaded()` and `isBuiltIn(taskType)`.
  - Preserved synchronous $O(1)$ lookups for canvas nodes and port badges without duplicate static schema definitions.
- **Query Auto-Preloading (`task-definition-api.ts`)**:
  - `useTaskDefinitions()` query function executes `taskContractRegistry.preload(list)` on receipt of backend data.
  - Categorizes built-in tasks (`AI`, `SYSTEM`, `COMMERCE`, etc.).

### C. Task Definitions Catalog Read-Only & Forking UI
- **Table Columns (`task-definition-columns.tsx`)**:
  - Renders distinctive `BUILT-IN` glass badge for system tasks.
  - "Inspect Contract" is universally available for **both Custom Task Definitions and Built-in System Tasks**, allowing instant read-only schema inspection and sandbox testing without forcing an edit or fork state.
  - Custom tasks also expose "Edit Draft" (if DRAFT) or "Fork Next Version" (if ACTIVE), "Version History", and draft publishing/deletion.
- **Inspect Mode in Dialog (`task-definition-editor-dialog.tsx`)**:
  - Supports `mode === 'inspect'` for both built-in system nodes (with `BUILT-IN (READ-ONLY)` badge) and custom task definitions (with `v{version}` and `{status} (READ-ONLY)` badges).
  - Retains full interactive access to **Input Schema**, **Output Schema**, and the **Schema Test Sandbox**.
  - Footer dynamically provides "Close", "Edit Draft" (for custom drafts), and "Fork Next Version" / "Fork as Custom Draft".
- **Grouped Catalog View & Scope Switching (`task-definition-table.tsx`)**:
  - Segregates tasks into **Custom Task Definitions** (tenant-specific workers/contracts) and **Built-in System Tasks** (canonical platform contracts).
  - Scope Switcher Tabs: `All Tasks` (total count), `Custom Definitions` (custom count), `Built-in System` (built-in count).
  - When in `All Tasks` view, built-in system tasks are rendered in a distinct, collapsible Liquid Glass section with a collapse toggle so users can focus on their custom tasks without being overwhelmed by 24 system nodes.
  - Shared search and faceted status filters apply across both partitioned tables simultaneously.
- **Workspace Master View (`workflows/index.tsx`)**:
  - Connects `handleForkDraft` and auto-switches to `inspect` mode when editing built-in definitions.

---

## 3. Verification Results

| Test Suite | File / Scope | Tests Passed | Status |
| :--- | :--- | :--- | :--- |
| **Task Contract Registry** | `task-contract-registry.test.ts` | 11 / 11 passed | ✅ 100% Green |
| **Task Definition UI Table** | `task-definition-table.test.tsx` | 6 / 6 passed | ✅ 100% Green |
| **Task Definition Editor** | `task-definition-editor.test.tsx` | 6 / 6 passed | ✅ 100% Green |
| **DAG Studio Palette** | `dag-palette.test.tsx` | 3 / 3 passed | ✅ 100% Green |
| **Sandbox Platform Engine** | `@acc/sandbox` (12 suites) | 109 / 109 passed | ✅ 100% Green |
| **Backend Workflow Engine** | `workflow-engine/pom.xml` | Java 21 / Maven 3.9.9 tests | ✅ 100% Green |
| **TypeScript Typecheck** | `@acc/console` | 0 errors (`tsc --noEmit`) | ✅ 100% Green |

---

## 4. Next Steps
- Implement dynamic worker fleet auto-registration with backend task definition reconciliation on deployment.
