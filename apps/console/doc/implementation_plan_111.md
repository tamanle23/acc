# Implementation Plan 111: Phase 42 - Maximum-Care Base Entity CRUD Pipeline & Partitioned Audit Ledger

## Overview
Phase 42 establishes the hardened, transactional write plane for base entity records in Unipost. It introduces a dedicated 6-stage `RecordMutationPipeline`, dual-mode HTTP ETag OCC (`If-Match`) with 3-way auto-merge fallback, referential integrity guards with strict tenant blindness, declarative delete cascades (`RESTRICT`, `CASCADE`, `SET_NULL`) across Pattern B JSONB attributes and Pattern C graph edges, monthly range-partitioned `UNIPOST_RECORD_AUDIT_LOG`, and a Liquid Glass `RecordAuditHistoryDrawer` in `@acc/console` featuring visual attribute diffs, dry-run previews, and a Sovereign-only "Restore to this Version" action.

---

## User Review Required

> [!IMPORTANT]
> **Key Architecture Decisions Aligned in /grill-me**:
> 1. **Dedicated Pipeline**: A modular `RecordMutationPipeline` engine in `apps/backend/acc-fw` orchestrates all 6 stages within `@Transactional` boundaries.
> 2. **Dual-Mode OCC & ETag**: Extract version from `If-Match` header (or JSON body `version`). On mismatch, attempt 3-way auto-merge if `baseAttributes` is provided; otherwise return `409 Conflict`. Return `ETag: "\"{version}\""` on all record GET and mutation responses.
> 3. **Declarative Delete Cascades**: Pattern B declares `cascadePolicy` inside `options` JSONB (`UNIPOST_ATTRIBUTE_DEFINITIONS`); Pattern C stores `cascade_policy` in `UNIPOST_RELATIONSHIP_TYPES`. Supports `RESTRICT`, `CASCADE`, and `SET_NULL` (Detach).
> 4. **Cascade Execution Strategy**: Child cascade deletes execute via set-based bulk SQL updates (`UPDATE UNIPOST_ENTITIES SET deleted_date = NOW() ...`) for maximum throughput, recording a single root audit log entry.
> 5. **Strict Tenant Blindness**: Cross-tenant references are treated as non-existent within the tenant boundary (`404 Not Found` / `422 Unprocessable Entity`), preventing ID enumeration attacks.
> 6. **Audit Delta & Operation Invariants**:
>    - `UPDATE`: Structured before/after map: `{"fieldName": {"old": prev, "new": curr}}`.
>    - `SOFT_DELETE`: `old_attributes = <final snapshot>`, `new_attributes = null`, `delta = null`.
>    - `RESTORE`: Monotonic version increment (e.g. v5 -> v6), `operation = "RESTORE"` with `delta` and metadata referencing `restored_from_version`.
> 7. **Sovereign-Only Restore Action with Dry-Run Preview**:
>    - Unlocked exclusively for Platform Root Custodians (`ROLE_SYSTEM_CUSTODIAN` / `isSovereignCustodian`).
>    - Backend provides `POST .../restore/{auditId}?preview=true` computing proposed restored attributes and schema defaults for display in a confirmation modal before execution.

---

## Proposed Changes

### Workstream 1: Database Schema & Partitioned Audit Ledger (Liquibase)

