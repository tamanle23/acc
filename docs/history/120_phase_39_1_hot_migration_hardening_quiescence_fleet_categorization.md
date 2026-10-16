# 120 - Phase 39.1: Hot Migration Hardening, Quiescence Locking & Fleet Categorization Engine

## Problem
While Phase 39 enabled single-execution hot migration and SHA-256 audit ledger tracking, large-scale production fleets faced additional operational risks:
1. Long-running executions could mutate while workers were actively processing leased tasks, risking race conditions.
2. Terminal executions could inadvertently be targeted for hot migration.
3. Operators lacked a heuristic categorizer to automatically determine which in-flight executions are safe to migrate vs those requiring manual review or hard blocking.
4. There was no fleet batch preview or batch migration API to migrate compatible executions across a workflow definition at scale.

## Plan
1. **Engine Core & Persistence (`workflow-engine`)**:
   - Create `MigrationTier` enum (`FULLY_COMPATIBLE`, `CONDITIONAL_REQUIRES_MANUAL_REVIEW`, `INCOMPATIBLE_BLOCK`).
   - Enhance `TopologicalCompatibilityValidator` to categorize executions and generate non-blocking warnings.
   - Add `listWorkflowExecutions` to `PersistencePort`, `InMemoryPersistenceAdapter`, `PostgresJdbcPersistenceAdapter`, and `SqliteJdbcPersistenceAdapter`.
   - Update `WorkflowEngineService.migrateExecutionWithQuiescence` to enforce active leased task draining, reject terminal executions, and record pre-migration snapshots in the audit ledger.
2. **REST API (`unipost-ms-aio`)**:
   - Expose `POST /api/v1/workflow/definitions/{key}/migration-preview` and `POST /api/v1/workflow/definitions/{key}/batch-migrate` in `WorkflowDefinitionController`.
3. **Unified Sandbox (`packages/sandbox`)**:
   - Implement `migration-preview` and `batch-migrate` endpoints in `workflow-versioning-sandbox-handler.ts`.
4. **Console UI (`apps/console`)**:
   - Add `useFleetMigrationPreview` and `useFleetBatchMigrate` hooks to `workflow-api.ts`.
   - Build `FleetMigrationModal` with 3-tier Bento filter cards, execution list, and inspection drawer.
   - Wire "Fleet Hot Migration" action into the Workflow Catalog table.
5. **Verification**:
   - Run Maven test suite for `workflow-engine` and `unipost-ms-aio`.
   - Run Vitest for `@unipost/sandbox` and `@unipost/console`.
   - Run monorepo TypeScript verification.

## Changes

### 1. `apps/backend/workflow-engine`
- `MigrationTier.java`: Added 3-tier enum for migration risk classification.
- `TopologicalCompatibilityValidator.java`: Added tier calculation, terminal status rejection, and parameter binding warnings.
- `PersistencePort.java`, `InMemoryPersistenceAdapter.java`, `PostgresJdbcPersistenceAdapter.java`, `SqliteJdbcPersistenceAdapter.java`: Added `listWorkflowExecutions` for definition-scoped execution retrieval.
- `WorkflowEngineService.java`: Added `migrateExecutionWithQuiescence` with 30s leased task drain check, terminal state protection, and pre-migration snapshot audit capture.
- `TopologicalCompatibilityValidatorTest.java`: Added unit tests for 3-tier categorization and terminal rejection.

### 2. `apps/backend/unipost-ms-aio`
- `WorkflowEngineConfiguration.java`: Added `persistencePort()` getter on `WorkflowDefinitionRegistry`.
- `WorkflowDefinitionController.java`: Added `/migration-preview` and `/batch-migrate` REST endpoints.

### 3. `packages/sandbox`
- `workflow-versioning-sandbox-handler.ts`: Added realistic mock data and route handlers for batch preview and batch migration.

### 4. `apps/console`
- `workflow-api.ts`: Added types and React Query hooks `useFleetMigrationPreview` and `useFleetBatchMigrate`.
- `fleet-migration-modal.tsx`: Created Liquid Glass fleet migration modal with Bento metrics, tier filtering, and inspection drawer.
- `workflow-catalog-columns.tsx` & `workflow-catalog-table.tsx`: Added `onFleetMigrate` prop and "Fleet Hot Migration" dropdown menu item.
- `workflows/index.tsx`: Mounted `FleetMigrationModal` connected to catalog table actions.
- `fleet-migration-modal.test.tsx`: Added unit test suite (2/2 passed).

## Verification
- Backend: All 60 tests passed across `workflow-engine` and `unipost-ms-aio`.
- Sandbox: 11/11 tests passed in `@unipost/sandbox`.
- Console: 4/4 Vitest tests passed, `tsc --noEmit` exited 0 with zero errors.
