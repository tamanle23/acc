# Walkthrough: Phase 8 - Streaming Export & GDPR Hard-Purge Pipeline

## Overview
Phase 8 delivers enterprise compliance infrastructure for **Data Portability (GDPR Article 20)** and **Right to Be Forgotten / Cryptographic Hard-Purge (GDPR Article 17 / SOC 2 Type II)** within `@acc/backend`, as specified in `docs/multi-tenants/08_tenant_data_backup_export_and_gdpr_purge.md`.

---

## Changes Implemented

### 1. Chunked Streaming Export Pipeline (`TenantExportService.java`)
- **Flat Memory Execution:** Streams directly to an HTTP response / ZIP output stream without holding the entire tenant dataset in JVM memory.
- **Chunked Pagination:** Streams `data/records.ndjson` and `data/entity_relationships.ndjson` in chunks of 1,000 records.
- **Self-Contained Bundle:**
  - `manifest.json`: Version, ISO-8601 timestamp, tenantId, counts.
  - `schemas/entity_types.json`: Entity type definitions.
  - `schemas/attribute_definitions.json`: Attribute definitions with UI & validation options.
  - `schemas/relationship_types.json`: Relationship definitions.
  - `data/records.ndjson`: Line-delimited JSON entity records.
  - `data/entity_relationships.ndjson`: Line-delimited JSON relationship edges.

### 2. 5-Stage Micro-Batch Hard-Purge Engine (`TenantPurgeService.java`)
- **Stage 1 (Graph Edge Wipe):** Deletes `UNIPOST_ENTITY_RELATIONSHIPS` in micro-batches of 5,000 using `REQUIRES_NEW` transactions, avoiding Postgres row lock escalation.
- **Stage 2 (Record Batch Purge):** Deletes `UNIPOST_ENTITIES` in micro-batches of 5,000.
- **Stage 3 (Metadata Overlays Wipe):** Deletes tenant attribute definitions, relationship types, and entity types. **Strict invariant:** All schemas with `tenant_id = 'SYSTEM'` are preserved.
- **Stage 4 (Distributed Cache Shredding):** Clears L1 in-memory schema caches and invalidates Hazelcast distributed keys matching `schema:{tenantId}:*`.
- **Stage 5 (Audit Receipt Generation):** Outputs immutable `CertificateOfErasure` storing SHA-256 tenant hash (`sha256:...`), purged row counts, timestamp, and operator identity without exposing PII.

### 3. REST Controller (`TenantDataLifecycleController.java`)
- `GET /api/v1/metadata/tenants/{tenantId}/export`: Streams ZIP archive (`application/zip`) with `Content-Disposition: attachment; filename="tenant_export_{tenantId}_{timestamp}.zip"`.
- `POST /api/v1/metadata/tenants/{tenantId}/purge`: Executes the 5-stage micro-batch purge pipeline, returning `CertificateOfErasure`. Guarded by `hasRole('ADMIN')` or `hasAuthority('TENANT_COMPLIANCE_PURGE')`.

---

## Verification Results

### Automated Unit & Regression Tests
Executed via Maven:
```powershell
.\mvnw.cmd test "-Dtest=TenantExportServiceTest,TenantPurgeServiceTest,TenantRateLimitServiceTest,SafeSchemaValidationTest,TenantProvisioningServiceTest,CompositeCacheFabricTest,MetadataRlsIntegrationTest"
```
**Results:**
- `TenantExportServiceTest`: Verified non-blocking streaming ZIP writing, manifest generation, and NDJSON records.
- `TenantPurgeServiceTest`: Verified 5-stage micro-batch execution, deletion counts, cache shredding, rejection of SYSTEM tenant purge, and `CertificateOfErasure` format.
- `CompositeCacheFabricTest` & `MetadataRlsIntegrationTest`: Zero regressions across tenancy, caching, and RLS.
- **Reactor Summary:** All 10 Maven modules `BUILD SUCCESS`.
