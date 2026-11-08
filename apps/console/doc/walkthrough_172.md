# Console & Sandbox Walkthrough: Versioned Task Definitions Catalog & Studio Integration

## Overview
This walkthrough summarizes the console UI and sandbox changes implemented in iteration 172 (`master_implementation_plan_iteration_75.md`), establishing dynamic Task Definition discovery in Visual DAG Studio, node pinned version bindings, in-canvas upgrade badges with schema diff modals, and offline sandbox parity.

---

## 1. Unified Sandbox Platform (`packages/sandbox`)
- **WorkflowTaskDefinitionsSandboxRepository**:
  - Implemented stateful repository with tenant isolation and seed catalog records (`validateOrder`, `checkInventory`, `chargePayment`, `expressCourier`, `groundPostal`, `cancelCourierBooking`, `publishCmsArticle`).
  - Added hard-fork draft creation, publishing, and draft deletion logic matching backend semantics.
- **Route Handlers**:
  - `GET /v1/workflow/task-definitions`: Returns latest task definitions for active tenant.
  - `GET /v1/workflow/task-definitions/:name/versions`: Returns all version records.
  - `POST /v1/workflow/task-definitions/draft`: Creates next DRAFT version.
  - `POST /v1/workflow/task-definitions/:name/versions/:version/publish`: Promotes to ACTIVE and deprecates older versions.
  - `DELETE /v1/workflow/task-definitions/:name/versions/:version`: Deletes draft versions.
  - `GET /tasks/contracts`: Merges dynamic catalog task definitions into the unified contracts endpoint.
- **Unit Test Suite**:
  - Created `packages/sandbox/src/handlers/__tests__/workflow-task-definitions.test.ts`.
  - Verified: 109/109 tests passing in `@acc/sandbox`.

---

## 2. Console React UI & Studio Integration (`apps/console`)
- **API Client Hooks** (`task-definition-api.ts`):
  - `useTaskDefinitions`: Queries latest active definitions with graceful fallback when rendered outside `QueryClientProvider`.
  - `useTaskDefinitionVersions`: Queries version history for a task.
  - `useSaveTaskDefinitionDraft`: Mutation to create or edit drafts.
  - `usePublishTaskDefinition`: Mutation to promote draft to active.
  - `useUpgradeNodeTaskDef`: Mutation to upgrade workflow node task definition version.
- **DagPalette Component** (`dag-palette.tsx`):
  - Added dynamic "Task Definitions Catalog" category above built-in categories.
  - Renders draggable catalog items with pre-populated `taskDefName`, `taskDefVersion`, schemas, and timeouts.
  - Preserved static `CATEGORIES` array length (5) for backwards compatibility.
- **DagNode Component** (`dag-node.tsx`):
  - Displays version pill `v{taskDefVersion}` for catalog-bound task nodes.
  - Renders amber Upgrade Badge when `latestTaskDefVersion > taskDefVersion`.
  - Clicking upgrade opens the one-click Schema Diff Modal.
- **TaskVersionDiffModal** (`task-version-diff-modal.tsx`):
  - Liquid Glass styled dialog showing side-by-side or unified JSON diff between current pinned version schema and latest active version schema.
  - Displays changelog note, publisher metadata, and "Confirm Upgrade to vX" button.
- **Visual DAG Studio** (`visual-dag-studio.tsx`):
  - Integrated `useTaskDefinitions()` query.
  - Automatically decorates nodes with latest active version numbers from the catalog.
  - Bound upgrade handler to node data and integrated modal state.

---

## 3. Verification & Testing
- Vitest suite in `apps/console`:
  - `visual-dag-studio-modes.test.tsx`: 9/9 passed.
  - `dag-palette.test.tsx`: 3/3 passed.
  - `visual-dag-studio-2.test.tsx`: 3/3 passed.
  - `dag-node.test.tsx`: 13/13 passed.
  - `task-contract-registry.test.ts`: 9/9 passed.
- Vitest suite in `packages/sandbox`:
  - `workflow-task-definitions.test.ts`: 4/4 passed.
