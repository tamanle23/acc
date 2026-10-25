# 010: Streaming Export & GDPR Hard-Purge Pipeline (Phase 8)

## Problem
In a multi-tenant dynamic schema architecture, compliance regulations mandate two capabilities:
1. **Data Portability (GDPR Art. 20)**: Generating complete tenant data and schema backups without exhausting JVM heap memory on large tenants.
2. **Right to Be Forgotten / Cryptographic Hard-Purge (GDPR Art. 17 / SOC 2 Type II)**: Permanently wiping all tenant records, relationships, and custom metadata without table-lock deadlocks on shared tables, while preserving SYSTEM schemas and providing an immutable Certificate of Erasure audit receipt.

## Plan
1. **Export Pipeline (`TenantExportService`):**
   - Stream directly into `ZipOutputStream` using chunked queries (1,000 items/page).
   - Package `manifest.json`, `schemas/entity_types.json`, `schemas/attribute_definitions.json`, `schemas/relationship_types.json`, and line-delimited `data/records.ndjson` and `data/entity_relationships.ndjson`.
2. **5-Stage Purge Engine (`TenantPurgeService`):**
   - Stage 1: Purge graph relationships in 5,000-row micro-transactions.
   - Stage 2: Purge entity records in 5,000-row micro-transactions.
   - Stage 3: Purge custom metadata overlays (`UNIPOST_ATTRIBUTE_DEFINITIONS`, `UNIPOST_RELATIONSHIP_TYPES`, `UNIPOST_ENTITY_TYPES`), strictly skipping `SYSTEM` schemas.
   - Stage 4: Evict L1 memory and Hazelcast L2 cluster keys (`schema:{targetTenant}:*`).
   - Stage 5: Generate immutable `CertificateOfErasure` storing SHA-256 tenant hash and deletion counts.
3. **Controller (`TenantDataLifecycleController`):**
   - Expose `GET /api/v1/metadata/tenants/{tenantId}/export` and `POST /api/v1/metadata/tenants/{tenantId}/purge`.

## Changes Made
- **Domain Records:**
  - `apps/backend/acc-fw/src/main/java/com/acc/tenant/export/TenantExportManifest.java`
  - `apps/backend/acc-fw/src/main/java/com/acc/tenant/purge/CertificateOfErasure.java`
- **Repositories Updated:**
  - `apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/EntityRecordRepository.java`: added tenant finder/counter methods.
  - `apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/EntityRelationshipRepository.java`: added tenant finder/counter methods.
  - `apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/EntityTypeRepository.java`: added tenant finder/counter methods.
  - `apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/AttributeDefinitionRepository.java`: added tenant finder/counter methods.
  - `apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/RelationshipTypeRepository.java`: added tenant finder/counter methods.
- **Services & Controller:**
  - `apps/backend/acc-fw/src/main/java/com/acc/tenant/export/TenantExportService.java`
  - `apps/backend/acc-fw/src/main/java/com/acc/tenant/purge/TenantPurgeService.java`
  - `apps/backend/acc-fw/src/main/java/com/acc/presentation/TenantDataLifecycleController.java`
- **Unit Tests:**
  - `apps/backend/acc-fw/src/test/java/com/acc/tenant/export/TenantExportServiceTest.java`
  - `apps/backend/acc-fw/src/test/java/com/acc/tenant/purge/TenantPurgeServiceTest.java`

## Verification
- Unit & regression tests executed:
  ```powershell
  .\mvnw.cmd test "-Dtest=TenantExportServiceTest,TenantPurgeServiceTest,TenantRateLimitServiceTest,SafeSchemaValidationTest,TenantProvisioningServiceTest,CompositeCacheFabricTest,MetadataRlsIntegrationTest"
  ```
  All tests passed (`BUILD SUCCESS` across all 10 modules).

## Walkthrough & Artifacts
- Plan: `apps/backend/doc/implementation_plan_22.md`
- Walkthrough: `apps/backend/doc/walkthrough_22.md`
- History: `docs/history/010_streaming_export_and_gdpr_hard_purge_pipeline.md`
