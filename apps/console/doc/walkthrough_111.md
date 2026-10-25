# Walkthrough 111: Phase 42 - Maximum-Care Base Entity CRUD Pipeline & Partitioned Audit Ledger

## Overview
Phase 42 delivers the **Maximum-Care Base Entity CRUD Pipeline & Partitioned Audit Ledger** across the Acc monorepo. It establishes a resilient 6-stage lifecycle engine (`RecordMutationPipeline`) for entity record mutations within `@Transactional` boundaries, dual-mode OCC & ETag validation with 3-way auto-merging, declarative delete cascades, strict tenant blindness, rolling monthly range-partitioned audit tables (`UNIPOST_RECORD_AUDIT_LOG`), Sovereign-only version restoration with dry-run diff preview, and an interactive Liquid Glass `RecordAuditHistoryDrawer` on the Console UI.

---

## Changes Implemented

### 1. Database Migration (Liquibase)
- Created `apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00012.xml`:
  - Added `cascade_policy VARCHAR(20) DEFAULT 'RESTRICT' NOT NULL` to `UNIPOST_RELATIONSHIP_TYPES`.
  - Created table `UNIPOST_RECORD_AUDIT_LOG` range-partitioned by `created_at`:
    - Columns: `id BIGINT`, `tenant_id VARCHAR(64)`, `entity_type_id BIGINT`, `record_id BIGINT`, `version BIGINT`, `operation VARCHAR(30)`, `old_attributes JSONB`, `new_attributes JSONB`, `delta JSONB`, `changed_by VARCHAR(255)`, `created_at TIMESTAMP WITH TIME ZONE NOT NULL`.
    - Composite primary key: `(id, created_at)`.
    - Created `DEFAULT` catch-all partition `UNIPOST_RECORD_AUDIT_LOG_DEFAULT`.
    - Created rolling monthly partitions: `2026_10`, `2026_11`, `2026_12`, and `2027_01`.
    - Added lookup composite index `idx_record_audit_lookup ON UNIPOST_RECORD_AUDIT_LOG (tenant_id, entity_type_id, record_id, version DESC)`.
    - Enabled Row-Level Security (`RLS`) on PostgreSQL with tenant isolation policy.
- Registered changelog 12 in `apps/backend/acc-db/src/main/resources/db/acc/changelog-master.xml`.

### 2. Domain & Repositories (Java 21 / Spring Modulith)
- Updated `RelationshipType.java`: Added `cascadePolicy` column mapping and getter/setter.
- Created `RecordAuditLog.java`: JPA entity mapped with composite key `@IdClass(RecordAuditLogId.class)` on `(id, createdAt)`.
- Created `RecordAuditLogId.java`: Composite key class implementing `Serializable`.
- Created `RecordAuditLogRepository.java`: Spring Data JPA repository with `findByEntityTypeIdAndRecordIdOrderByVersionDesc`.

### 3. Pipeline & Service Layer
- Created `AuditPartitionProvisioner.java`:
  - Automated dynamic partition maintenance service checking existing partitions and dynamically provisioning `UNIPOST_RECORD_AUDIT_LOG_YYYY_MM` via raw DDL with safety checks.
- Created `RecordMutationPipeline.java`:
  - Implements the complete 6-stage lifecycle within `@Transactional` boundaries:
    - **Stage 1: Pre-Condition & OCC Extraction**: Dual-mode OCC via `If-Match` header (supports quotes `\"3\"`, `W/\"3\"`, or raw `3`) and fallback to body `version`. Throws `MetadataConflictException` (`409 Conflict`) with current version when client is stale and no `baseAttributes` supplied.
    - **Stage 2: Schema Defaults & Draft-07 Validation**: Deep applies attribute defaults with type-safe casting (integers as `Long`) before validation.
    - **Stage 3: Referential Integrity & Strict Tenant Blindness**: Validates `relation_picker` foreign record references. Enforces tenant isolation: referenced records belonging to other tenants are treated as non-existent (`MetadataNotFoundException` / `404 Not Found`).
    - **Stage 4: State Transition & Disjoint 3-Way Auto-Merge**: When version mismatch occurs with `baseAttributes`, performs 3-way auto-merging: disjoint client additions/updates proceed cleanly, while conflicting modifications to the same field throw `409 Conflict`. Increments version monotonically.
    - **Stage 5: Declarative Delete Cascades**: Pattern B (`UNIPOST_ATTRIBUTE_DEFINITIONS.options->>'cascadePolicy'`) and Pattern C (`UNIPOST_RELATIONSHIP_TYPES.cascade_policy`). Cascades soft-deletes via high-throughput set-based SQL `UPDATE UNIPOST_ENTITIES ...` while logging a single root cascade audit entry.
    - **Stage 6: Structured Audit Logging & Outbox Publishing**: Writes structured before/after diffs (`{"field": {"old": v1, "new": v2}}`) to `UNIPOST_RECORD_AUDIT_LOG` and publishes outbox events.
    - **Sovereign Restore Engine**:
      - `previewRestore`: Dry-runs rollback against current schema defaults, returning target version, current version, next version, and computed delta.
      - `executeRestore`: Verifies Sovereign Root Custodian authority (`ROLE_SYSTEM_CUSTODIAN`), monotonic version bump (`current.version + 1`), logs `operation = "RESTORE"`, and updates record.
