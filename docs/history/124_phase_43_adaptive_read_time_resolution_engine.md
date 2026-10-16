# 124. Phase 43: Adaptive Read-Time Resolution Engine (Dynamic SQL Pushdown & Pagination)

## Problem Statement
While Phase 41 delivered the declarative `CompositeSpec` AST DSL and Phase 42 implemented the atomic base mutation pipeline, querying composite entities required an adaptive, high-throughput read-time resolution engine. A naive application-tier N+1 query loop across multiple child entities (Pattern B foreign keys and Pattern C association matrices) causes massive database connection overhead and high latency when loading data grids with nested collections. Furthermore, large child sub-collections (e.g. hundreds of orders or tickets per customer) required independent windowed pagination per sub-collection without inflating root document payload sizes or blocking thread pools.

## Plan & Architecture
1. **Dynamic SQL Pushdown Compiler (`DynamicQueryCompiler`)**:
   - Compiles declarative `CompositeSpec` ASTs into single-roundtrip PostgreSQL queries.
   - Utilizes `LEFT JOIN LATERAL` with `jsonb_build_object` and `jsonb_agg` for root and child collection synthesis.
   - Embeds windowed pagination (`ROW_NUMBER() / COUNT(*) OVER ()`) inside child subqueries to return exact child slices and true `totalElements` count simultaneously.
   - Strictly enforces soft-delete safety by quoting PostgreSQL column `"deletedDate" IS NULL`.
2. **Resilient Dual Execution Engine (`CompositeRecordService`)**:
   - Enforces a statement timeout guardrail (`SET LOCAL statement_timeout = '1500ms'`).
   - Seamlessly falls back to an in-memory batch resolver (`DataLoaderBatchResolver`) upon statement timeout (`57014`) or query planner failure.
   - Emits the execution engine via `X-Composite-Engine` HTTP response header (`dynamic-sql-pushdown` or `dataloader-fallback`).
3. **Dedicated REST API Endpoints (`CompositeEntityController`)**:
   - Exposes `GET /api/v1/metadata/composite-entities/{id}/records` for root-paginated composite documents.
   - Exposes `GET /api/v1/metadata/composite-entities/{id}/records/{recordId}` for single-record retrieval.
   - Supports bracket notation query parameters: `childLimit[alias]=10&childOffset[alias]=0` with a default ceiling of 50 items.
4. **Console UI Master-Detail Expandable DataGrid (`CompositeMasterDetailRow` & `EntityDataGrid`)**:
   - Adds an expandable chevron column on `EntityDataGrid` for composite entity types.
   - Renders an indented Liquid Glass container (`CompositeMasterDetailRow`) with child collection tabs, Pattern B / Pattern C metadata ribbons, micro-pagination controls (`Previous`, `Next`, item count), and engine execution badges.
5. **Unified Sandbox Platform Parity (`MockMetadataService` & `metadataSandboxAdapter`)**:
   - Supports in-memory graph traversal across Pattern B foreign keys and Pattern C relationships.
   - Implements child collection slicing and pagination metadata matching backend behavior for offline development.

## Changes

### Backend (`apps/backend/unipost-fw`)
- `com.unipost.presentation.dto.metadata`:
  - `ChildPaginationParam.java`: Request parameter for child collection pagination.
  - `ChildPaginationMetadata.java`: Response DTO for child collection counts and pagination state.
  - `CompositeRecordResponse.java`: Full composite document response envelope with child pagination map and `engineUsed`.
- `com.unipost.service`:
  - `DynamicQueryCompiler.java`: Compiles `CompositeSpec` into single-pass PostgreSQL SQL with `LEFT JOIN LATERAL` and windowed pagination.
  - `DataLoaderBatchResolver.java`: In-memory fallback batch resolver for Pattern B and Pattern C.
  - `CompositeRecordService.java`: Orchestration service enforcing `1500ms` statement timeout and fallback.
- `com.unipost.presentation`:
  - `CompositeEntityController.java`: Endpoints `GET /{id}/records` and `GET /{id}/records/{recordId}` with bracket notation parameter parsing and `X-Composite-Engine` header.
- Unit Tests:
  - `DynamicQueryCompilerTest.java`: Validates SQL syntax, parameters, and ceiling guards.
  - `CompositeRecordServiceTest.java`: Validates fallback resolution and error handling.

### Client & Console (`packages/client`, `apps/console`)
- `packages/client/src/contracts/metadata.ts`: Added `ChildPaginationMetadata`, `CompositeRecordResponse`, and `CompositeRecordPageResponse`.
- `apps/console/src/features/metadata/api`:
  - `metadata-data-source.ts`, `http-metadata-service.ts`, `metadata-service.ts`: Added `getCompositeRecords` and `getCompositeRecordById`.
  - `metadata-api.ts`: Added `useCompositeRecords` and `useCompositeRecord` React Query hooks.
- `apps/console/src/features/metadata/data/mock-metadata.ts`:
  - Implemented `getCompositeRecords`, `getCompositeRecordById`, and `resolveCompositeRecord` in `MockMetadataService`.
- `apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts`:
  - Handled `/composite-entities/:id/records` and `/composite-entities/:id/records/:recordId` with bracket parameter parsing.
- `apps/console/src/features/metadata/components/data-explorer`:
  - `composite-master-detail-row.tsx`: Master-detail view for child collections with tabs, micro-pagination, and engine badges.
  - `composite-master-detail-row.test.tsx`: Vitest tests for rendering, tab switching, and micro-pagination.
  - `entity-data-grid.tsx`: Integrated expander column and `CompositeMasterDetailRow` rendering for composite entities.

## Verification
- **Backend Tests**:
  - `mvn test -f apps/backend/pom.xml -pl unipost-fw "-Dtest=*Composite*,DynamicQueryCompilerTest,CompositeRecordServiceTest" -q`
  - All 5 unit tests passed with 0 failures and 0 errors.
- **Frontend Tests**:
  - `pnpm --filter @unipost/console exec vitest run src/features/metadata/components/data-explorer/composite-master-detail-row.test.tsx src/features/metadata/components/studio/composite/composite-bento-studio.test.tsx`
  - All 7 tests passed with 0 failures.

## Walkthrough & Artifacts
- Plan: [`apps/console/doc/implementation_plan_112.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/doc/implementation_plan_112.md)
- Walkthrough: [`apps/console/doc/walkthrough_112.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/doc/walkthrough_112.md)