#### [NEW] `apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00012.xml`
- Add `cascade_policy VARCHAR(20) DEFAULT 'RESTRICT' NOT NULL` to `UNIPOST_RELATIONSHIP_TYPES`.
- Create partitioned table `UNIPOST_RECORD_AUDIT_LOG`:
  - Columns:
    - `id BIGINT NOT NULL`
    - `tenant_id VARCHAR(64) NOT NULL`
    - `record_id BIGINT NOT NULL`
    - `entity_type_id BIGINT NOT NULL`
    - `operation VARCHAR(16) NOT NULL` (`CREATE`, `UPDATE`, `SOFT_DELETE`, `RESTORE`)
    - `actor VARCHAR(64) NOT NULL`
    - `version BIGINT NOT NULL`
    - `old_attributes JSONB NULL`
    - `new_attributes JSONB NULL`
    - `delta JSONB NULL`
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`
  - Partition spec: `PARTITION BY RANGE (created_at)`
  - Primary Key: `(id, created_at)`
- Create initial partitions:
  - `acc_record_audit_log_default PARTITION OF UNIPOST_RECORD_AUDIT_LOG DEFAULT`
  - `acc_record_audit_log_2026_10` (from `2026-10-01` to `2026-11-01`)
  - `acc_record_audit_log_2026_11` (from `2026-11-01` to `2026-12-01`)
  - `acc_record_audit_log_2026_12` (from `2026-12-01` to `2027-01-01`)
  - `acc_record_audit_log_2027_01` (from `2027-01-01` to `2027-02-01`)
- Add composite index: `idx_record_audit_lookup ON UNIPOST_RECORD_AUDIT_LOG (tenant_id, record_id, created_at DESC)`.
- Enable PostgreSQL Row-Level Security (RLS) on `UNIPOST_RECORD_AUDIT_LOG` with tenant isolation policy matching `UNIPOST_ENTITIES`.

#### [EDIT] `apps/backend/acc-db/src/main/resources/db/acc/changelog-master.xml`
- Register `changelog-000.000.00012.xml`.

---

### Workstream 2: Domain Model & Audit Persistence

#### [NEW] `apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/RecordAuditLog.java`
- JPA entity representing `UNIPOST_RECORD_AUDIT_LOG` with composite primary key (`id`, `createdAt`), `tenantId`, `recordId`, `entityTypeId`, `operation`, `actor`, `version`, `oldAttributes`, `newAttributes`, and `delta`.

#### [NEW] `apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/RecordAuditLogRepository.java`
- Repository with queries:
  - `findByTenantIdAndRecordIdOrderByCreatedAtDesc(String tenantId, Long recordId)`
  - `findByTenantIdAndRecordIdAndId(String tenantId, Long recordId, Long id)`

#### [EDIT] `apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/RelationshipType.java`
- Add `cascadePolicy` column (`RESTRICT`, `CASCADE`, `SET_NULL`) with default `RESTRICT`.

---

### Workstream 3: The 6-Stage Mutation Pipeline Engine

#### [NEW] `apps/backend/acc-fw/src/main/java/com/acc/service/RecordMutationPipeline.java`
- Encapsulates the 6-stage lifecycle:
  - **Stage 1 (OCC & ETag Extraction)**: Resolves expected version from `If-Match` header or request body.
  - **Stage 2 (Validation & Defaults)**: Applies server-side attribute defaults, checks payload size, validates with `SchemaValidationService` (`additionalProperties: false`), and triggers FSM state transition validation.
  - **Stage 3 (Referential Integrity & Tenant Blindness)**:
    - Pattern B: Inspects `relation_picker` attributes; validates target records exist, are not deleted, and match `tenant_id`. Rejects cross-tenant records with `MetadataNotFoundException` (`404`).
    - Pattern C: Enforces cardinality constraints and validates active non-deleted records within tenant boundary.
  - **Stage 4 (Atomic Execution & Version Bump)**: Persists record mutation with monotonic version increment. If version mismatch occurs, invokes 3-way auto-merge if `baseAttributes` is provided; throws `MetadataConflictException` (`409`) otherwise.
  - **Stage 5 (Declarative Delete Cascades)**:
    - On delete, evaluates incoming Pattern B references and Pattern C edges.
    - If `RESTRICT`: throws `MetadataConflictException` (`409`) if active references exist.
    - If `CASCADE`: executes high-throughput bulk SQL soft-delete on referencing child records (`UPDATE UNIPOST_ENTITIES ...`) and attached edges.
    - If `SET_NULL`: executes bulk SQL update clearing the referencing foreign key or soft-deletes the relationship edge.
  - **Stage 6 (Audit & Outbox)**: Computes attribute delta map `{"key": {"old": v1, "new": v2}}`, saves row in `UNIPOST_RECORD_AUDIT_LOG`, and dispatches outbox event via `OutboxEventPublisher`.

#### [NEW] `apps/backend/acc-fw/src/main/java/com/acc/service/AuditPartitionProvisioner.java`
- Utility/scheduled component checking if monthly partitions for `T + 1` and `T + 2` months exist, creating table DDL dynamically if missing.

#### [EDIT] `apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java`
- Refactor `createEntityRecord`, `updateEntityRecord`, `patchEntityRecord`, and `deleteEntityRecord` to delegate directly through `RecordMutationPipeline`.
- Add `getRecordAuditLogs(Long entityTypeId, Long recordId)` returning chronological audit history.
- Add `previewRestoreRecordVersion(Long entityTypeId, Long recordId, Long auditLogId)` computing proposed attributes diff with active schema defaults.
- Add `restoreRecordToAuditVersion(Long entityTypeId, Long recordId, Long auditLogId)` restoring historical attributes with sovereign custody authorization.

---

### Workstream 4: REST Controllers & ETag Protocol

#### [EDIT] `apps/backend/acc-fw/src/main/java/com/acc/presentation/MetadataController.java`
- In `getEntityRecord`, attach `ETag: "\"{record.version}\""` header.
- In `updateEntityRecord` and `patchEntityRecord`, support `@RequestHeader(value = "If-Match", required = false) String ifMatchHeader` and return `ETag` header.
- Add endpoint `GET /entity-types/{id}/records/{recordId}/audit` returning `List<RecordAuditLogResponse>`.
- Add endpoint `POST /entity-types/{id}/records/{recordId}/restore/{auditId}`:
  - If query param `preview=true`: computes and returns proposed attributes and visual diff without mutating.
  - If query param `preview=false` (or absent): executes restore mutation with `@PreAuthorize("hasRole('SYSTEM_CUSTODIAN')")`.

---

### Workstream 5: Frontend Liquid Glass RecordAuditHistoryDrawer

#### [NEW] `apps/console/src/features/metadata/components/records/record-audit-history-drawer.tsx`
- Slide-over Liquid Glass drawer (`Sheet`) rendered on Entity Data Grid.
- Timeline of audit cards showing:
  - Operation badge (`CREATE` in green, `UPDATE` in sky, `SOFT_DELETE` in rose, `RESTORE` in violet).
  - Actor identity, timestamp, version number.
  - Color-coded visual diff comparison (old vs new value badges).
  - **"Restore to this Version"** button rendered exclusively when `{ isSovereignCustodian } = usePermissions()` is true.
  - **Restore Preview Confirmation Dialog**: Fetches dry-run preview diff from backend, displaying proposed attribute reversals, newly applied schema defaults, and removed attributes before final confirmation.

#### [EDIT] `apps/console/src/features/metadata/components/records/EntityDataGrid.tsx` (or record action column)
- Add "Audit History" action button (Clock/History icon) triggering `RecordAuditHistoryDrawer`.

#### [EDIT] `apps/console/src/features/metadata/api/metadata-api.ts` & `contracts/metadata.ts`
- Add `useRecordAuditLogs(entityTypeId, recordId)`, `usePreviewRestoreRecord(entityTypeId, recordId)`, and `useRestoreRecordVersion(entityTypeId, recordId)`.
- Add TypeScript interfaces for audit logs, diff entries, and restore previews.

---

### Workstream 6: Unified Sandbox Parity & Diagnostics

#### [EDIT] `apps/console/src/core/sandbox/handlers/metadata-sandbox-handler.ts` (and `@acc/sandbox`)
- Implement handler for `GET /api/v1/metadata/entity-types/:id/records/:recordId/audit`.
- Implement handler for `POST /api/v1/metadata/entity-types/:id/records/:recordId/restore/:auditId` (supporting `preview=true` dry-run).
- Generate realistic audit trail entries on record mutations.
- Support OCC conflict simulation (`409 Conflict`) when header `If-Match` does not match active mock record version.

---

## Verification Plan

### Automated Tests
1. **Backend Tests (JUnit 5)**:
   - `apps/backend/acc-fw/src/test/java/com/acc/service/RecordMutationPipelineTest.java`:
     - `testCreateRecord_EnforcesDefaultsAndCreatesAuditLog`
     - `testUpdateRecord_WithValidIfMatch_SucceedsAndComputesDelta`
     - `testUpdateRecord_WithVersionMismatchAndBaseAttributes_Performs3WayMerge`
     - `testUpdateRecord_WithVersionMismatchNoBase_ThrowsConflict409`
     - `testReferentialIntegrity_CrossTenantReference_ThrowsNotFound404`
     - `testDeleteRecord_WithRestrictPolicy_ActiveReferences_ThrowsConflict409`
     - `testDeleteRecord_WithCascadePolicy_BulkSoftDeletesChildren`
     - `testDeleteRecord_WithSetNullPolicy_ClearsReference`
     - `testPreviewRestore_ReturnsDiffWithoutPersisting`
     - `testRestoreToAuditVersion_SovereignCustody_SuccessMonotonicVersion`
2. **Frontend Vitest Tests**:
   - `apps/console/src/features/metadata/components/records/record-audit-history-drawer.test.tsx`:
     - Asserts audit entries, timestamps, and diff badges render properly.
     - Asserts "Restore to this Version" button is visible for Sovereign Custodians (`isSovereignCustodian: true`).
     - Asserts "Restore to this Version" button is hidden for regular tenant operators (`isSovereignCustodian: false`).
     - Asserts restore preview dialog shows computed changes before confirming.
3. **Monorepo Build & Quality Gates**:
   - `mvn test -f apps/backend/pom.xml -pl acc-fw "-Dtest=RecordMutationPipelineTest" -q`
   - `pnpm --filter @acc/console test`
   - `pnpm --filter @acc/console exec eslint src/features/metadata/components/records`
   - `pnpm --filter @acc/console exec tsc --noEmit`
