# Console & Sandbox Implementation Plan - Iteration 172: Dynamic Task Definition Catalog & Node Version Upgrade Badge

## Problem Statement
The Visual DAG Studio palette previously hardcoded fixed node types and relied on a fragile worker catalog endpoint that failed when workers were offline. In addition, workflow nodes lacked pinned task definition versioning and upgrade paths when newer task schemas were published.

## Proposed Changes

### 1. Unified Sandbox Handlers (`packages/sandbox`)
- Update `packages/sandbox/src/handlers/workflow-handler.ts`:
  - Add `workflowTaskDefinitionsRepo` to persist versioned task definitions in offline sandbox mode.
  - Implement endpoints:
    - `GET /api/v1/workflow/task-definitions`
    - `GET /api/v1/workflow/task-definitions/:name/versions/:version`
    - `POST /api/v1/workflow/task-definitions` (hard-forks new draft)
    - `POST /api/v1/workflow/task-definitions/:name/versions/:version/publish`
  - Seed built-in domain tasks (`validateOrder`, `checkInventory`, etc.) with initial `v1` schemas.

### 2. Frontend API & Contract Registry (`apps/console`)
- Create `apps/console/src/features/workflows/api/task-definition-api.ts`:
  - React Query hooks: `useTaskDefinitions()`, `useTaskDefinitionVersions()`, `useForkTaskDefinition()`, `usePublishTaskDefinition()`.
- Update `apps/console/src/features/workflows/components/studio/utils/contracts/task-contract-registry.ts`:
  - Support `TaskDefinitionContract` alongside built-in types.

### 3. Studio Palette & Node Upgrade UI (`apps/console`)
- Update `apps/console/src/features/workflows/components/studio/palette/dag-palette.tsx`:
  - Integrate catalog task definitions under a dedicated palette section ("Task Definitions & Custom Tasks").
  - Allow dragging and clicking to insert pre-configured `SIMPLE` tasks with pinned `taskDefName` and `taskDefVersion`.
- Update `apps/console/src/features/workflows/components/studio/canvas/dag-node.tsx`:
  - Render an Upgrade Badge if `catalogLatestActiveVersion > node.taskDefVersion`.
  - Provide a Schema Diff Modal to inspect property additions/removals and upgrade node version with 1 click.

## Verification
- Vitest unit tests for sandbox repository and task definition hooks.
- Component tests for DAG palette dynamic items and node upgrade badge rendering.
