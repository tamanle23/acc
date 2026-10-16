# Implementation Plan 107 - Phase 39: Workflow Definition Versioning, Hot Migration Policies & Tamper-Evident Audit Ledger

## 1. Problem Statement
In mission-critical enterprise environments, workflow definitions evolve continuously. Currently:
1. Workflow definitions are unversioned mutable snapshots or single-version records without semantic lifecycle states (`DRAFT`, `ACTIVE`, `DEPRECATED`, `ARCHIVED`).
2. Long-running executions cannot safely migrate across versions when bug fixes or schema updates occur without risk of corruption or regression.
3. There is no cryptographically verifiable tamper-evident audit ledger (`workflow_audit_log`) ensuring that execution checkpoints, human approvals, and state mutations have not been modified or forged in the database.
4. The Visual DAG Studio lacks a visual graph diff viewer overlay to compare topology across versions and inspect changes before performing hot migration.

## 2. Solution Architecture
### A. Backend Data & Core Model (`apps/backend/workflow-engine`)
1. **Semantic Definition Versioning & Schema**:
   - `UNIPOST_WORKFLOW_DEFINITIONS` table in `schema-postgres.sql` and `schema-sqlite.sql`:
     - `definition_id` VARCHAR(128) PRIMARY KEY
     - `tenant_id` VARCHAR(64) NOT NULL
     - `workflow_key` VARCHAR(128) NOT NULL
     - `version` INT NOT NULL
     - `status` VARCHAR(32) NOT NULL (`DRAFT`, `ACTIVE`, `DEPRECATED`, `ARCHIVED`)
     - `name` VARCHAR(128) NOT NULL
     - `description` TEXT
     - `definition_json` JSONB / TEXT NOT NULL
     - `published_at_ms` BIGINT
     - `published_by` VARCHAR(128)
     - `created_at_ms` BIGINT NOT NULL
     - `updated_at_ms` BIGINT NOT NULL
     - `UNIQUE(tenant_id, workflow_key, version)`
   - Java model: `WorkflowDefinitionRecord` and `WorkflowVersionStatus`.
2. **Tamper-Evident Cryptographic Audit Ledger**:
   - Table `workflow_audit_log` in PostgreSQL & SQLite:
     - `sequence_num` BIGSERIAL / INTEGER PRIMARY KEY AUTOINCREMENT
     - `event_id` VARCHAR(64) NOT NULL UNIQUE
     - `workflow_id` VARCHAR(64) NOT NULL
     - `tenant_id` VARCHAR(64) NOT NULL
     - `actor_id` VARCHAR(64) NOT NULL
     - `action` VARCHAR(64) NOT NULL (`EXECUTION_STARTED`, `TASK_COMPLETED`, `HUMAN_APPROVED`, `HOT_MIGRATION`, `SAGA_COMPENSATED`)
     - `payload_snapshot` JSONB / TEXT NOT NULL
     - `prev_hash` VARCHAR(64) NOT NULL
     - `current_hash` VARCHAR(64) NOT NULL (SHA-256(prev_hash + event_id + workflow_id + action + payload_snapshot + created_at_ms))
     - `created_at_ms` BIGINT NOT NULL
   - Genesis hash: `0000000000000000000000000000000000000000000000000000000000000000`.
   - `AuditLedgerService` & `AuditLedgerVerifier`: appends chained records and validates sequence integrity on demand.
3. **Topological Graph Compatibility Validator & Hot Migration Engine**:
   - `TopologicalCompatibilityValidator`:
     - Compares `v1` vs `v2` definitions.
     - Validates that completed tasks in `v1` exist in `v2` with compatible schema definitions.
     - Simulates frontier node execution paths.
   - `WorkflowEngineService.migrateExecution(workflowId, targetVersion, dryRun)`:
     - If `dryRun == true`: returns validation report `{ compatible: boolean, issues: string[], remappedNodes: string[] }`.
     - If `dryRun == false`: rewires execution definition snapshot to `v2`, updates version, appends `HOT_MIGRATION` audit log, and preserves atomic state.
4. **REST Controllers (`apps/backend/unipost-ms-aio`)**:
   - Versioning endpoints:
     - `GET /api/v1/workflow/definitions/{key}/versions`
     - `GET /api/v1/workflow/definitions/{key}/versions/{version}`
     - `POST /api/v1/workflow/definitions/{key}/versions/{version}/publish`
     - `POST /api/v1/workflow/definitions/{key}/versions/{version}/deprecate`
   - Migration endpoints:
     - `POST /api/v1/workflow/executions/{id}/migrate/dry-run`
     - `POST /api/v1/workflow/executions/{id}/migrate`
   - Audit endpoints:
     - `GET /api/v1/workflow/executions/{id}/audit`
     - `GET /api/v1/workflow/executions/{id}/audit/verify`

### B. Unified Sandbox Platform Parity (`packages/sandbox`)
1. **`workflow-versioning-sandbox-handler.ts`**:
   - Registered with high priority (`priority: 95`) in `packages/sandbox/src/handlers/`.
   - Handles definition versions, publishing, migration dry-runs, and execution migrations.
   - Implements in-memory cryptographic SHA-256 hash chaining for audit logs.
   - Implements `POST /api/v1/workflow/executions/:id/audit/tamper` to simulate tamper attacks for testing the verifier.
2. **`SandboxDock` Integration**:
   - Diagnostic controls: "Simulate Hot Migration", "Verify Ledger Integrity", "Inject Audit Tamper".

### C. Console UI (`apps/console`)
1. **Visual Graph Diff Viewer in Visual DAG Studio**:
   - Compares nodes between active version and comparison target.
   - Highlights: Added (Green), Removed (Red), Modified (Amber yellow).
2. **Hot Migration Operator Modal**:
   - Triggerable from Workflow Execution view.
   - Dry-run validation check with clear compatibility status.
   - Direct execution migration triggering query invalidation and live toast alerts.
3. **Cryptographic Audit Ledger Verification Badge**:
   - Shows badge "Cryptographically Verified (SHA-256)" with green checkmark or warning alert if tampered.

## 3. Verification Plan
- **Unit & Integration Tests**:
  - `AuditLedgerVerifierTest.java`: verifies sequential chaining, genesis hash, and catches single-character tamper.
  - `TopologicalCompatibilityValidatorTest.java`: tests compatible schema evolution and rejects broken frontier migrations.
  - `pnpm --filter @unipost/sandbox test`: validates mock versioning and audit chaining.
  - `pnpm --filter @unipost/console test`: UI component tests for diff viewer and migration modal.
  - Typecheck verification across monorepo (`check-types`).
