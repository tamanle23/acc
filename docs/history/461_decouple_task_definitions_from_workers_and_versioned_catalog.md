# History Entry 461: Decouple Task Definitions from Workers & Versioned Catalog

## Problem
In the previous architecture, Task Definitions were coupled with Task Worker registration. Worker processes declared both runtime execution capacity and static task definitions (JSON Schemas, descriptions, timeouts). This created multiple operational liabilities:
1. Workflow authors could not visually discover or bind custom tasks until worker instances were online and connected.
2. Updating a task definition schema required redeploying worker processes.
3. Workers could overwrite or pollute the definition contracts across tenants.
4. Workflow nodes lacked immutable version pinning, making historical executions and schema evolutions fragile.

## Plan
Decouple Task Definitions into a first-class, versioned entity in the workflow domain while slimming worker registration to capacity and capability telemetry:
1. **Persistence & Migration**: Create `workflow_task_definitions` table in PostgreSQL and SQLite with composite primary key `(tenant_id, name, version)`, schema storage, execution defaults, and audit metadata. Track `task_def_name` and `task_def_version` in `task_executions`.
2. **Engine Domain & Registry**: Implement `TaskDefinitionRegistry` supporting domain seeding, immutable `ACTIVE` records, hard-fork `DRAFT` creation, and promotion/deprecation lifecycles.
3. **REST Endpoints**: Expose `/api/v1/workflow/task-definitions` and refactor `TaskContractController` to pull from the definition registry with worker fallback. Slim `SimpleTaskWorkerRegistrar` to declare capacity only.
4. **Unified Sandbox Parity**: Implement `WorkflowTaskDefinitionsSandboxRepository` and route handlers in `packages/sandbox`.
5. **Visual DAG Studio Integration**: Provide dynamic "Task Definitions Catalog" in `DagPalette`, render pinned version pills and upgrade badges in `DagNode`, and build `TaskVersionDiffModal` for one-click schema migrations.

## Changes
### Backend
- `apps/api/acc-db/src/main/resources/db/acc/changelog-000.000.00021.xml`: Liquibase migration for `workflow_task_definitions` table and `task_executions` columns.
- `apps/api/acc-db/src/main/resources/db/acc/changelog-master.xml`: Included changelog 21.
- `apps/api/workflow-engine/src/main/resources/db/schema-postgres.sql`: Added `workflow_task_definitions` and `task_executions` columns.
- `apps/api/workflow-engine/src/main/resources/db/schema-sqlite.sql`: Added `workflow_task_definitions` and `task_executions` columns.
- `apps/api/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskDefinitionRecord.java`: First-class record with builder and immutable defaults.
- `apps/api/workflow-engine/src/main/java/com/acc/workflow/ports/PersistencePort.java`: Added task definition CRUD and versioning contracts.
- `apps/api/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/InMemoryPersistenceAdapter.java`: Implemented task definition methods.
- `apps/api/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/PostgresJdbcPersistenceAdapter.java`: Implemented PostgreSQL persistence with JSONB.
- `apps/api/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/SqliteJdbcPersistenceAdapter.java`: Implemented SQLite persistence.
- `apps/api/workflow-engine/src/main/java/com/acc/workflow/application/TaskDefinitionRegistry.java`: Implemented registry with seeding and hard-fork versioning.
- `apps/api/workflow-engine/src/main/java/com/acc/workflow/worker/TaskWorkerDescriptor.java`: Added capacity-only constructor.
- `apps/api/acc-ms-aio/src/main/java/com/acc/aio/config/WorkflowEngineConfiguration.java`: Registered `TaskDefinitionRegistry` bean.
- `apps/api/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/TaskDefinitionController.java`: Added REST controller for task definitions.
- `apps/api/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/TaskContractController.java`: Refactored to fetch dynamic schema contracts from registry.
- `apps/api/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/SimpleTaskWorkerRegistrar.java`: Refactored workers to capacity-only descriptors.

### Sandbox & Frontend
- `packages/sandbox/src/handlers/workflow-handler.ts`: Added stateful repository, seed catalog, and route handlers.
- `apps/console/src/features/workflows/api/task-definition-api.ts`: React Query hooks for task definitions with context fallback.
- `apps/console/src/features/workflows/components/studio/canvas/dag-node.tsx`: Version pill and upgrade badge rendering.
- `apps/console/src/features/workflows/components/studio/modals/task-version-diff-modal.tsx`: Schema diff modal component.
- `apps/console/src/features/workflows/components/studio/palette/dag-palette.tsx`: Dynamic Task Definitions Catalog accordion category.
- `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`: Wired node upgrade triggers and diff modal.

## Verification
- **Backend Tests**:
  - `TaskDefinitionRegistryTest`: 3/3 passed.
  - `PersistenceContractTest` (`InMemoryPersistenceTest` & `SqlitePersistenceTest`): 8/8 passed.
  - Full `workflow-engine` suite: 92/92 passed.
  - `TaskDefinitionControllerTest`: 2/2 passed.
  - `TaskContractControllerTest`: 2/2 passed.
  - Reactor compilation: BUILD SUCCESS across all 9 backend modules.
- **Frontend & Sandbox Tests**:
  - `@acc/sandbox` tests (`workflow-task-definitions.test.ts`): 109/109 passed.
  - `@acc/console` tests (`visual-dag-studio-modes.test.tsx`, `dag-palette.test.tsx`, `visual-dag-studio-2.test.tsx`, `dag-node.test.tsx`, `task-contract-registry.test.ts`): all passed.

## Walkthrough
- Backend Companion Walkthrough: `apps/api/doc/walkthrough_164.md`
- Console Companion Walkthrough: `apps/console/doc/walkthrough_172.md`
- Master Plan: `docs/iterations/master_implementation_plan_iteration_75.md`

## Tasks
- [x] Phase 1: Database Migration & Persistence Layer
- [x] Phase 2: Task Definition Application Service & REST API
- [x] Phase 3: Engine Execution Models Decoupling
- [x] Phase 4: Unified Sandbox Platform Integration
- [x] Phase 5: Visual DAG Studio Catalog & Version Upgrade UI
- [x] Phase 6: Full Verification & Automated Tests
- [x] Phase 7: History Archival & Git Commit

## Enhancement
- Future iterations can introduce visual branch diffing inside `TaskVersionDiffModal` for automated AST transformation between breaking parameter changes.
- Add Canary Rollout policies allowing a workflow definition to execute v2 for 10% of runs while pinning v1 for 90%.
