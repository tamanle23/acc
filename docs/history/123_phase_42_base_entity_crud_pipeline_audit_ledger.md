# History Log 123: Maximum-Care Base Entity CRUD Pipeline & Partitioned Audit Ledger (Phase 42)

## Problem Statement
Prior to Phase 42, base entity record mutations lacked a standardized, atomic multi-stage execution pipeline. Edge cases such as lost updates under high concurrency, undeclared cascading deletes corrupting parent-child graphs, cross-tenant entity leakage across `relation_picker` links, unpartitioned audit logs risking table bloat, and the inability to preview and safely roll back damaged records to historical snapshots posed critical enterprise reliability risks.

## Solution Plan
1. **Database Schema & Range Partitioning**:
   - Add `cascade_policy VARCHAR(20) DEFAULT 'RESTRICT' NOT NULL` to `UNIPOST_RELATIONSHIP_TYPES` via Liquibase.
   - Provision `UNIPOST_RECORD_AUDIT_LOG` table with PostgreSQL range partitioning on `created_at`, default catch-all partition, rolling monthly partitions, composite index, and Row-Level Security (`RLS`).
2. **Modular Mutation Pipeline Engine**:
   - Develop `RecordMutationPipeline` in `apps/backend/acc-fw` orchestrating the 6-stage lifecycle within `@Transactional` boundaries.
   - Dual-mode OCC & ETag: HTTP `If-Match` request header & `ETag: "\"{version}\""` response header with fallback to body `version`; 3-way auto-merge on version mismatch if `baseAttributes` supplied, else `409 Conflict`.
   - Declarative Delete Cascades: Pattern B (`UNIPOST_ATTRIBUTE_DEFINITIONS.options->>'cascadePolicy'`) & Pattern C (`UNIPOST_RELATIONSHIP_TYPES.cascade_policy`). Child cascade deletes execute via set-based bulk SQL (`UPDATE UNIPOST_ENTITIES ...`) for high throughput with a single root audit log entry.
   - Strict Tenant Blindness: Foreign references to records of other tenants treated as non-existent (`404 Not Found`).
   - Audit Ledger: Store structured delta before/after map: `{"field": {"old": v1, "new": v2}}`.
   - Sovereign-Only Restore: Dry-run preview (`GET .../restore-preview/{auditId}`) computing diff with schema defaults; restore execution (`POST .../restore/{auditId}`) performing monotonic version bump (`operation = "RESTORE"`), unlocked only for Platform Root Custodians (`ROLE_SYSTEM_CUSTODIAN`).
3. **Frontend & Unified Sandbox Parity**:
   - Liquid Glass `RecordAuditHistoryDrawer` on `EntityDataGrid` in `@acc/console`.
   - Unified Sandbox routes and in-memory audit store in `metadata-sandbox-adapter.ts` and `mock-metadata.ts`.

## Changes Made
- **Database Migrations**:
  - `apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00012.xml`: Defined partitioned audit table and relationship cascade column.
  - `apps/backend/acc-db/src/main/resources/db/acc/changelog-master.xml`: Registered changelog 12.
- **Backend Domain, Repositories & Engine**:
  - `RelationshipType.java`: Added `cascadePolicy` column.
  - `RecordAuditLog.java`, `RecordAuditLogId.java`: Partitioned composite entity and key.
  - `RecordAuditLogRepository.java`: JPA repository with version sorting.
  - `AuditPartitionProvisioner.java`: Automated dynamic monthly table partition provisioner.
  - `RecordMutationPipeline.java`: Complete 6-stage lifecycle engine with OCC, 3-way auto-merge, declarative delete cascades, structured audit logging, and sovereign restore.
  - `MetadataService.java`: Delegated CRUD operations to pipeline, added audit queries, preview, and restore overloads.
  - `MetadataController.java`: Added `If-Match` / `ETag` headers and audit/restore REST endpoints.
  - `RecordAuditLogResponse.java`, `RestorePreviewResponse.java`: Response DTOs.
  - `RecordMutationPipelineTest.java`: 9 comprehensive backend tests covering all invariants.
- **Client SDK & Console UI**:
  - `packages/client/src/contracts/metadata.ts`: Added `cascadePolicy`, `schemaVersion`, `RecordAuditLog`, and `RestorePreviewResponse`.
  - `apps/console/src/features/metadata/api/`: Added audit/restore methods to `MetadataDataSource`, `http-metadata-service.ts`, `metadata-service.ts`, and React Query hooks in `metadata-api.ts`.
  - `apps/console/src/features/metadata/components/records/record-audit-history-drawer.tsx`: Liquid Glass slide-over drawer with audit timeline, visual diffs, and Sovereign-only restore confirmation modal.
  - `apps/console/src/features/metadata/components/records/record-audit-history-drawer.test.tsx`: Vitest tests for drawer.
  - `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`: Wired "Audit History & Ledger" row action.
  - `apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts`: Added mock audit and restore route handlers.
  - `apps/console/src/features/metadata/data/mock-metadata.ts`: In-memory audit tracking, delta calculation, and sovereign authority check.

## Verification
- **Backend Tests (Maven 3.9.9)**:
  - `RecordMutationPipelineTest`: 9/9 passed.
  - `MetadataServiceTest`: 47/47 passed.
  - `MetadataServiceOccAutoMergeTest`: 10/10 passed.
  - `MetadataControllerTest`: 17/17 passed.
  - `CompositeEntityTypeVerificationTest`: 12/12 passed.
- **Frontend Tests (Vitest)**:
  - `record-audit-history-drawer.test.tsx`: 3/3 passed.
  - Full metadata suite verified.

## Walkthrough & Artifacts
- Paired Walkthrough: `apps/console/doc/walkthrough_111.md`
- Paired Plan: `apps/console/doc/implementation_plan_111.md`
