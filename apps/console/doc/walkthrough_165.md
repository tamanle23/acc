# Walkthrough 165 - Backend Canonical Blank Workflow Initialization & Connector Fix

## Architectural Root Cause & Decision
When creating a new workflow:
1. The frontend should **not** fabricate ad-hoc tasks or layout structures in UI dialogs.
2. The **backend is the single source of truth**: when registering a new workflow definition with empty tasks, the backend must initialize the canonical blank workflow containing both boundary nodes (`workflow_start` and `workflow_end`) along with their coordinate layout metadata, and return the initialized definition to the client.
3. The Unified Sandbox (`@acc/sandbox`) must mirror this behavior exactly to maintain 100% offline development parity.
4. On the UI side, the `decoratedNodes` memo in `visual-dag-studio.tsx` had an inversion bug where an isolated start node with 0 outgoing edges was marked `isEndNode = degOut === 0` (`true`), which suppressed its source handle (`{!data.isEndNode && <Handle type="source" />}`).

## Changes Implemented

### 1. Backend Single Source of Truth
- **`WorkflowDefinition.java`**:
  - Added factory method `WorkflowDefinition.createBlank(workflowKey, name, description)` initializing paired NOOP boundary tasks `workflow_start` and `workflow_end` with `isPermanent` and boundary flags in `layoutMetadata`.
- **`WorkflowDefinitionController.java`**:
  - In `registerDefinition()`, if `definition.tasks()` is null or empty, automatically delegates to `WorkflowDefinition.createBlank(...)`, validates topology via `AcyclicityGuard`, and registers the initialized definition.
- **`WorkflowEngineRestApiTest.java`**:
  - Added `@Test testRegisterBlankWorkflowInitializesStartAndEndNodes()` verifying `POST /api/v1/workflow/definitions` with empty tasks persists and returns both `workflow_start` and `workflow_end` nodes.

### 2. Unified Sandbox Offline Parity
- **`packages/sandbox/src/handlers/workflow-handler.ts`**:
  - In `WorkflowSandboxRepository.saveDefinition()`, if `def.tasks` is undefined or empty, initializes `workflow_start` and `workflow_end` with matching layout metadata.

### 3. Clean Frontend Dialog Integration
- **`WorkflowCreateDialog.tsx`**:
  - Cleaned up `handleCreate()` to simply send definition metadata (`{ workflowKey, name, description, tasks: [] }`). The backend generates and returns the initialized workflow.
- **`visual-dag-studio.tsx`**:
  - Fixed `decoratedNodes` so that an entry/start node (`workflow_start`, `node-start`, `data.isStartNode`) guarantees `isEndNode = false`, ensuring the right-side source handle is always rendered and never suppressed by an out-degree of 0.

## Verification
- **Backend Tests**: `pnpm --filter @acc/backend exec node mvnw.cjs -am -pl acc-ms-aio test "-Dtest=WorkflowEngineRestApiTest"` passed (2/2 tests, BUILD SUCCESS).
- **Sandbox Tests**: `pnpm --filter @acc/sandbox test` passed (11 test files, 103 tests).
- **Console Tests**: `pnpm --filter @acc/console exec vitest run src/features/workflows` passed (24 test files, 112 tests).
- **TypeScript**: `pnpm --filter @acc/console exec tsc --noEmit` passed with 0 errors.
