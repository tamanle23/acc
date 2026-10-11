# History Log 056: GDPR Article 20 Streaming ZIP Archive Pipeline (Phase 18)

## Problem
Multi-gigabyte tenant data exports under GDPR Article 20 data portability can cause severe JVM heap OOM (Out Of Memory) failures if all entity records, relationships, and metadata definitions are buffered in memory before being compressed and returned over HTTP.

## Plan
1. **Repository Query Optimization (`EntityRecordRepository.java`)**:
   - Add RLS-safe tenant and entity type paginated query methods: `findByEntityTypeIdAndTenantIdAndDeletedDateIsNull(Long entityTypeId, String tenantId, Pageable pageable)`.
2. **Streaming Export Service Hardening (`TenantExportService.java`)**:
   - Implement `streamTenantArchive(tenantId, targetOutputStream)` piping records directly through `ZipOutputStream` in line-delimited micro-chunks (chunk size 1,000) directly to the response `OutputStream`.
   - Calculate an incremental SHA-256 integrity digest across the archive entries during streaming.
   - Generate full bundle structure:
     - `manifest.json`: Includes SHA-256 digest, execution timestamp, and record counts.
     - `schemas/`: Includes `entity_types.json`, `attribute_definitions.json`, `relationship_types.json`, and Draft-07 `{entity_type}.schema.json` compiled via `SchemaCompiler`.
     - `records/`: Includes per-entity-type streaming `{entity_type}.jsonl` (JSON Lines) and sanitized `{entity_type}.csv` exports.
     - `data/`: Includes flat `records.ndjson` and `entity_relationships.ndjson`.
     - `media/`: Includes `assets.json` file catalog.
3. **Controller Non-Blocking Streaming Endpoint (`TenantDataLifecycleController.java`)**:
   - Expose `GET /api/v1/metadata/tenants/{tenantId}/export-stream` returning `ResponseEntity<StreamingResponseBody>`.
4. **Testing & Verification**:
   - Implement unit test `testStreamingExportCreatesValidZip` in `TenantExportServiceTest` asserting ZIP bundle layout, Draft-07 schemas, CSV output, and SHA-256 manifest calculation.
   - Implement volume stress test `testLargeVolumeStreamingExportMemoryBounds` streaming 50,000 records across 50 chunked pages and verifying heap memory delta remains strictly bounded (< 256MB).
   - Execute full verification: `pnpm turbo run check-types`, `pnpm turbo run test`, and `pnpm --filter @unipost/console test:e2e`.

## Changes
- **`apps/backend/unipost-fw/src/main/java/com/unipost/repository/jpa/EntityRecordRepository.java`**: Added tenant and entity type paginated query methods.
- **`apps/backend/unipost-fw/src/main/java/com/unipost/tenant/export/TenantExportManifest.java`**: Added `sha256Digest` field to manifest record.
- **`apps/backend/unipost-fw/src/main/java/com/unipost/tenant/export/TenantExportService.java`**: Implemented streaming ZIP archive generation with Draft-07 schemas, JSONL/CSV entries, and SHA-256 checksums.
- **`apps/backend/unipost-fw/src/main/java/com/unipost/presentation/TenantDataLifecycleController.java`**: Added `GET /api/v1/metadata/tenants/{tenantId}/export-stream` returning `ResponseEntity<StreamingResponseBody>`.
- **`apps/backend/unipost-fw/src/test/java/com/unipost/tenant/export/TenantExportServiceTest.java`**: Added unit and 50,000-record streaming volume memory tests.

## Verification
- `TenantExportServiceTest`: **2/2 passed** (Valid ZIP bundle and 50,000-record heap memory bounds confirmed).
- `pnpm turbo run check-types`: **4/4 passed** (0 errors).
- `pnpm turbo run test`: **6/6 passed** (All monorepo test suites green).
- `pnpm --filter @unipost/console test:e2e`: **3/3 passed** (Chromium headless with Axe WCAG 2.2 AA audit).