- Updated `MetadataService.java`:
  - Delegated `createEntityRecord`, `updateEntityRecord`, `patchEntityRecord`, and `deleteEntityRecord` to `RecordMutationPipeline`.
  - Added `getRecordAuditLogs`, `previewRestoreRecordVersion`, and `restoreRecordToAuditVersion`.
  - Preserved backward-compatible overloads across all methods.
- Updated DTOs & Controller:
  - Created `RecordAuditLogResponse.java`, `RestorePreviewResponse.java`.
  - Updated `MetadataController.java`: Added `If-Match` request header and `ETag: "\"{version}\""` response header support, `GET .../records/{recordId}/audit`, `GET .../records/{recordId}/restore-preview/{auditId}`, and `POST .../records/{recordId}/restore/{auditId}`.

### 4. Client Contracts & Console UI
- Updated `packages/client/src/contracts/metadata.ts`:
  - Added `cascadePolicy?: 'RESTRICT' | 'CASCADE' | 'SET_NULL'` to `RelationshipType`.
  - Added `schemaVersion?: number` to `EntityRecord`.
  - Added `RecordAuditLog` and `RestorePreviewResponse` interfaces.
- Updated `apps/console/src/features/metadata/api/`:
  - Added `getRecordAuditLogs`, `previewRestoreRecord`, `restoreRecordVersion` to `MetadataDataSource`, `http-metadata-service.ts`, and `metadata-service.ts`.
  - Created React Query hooks in `metadata-api.ts`: `useRecordAuditLogs`, `usePreviewRestoreRecord`, `useRestoreRecordVersion`.
- Created `RecordAuditHistoryDrawer.tsx` in `apps/console/src/features/metadata/components/records/`:
  - Liquid Glass slide-over drawer with backdrop blur, specular borders, and diffuse elevation.
  - Interactive chronological timeline with badges (`CREATE`, `UPDATE`, `PATCH`, `SOFT_DELETE`, `RESTORE`), changedBy, and timestamps.
  - Visual color-coded diff boxes: old values with red strikethrough vs new values in emerald.
  - Sovereign-only security enforcement: Standard users see "Restore (Locked)"; Sovereign Root Custodians (`ROLE_SYSTEM_CUSTODIAN` / persona `system`) see "Preview Restore".
  - Confirmation dialog with 3-version comparison (Current, Target, Next monotonic) and computed delta table before execution.
- Updated `entity-data-grid.tsx`:
  - Added "Audit History & Ledger" action in row dropdown menu.
  - Connected `RecordAuditHistoryDrawer` with state management.
- Unified Sandbox Platform:
  - Updated `apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts` with route handlers for `/records/:id/audit`, `/records/:id/restore-preview/:auditId`, and `/records/:id/restore/:auditId`.
  - Enhanced `mock-metadata.ts` with in-memory audit ledger, delta computation, and 403 Forbidden checks for non-sovereign personas.

---

## Verification Results

### Backend Unit & Integration Tests (100% Pass)
Command:
```powershell
& "C:\Users\Admin\.m2\wrapper\dists\apache-maven-3.9.9-bin\6gbr3tfuiv8aocduf5pro8ephc\apache-maven-3.9.9\bin\mvn.cmd" test -f apps/backend/pom.xml -pl acc-fw "-Dtest=*Metadata*,RecordMutationPipelineTest,CompositeEntityTypeVerificationTest" -q
```
- `RecordMutationPipelineTest`: 9/9 passed
  - `testSuccessfulCreateRecordWithAuditLog`
  - `testOccConflictThrows409`
  - `testThreeWayAutoMergeDisjointSuccess`
  - `testThreeWayAutoMergeConflictThrows409`
  - `testTenantBlindnessCrossTenantReferenceThrows404`
  - `testPatternBCascadeSoftDelete`
  - `testRestorePreviewComputesDelta`
  - `testSovereignRestoreSuccess`
  - `testNonSovereignRestoreThrowsForbidden`
- `MetadataServiceTest`: 47/47 passed
- `MetadataServiceOccAutoMergeTest`: 10/10 passed
- `MetadataControllerTest`: 17/17 passed
- `CompositeEntityTypeVerificationTest`: 12/12 passed
- `SchemaCompilerTest`, `SchemaValidationServiceTest`, `SafeSchemaValidationTest`, `MetadataCacheListenerTest`: passed

### Frontend Component Tests (Vitest)
- Created `apps/console/src/features/metadata/components/records/record-audit-history-drawer.test.tsx` verifying:
  - Audit trail timeline and version badges.
  - Disabled restore action for standard users.
  - Unlocked restore preview and monotonic version restoration for Sovereign Custodians.
