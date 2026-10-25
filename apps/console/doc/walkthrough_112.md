# Walkthrough 112: Phase 43 — Adaptive Read-Time Resolution Engine (Dynamic SQL Pushdown & Pagination)

## Overview
Phase 43 implements the **Adaptive Read-Time Resolution Engine** for synthesized composite entity types. It provides:
1. **Dynamic SQL Pushdown Compiler (`DynamicQueryCompiler`)**: Compiles `CompositeSpec` AST structures into single-roundtrip PostgreSQL queries using `LEFT JOIN LATERAL`, windowed child pagination (`ROW_NUMBER() / COUNT(*) OVER ()`), and `jsonb_build_object` / `jsonb_agg` projections.
2. **Resilient Dual-Engine Execution (`CompositeRecordService`)**: Applies a strict `1,500ms` statement timeout (`SET LOCAL statement_timeout = '1500ms'`) for dynamic SQL pushdown and automatically falls back to in-memory batch resolution (`DataLoaderBatchResolver`) upon timeout or planner exception.
3. **Dedicated REST API Endpoints (`CompositeEntityController`)**: Exposes `GET /api/v1/metadata/composite-entities/{id}/records` and `GET /api/v1/metadata/composite-entities/{id}/records/{recordId}` supporting bracket-notated child pagination (`childLimit[alias]=10&childOffset[alias]=0`) and returning the `X-Composite-Engine` header.
4. **Console UI Master-Detail Expandable DataGrid (`CompositeMasterDetailRow` & `EntityDataGrid`)**: Renders expandable rows for composite entities in the Metadata Data Explorer, revealing indented Liquid Glass sub-tables with child collection tabs, micro-pagination controls, and engine execution badges.
5. **Unified Sandbox Platform Parity (`MockMetadataService` & `metadataSandboxAdapter`)**: Complete in-memory graph traversal and child collection slicing matching backend behavior for offline development and local simulation.

---

## Changes Summary

### 1. Backend Core & REST Endpoints (`apps/backend/acc-fw`)
- [`DynamicQueryCompiler.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/DynamicQueryCompiler.java): Single-pass SQL compiler for Pattern B (Foreign Key) and Pattern C (Association Matrix `UNIPOST_ENTITY_RELATIONSHIPS`) with quoted `"deletedDate" IS NULL` soft-delete checks.
- [`DataLoaderBatchResolver.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/DataLoaderBatchResolver.java): Resilient fallback batch resolver traversing entity records and relationships in memory.
- [`CompositeRecordService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/CompositeRecordService.java): Orchestration service with `1500ms` statement timeout enforcement and graceful fallback.
- [`CompositeEntityController.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/CompositeEntityController.java): REST controller with bracket notation parameter parsing and `X-Composite-Engine` response header.
- DTOs: [`ChildPaginationParam.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/ChildPaginationParam.java), [`ChildPaginationMetadata.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/ChildPaginationMetadata.java), [`CompositeRecordResponse.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/CompositeRecordResponse.java).

### 2. Client Contracts & Console Services (`packages/client`, `apps/console`)
- [`contracts/metadata.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/client/src/contracts/metadata.ts): Exported `ChildPaginationMetadata`, `CompositeRecordResponse`, and `CompositeRecordPageResponse`.
- [`metadata-data-source.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/metadata-data-source.ts): Added `getCompositeRecords` and `getCompositeRecordById` contract definitions.
- [`http-metadata-service.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/http-metadata-service.ts): Serializes bracket notation `childLimit[alias]` / `childOffset[alias]` parameters to HTTP endpoints.
- [`mock-metadata.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/data/mock-metadata.ts): Implemented in-memory graph resolution with Pattern B & Pattern C slicing for `Customer 360 View`.
- [`metadata-service.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/metadata-service.ts): Delegated composite methods through mode strategy (`http` vs `mock`).
- [`metadata-api.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/api/metadata-api.ts): Added `useCompositeRecords` and `useCompositeRecord` React Query hooks.
- [`metadata-sandbox-adapter.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts): Added route handlers matching `/composite-entities/:id/records` and `/composite-entities/:id/records/:recordId`.

### 3. Console UI Master-Detail DataGrid (`apps/console`)
- [`composite-master-detail-row.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/composite-master-detail-row.tsx): Liquid Glass master-detail container with child collection tabs, join pattern indicators, micro-pagination controls, and engine badges.
- [`entity-data-grid.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx): Added row expander column and conditional rendering of `CompositeMasterDetailRow` for composite entities.

---

## Verification Results

### Backend Unit Tests
Executed Maven test suite covering `DynamicQueryCompilerTest` and `CompositeRecordServiceTest`:
```
mvn test -f apps/backend/pom.xml -pl acc-fw "-Dtest=*Composite*,DynamicQueryCompilerTest,CompositeRecordServiceTest" -q
[INFO] Results:
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

### Frontend Vitest Tests
Executed Vitest suite covering `CompositeMasterDetailRow`:
```
pnpm --filter @acc/console exec vitest run src/features/metadata/components/data-explorer/composite-master-detail-row.test.tsx src/features/metadata/components/studio/composite/composite-bento-studio.test.tsx
 ✓ src/features/metadata/components/data-explorer/composite-master-detail-row.test.tsx (4 tests) 118ms
 ✓ src/features/metadata/components/studio/composite/composite-bento-studio.test.tsx (3 tests) 92ms

 Test Files  2 passed (2)
      Tests  7 passed (7)
```
