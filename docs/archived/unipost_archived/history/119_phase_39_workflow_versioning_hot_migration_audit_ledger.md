# 119 - Phase 39: Workflow Definition Versioning, Hot Migration Policies & Tamper-Evident Audit Ledger

## Problem
In complex multi-tenant workflow architectures, long-running workflow executions outlive definition updates. Enterprises require:
1. Versioned definitions with immutable semantic lifecycles (`DRAFT`, `ACTIVE`, `DEPRECATED`, `ARCHIVED`).
2. An operator-driven hot migration mechanism with topological graph compatibility validation to safely upgrade in-flight executions without state corruption.
3. A cryptographically verifiable SHA-256 hash-chained audit ledger to detect unauthorized tampering of execution events, task resolutions, and hot migration checkpoints.
4. Visual graph diff overlays in Visual DAG Studio and full offline parity in the Unified Sandbox Platform.

## Plan
1. **Engine Core & Persistence (`workflow-engine`)**:
   - Create `WorkflowVersionStatus`, `WorkflowDefinitionRecord`, and `WorkflowAuditRecord`.
   - Implement `AuditLedgerService` with SHA-256 hash chaining and sequence verification.
   - Implement `TopologicalCompatibilityValidator` to validate migration dry runs between definition graphs.
   - Extend `PersistencePort`, `InMemoryPersistenceAdapter`, `PostgresJdbcPersistenceAdapter`, and `SqliteJdbcPersistenceAdapter`.
   - Update SQL DDL (`schema-postgres.sql`, `schema-sqlite.sql`) with `workflow_definitions` and `workflow_audit_log` tables.
   - Wire audit emission and hot migration into `WorkflowEngineService`.
2. **REST API (`acc-ms-aio`)**:
   - Expose endpoints in `WorkflowDefinitionController` for definition versions, hot migration dry-run and apply, and audit ledger listing and verification.
3. **Unified Sandbox (`packages/sandbox`)**:
   - Implement `workflow-versioning-sandbox-handler.ts` with in-memory hash chain validation and tamper injection.
   - Register handler with priority 96 in `packages/sandbox/src/index.ts`.
4. **Console UI (`apps/console`)**:
   - Update `workflow-api.ts` with React Query hooks.
   - Add `diffStatus` property and specular glow badges to `dag-node.tsx`.
   - Build `HotMigrationModal` operator dialog with live dry-run validation and audit badge.
   - Wire version diff selection and modal into `visual-dag-studio.tsx`.
5. **Verification & Tests**:
   - Run Maven tests for `workflow-engine` and `acc-ms-aio`.
   - Run Vitest and TypeScript checks for `@acc/sandbox` and `@acc/console`.

## Changes

### 1. `apps/backend/workflow-engine`
- `WorkflowVersionStatus.java`: Semantic version status enum.
- `WorkflowDefinitionRecord.java`: Record holding versioned definition payload, status, and audit timestamps.
- `WorkflowAuditRecord.java`: Record representing SHA-256 hash-chained audit entries with genesis hash constant.
- `AuditLedgerService.java`: Hash calculation and tamper-detection chain verification engine.
- `TopologicalCompatibilityValidator.java`: Compares node sets, dependencies, and state boundaries.
- `PersistencePort.java`, `InMemoryPersistenceAdapter.java`, `PostgresJdbcPersistenceAdapter.java`, `SqliteJdbcPersistenceAdapter.java`: Added methods for version query/persistence, definition updates, and audit ledger append/list/verify.
- `schema-postgres.sql` & `schema-sqlite.sql`: Added tables and indexes for definitions and audit logs.
- `WorkflowEngineService.java`: Emits audit logs on start, task completion, and migration; exposes dry-run validation and verification methods.
- Tests: `AuditLedgerServiceTest.java`, `TopologicalCompatibilityValidatorTest.java`.

### 2. `apps/backend/acc-ms-aio`
- `WorkflowEngineConfiguration.java`: Added persistence fallback to `WorkflowDefinitionRegistry`.
- `WorkflowDefinitionController.java`: Added endpoints for version inspection, dry-run hot migration, execution hot migration, and audit ledger verification.

### 3. `packages/sandbox`
- `workflow-versioning-sandbox-handler.ts`: Realistic mock for definition versioning, hot migration, cryptographic audit logs, and tamper simulation.
- `packages/sandbox/src/index.ts`: Registered handler with priority 96.

### 4. `apps/console`
- `workflow-api.ts`: Added hooks `useWorkflowVersions`, `useMigrationDryRun`, `useMigrateExecution`, `useWorkflowAuditLedger`, and `useVerifyAuditLedger`.
- `dag-node.tsx`: Supported `diffStatus` (`added`, `removed`, `modified`) with Liquid Glass specular glow highlights.
- `hot-migration-modal.tsx`: Interactive operator modal with audit ledger verification badge and compatibility checks.
- `visual-dag-studio.tsx`: Added version diff selector and hot migration operator button.
- Tests: `hot-migration-modal.test.tsx`, `dag-node.test.tsx`.

## Verification
- `workflow-engine`: 50/50 tests passed (`./mvnw test -q -pl workflow-engine`).
- `acc-ms-aio`: 8/8 tests passed (`./mvnw test -q -pl acc-ms-aio`).
- `@acc/sandbox`: 11/11 tests passed (`pnpm --filter @acc/sandbox test`).
- `@acc/console`: Tests and TypeScript check passed (`tsc --noEmit`).
