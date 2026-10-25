# Implementation Plan - Phase 8: Streaming Export & GDPR Hard-Purge Pipeline

Implement enterprise compliance capabilities for Data Portability (GDPR Art. 20) and Right to Be Forgotten / Cryptographic Hard-Purge (GDPR Art. 17 / SOC 2 Type II) across `@acc/backend`.

## User Review Required

> [!NOTE]
> - **Streaming Export**: Uses streaming HTTP response / temporary spooling directly to ZIP containing `manifest.json`, schemas (`entity_types.json`, `attribute_definitions.json`, `relationship_types.json`), and line-delimited JSON (`records.ndjson`, `relationships.ndjson`). This ensures flat JVM memory footprint regardless of dataset size.
> - **5-Stage Hard-Purge**: Deletes tenant data in micro-batches (5,000 rows/batch) to prevent table-lock escalation and WAL spikes in PostgreSQL. Common system schemas (`tenant_id = 'SYSTEM'`) are strictly preserved.
> - **Certificate of Erasure**: Outputs a cryptographic SHA-256 tenant hash audit receipt verifying complete removal across database tables and distributed Hazelcast caches.

---

## Proposed Changes

### 1. DTOs & Domain Models (`com.acc.tenant.export` & `com.acc.tenant.purge`)
- `TenantExportManifest`: Export manifest metadata (version, export timestamp, tenant ID, entity counts, record counts).
- `TenantPurgeResult` & `CertificateOfErasure`: Non-PII audit record documenting purged row counts, purged schema counts, cryptographic hash, timestamp, and operator identifier.
- `TenantExportRequest`: Optional scope filtering (`SCHEMAS`, `DATA`, `RELATIONSHIPS`).

### 2. Streaming Export Service (`TenantExportService.java`)
- Efficient chunked query retrieval using Keyset pagination or streaming cursors.
- Compresses to `ZipOutputStream` directly:
  - `manifest.json`: Export metadata.
  - `schemas/entity_types.json`: Bespoke & extended entity type models.
  - `schemas/attribute_definitions.json`: Attribute specifications.
  - `schemas/relationship_types.json`: Relationship definitions.
  - `data/records.ndjson`: Line-delimited JSON records.
  - `data/entity_relationships.ndjson`: Line-delimited graph edges.

### 3. Micro-Batch Hard-Purge Engine (`TenantPurgeService.java`)
- Runs in a transaction-managed micro-batch loop:
  - **Stage 1 (Graph Edge Wipe):** Delete `UNIPOST_ENTITY_RELATIONSHIPS` where `tenant_id = :targetTenant` in micro-batches of 5,000 rows.
  - **Stage 2 (Record Batch Purge):** Delete `UNIPOST_ENTITIES` where `tenant_id = :targetTenant` in micro-batches of 5,000 rows.
  - **Stage 3 (Metadata Overlays Wipe):** Delete tenant `UNIPOST_ATTRIBUTE_DEFINITIONS`, `UNIPOST_RELATIONSHIP_TYPES`, `UNIPOST_ENTITY_TYPES` (strictly excluding `tenant_id = 'SYSTEM'`).
  - **Stage 4 (Distributed Cache Eviction):** Evict all L1 memory and L2 Hazelcast cache keys for `schema:{targetTenant}:*`.
  - **Stage 5 (Audit Receipt Generation):** Produce immutable `CertificateOfErasure`.

### 4. REST Controller Endpoints (`TenantDataLifecycleController.java`)
- `GET /api/v1/metadata/tenants/{tenantId}/export`: Streams ZIP archive (`application/zip`) with `Content-Disposition: attachment; filename="tenant_export_{tenantId}_{timestamp}.zip"`.
- `POST /api/v1/metadata/tenants/{tenantId}/purge`: Executes GDPR hard-purge pipeline and returns `CertificateOfErasure`. Guarded by `hasRole('ADMIN')` or `hasAuthority('TENANT_COMPLIANCE_PURGE')`.

---

## Verification Plan

### Automated Tests
1. `TenantExportServiceTest`:
   - Provisions a test tenant with entities, attributes, and records.
   - Executes streaming export to a byte buffer / temporary ZIP stream.
   - Unzips and verifies presence and valid JSON structure of `manifest.json`, `schemas/entity_types.json`, `data/records.ndjson`, and `data/entity_relationships.ndjson`.
2. `TenantPurgeServiceTest`:
   - Verifies 5-stage micro-batch purge completely removes tenant records, relationships, and custom metadata.
   - Verifies system schemas (`tenant_id = 'SYSTEM'`) remain untouched.
   - Verifies sibling tenant records remain completely isolated and intact.
   - Verifies `CertificateOfErasure` contains correct SHA-256 tenant hash and counts.
3. Regression Testing:
   - `mvnw test -Dtest=TenantRateLimitServiceTest,SafeSchemaValidationTest,TenantProvisioningServiceTest,TenantExportServiceTest,TenantPurgeServiceTest`.
