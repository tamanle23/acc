# Implementation Plan 112: Phase 43 - Adaptive Read-Time Resolution Engine (Dynamic SQL Pushdown & Pagination)

## 1. Overview
Phase 43 delivers the **Adaptive Read-Time Resolution Engine** across the Acc monorepo. It empowers the metadata platform to dynamically resolve complex hierarchical composite entity documents (up to depth 4) in a **single database roundtrip** using PostgreSQL `jsonb_build_object`, `jsonb_agg`, and `LEFT JOIN LATERAL` over Pattern B foreign keys and Pattern C association matrices (`UNIPOST_ENTITY_RELATIONSHIPS`).

The engine introduces native **per-child collection pagination** (`childLimit[alias]` / `childOffset[alias]`), bounded guardrails (1,500ms statement timeout), an automated resilient fallback to **`DataLoaderBatchResolver`** on planner or timeout issues, dedicated REST endpoints, an expandable **Liquid Glass Master-Detail** view in `@acc/console`'s `EntityDataGrid`, and full **Unified Sandbox Platform** simulation.

---

## 2. User Review & Architectural Alignment
All architectural decisions were grilled and agreed upon:
1. **Dedicated REST Endpoints**:
   - `GET /api/v1/metadata/composite-entities/{id}/records`: Root-paginated list of composite records for composite entity type `{id}`.
   - `GET /api/v1/metadata/composite-entities/{id}/records/{recordId}`: Single composite record with its nested sub-graphs.
2. **Child Pagination Format**:
   - Bracket notation query parameters: `childLimit[orders]=10&childOffset[orders]=0`.
   - Safe default ceiling: 50 items per nested sub-collection if omitted.
3. **Resilient Dual Execution Engine**:
   - Primary: `DynamicQueryCompiler` (PostgreSQL single-roundtrip `LEFT JOIN LATERAL` with `jsonb_build_object` / `jsonb_agg`).
   - Timeout Guardrail: `1,500ms` via `SET LOCAL statement_timeout = '1500ms'`.
   - Fallback: `DataLoaderBatchResolver` on statement timeout (`57014`) or planner error.
   - Traceability: Response header `X-Composite-Engine: dynamic-sql-pushdown` or `X-Composite-Engine: dataloader-fallback`.
4. **Console UI Presentation**:
   - Expandable master-detail rows in `EntityDataGrid` for composite entity types, revealing indented Liquid Glass nested sub-tables for each child collection with independent micro-pagination controls.
5. **Unified Sandbox Simulation**:
   - In-memory graph resolver in `mockMetadataStore` traversing `compositeSpec` against in-memory records and relationships, slicing child collections according to limits/offsets.

---

## 3. Work Breakdown

### Workstream 1: Backend Dynamic Query Compiler & AST Execution (`acc-fw`)
- **`DynamicQueryCompiler.java`**:
  - Compiles `CompositeSpec` AST into executable parameterized PostgreSQL query with:
    - Root projection: `jsonb_build_object` with standard envelope (`id`, `tenantId`, `entityTypeId`, `is_composite: true`) and projected attributes from `spec.fields()`.
    - Child projections: `LEFT JOIN LATERAL` subqueries for each `CompositeNode` in `spec.children()`:
      - Pattern B (`PATTERN_B_FOREIGN_KEY`): `(child.attributes->>'fk_attribute')::text = root.id::text`.
      - Pattern C (`PATTERN_C_ASSOCIATION`): Join `UNIPOST_ENTITY_RELATIONSHIPS rel ON rel.target_entity_id = child.id WHERE rel.source_entity_id = root.id AND rel.relationship_type_id = :relTypeId`.
      - `ONE_TO_MANY`: Subquery with `LIMIT :childLimit OFFSET :childOffset` aggregated via `jsonb_agg(...)`.
      - `ONE_TO_ONE`: Subquery with `LIMIT 1` projected via `jsonb_build_object(...)`.
      - Soft-delete filtering: `deleted_date IS NULL` across all joins.
      - Tenant isolation: `tenant_id = :tenantId` across root and child subqueries.
    - Child collection count subquery: to return `totalElements` for each child collection pagination metadata.
- **`CompositeQueryParameters.java`**:
  - Encapsulates root page request + `Map<String, ChildPaginationParam>` for child collections.

### Workstream 2: Resilient Batch Fallback (`DataLoaderBatchResolver`)
- **`DataLoaderBatchResolver.java`**:
  - Implements in-memory batch resolution:
    1. Fetches root records for the page via standard JPA/repository.
    2. Collects root IDs: `List<Long> rootIds`.
    3. For each child node in `spec.children()`:
       - Pattern B: Queries child entity records where `attributes->>'fk_id' IN (:rootIds)`.
       - Pattern C: Queries relationships where `source_entity_id IN (:rootIds)`.
       - Slices child lists in-memory per root record based on child pagination limits.
    4. Merges into composite document envelopes.

### Workstream 3: Composite Query Execution Service & Controller
- **`CompositeRecordService.java`**:
  - Orchestrates execution:
    - Verifies entity type exists and `isComposite == true`.
    - Attempts `DynamicQueryCompiler` execution using `NamedParameterJdbcTemplate` with `1,500ms` statement timeout.
    - Catches `QueryTimeoutException` / PostgreSQL `57014` and falls back to `DataLoaderBatchResolver`.
    - Attaches engine header: `X-Composite-Engine`.
- **DTOs**:
  - `CompositeRecordResponse.java`: Envelope holding record ID, tenantId, entityTypeId, attributes (including nested child collections), child pagination metadata.
  - `ChildPaginationMetadata.java`: `totalElements`, `limit`, `offset`, `hasMore`.
- **`CompositeEntityController.java`**:
  - `GET /v1/metadata/composite-entities/{id}/records`
  - `GET /v1/metadata/composite-entities/{id}/records/{recordId}`
  - Parses bracket query parameters (`childLimit[...]`, `childOffset[...]`).

### Workstream 4: Backend Integration & Unit Tests
- `DynamicQueryCompilerTest.java`: Validates SQL generation for Pattern B, Pattern C, 1:1, 1:N, child limit/offset, and nested sub-aggregates.
- `CompositeRecordServiceTest.java`: Tests single-roundtrip execution, child pagination, and fallback to DataLoader on simulated statement timeout.

### Workstream 5: Client Contracts & Console API Layer
- **`packages/client/src/contracts/metadata.ts`**:
  - Add `CompositeRecordResponse`, `ChildPaginationMetadata`, `CompositePageResponse`.
- **`apps/console/src/features/metadata/api/`**:
  - Update `MetadataDataSource`, `http-metadata-service.ts`, `metadata-service.ts`.
  - Add React Query hooks in `metadata-api.ts`:
    - `useCompositeRecords(compositeTypeId, rootParams, childParams)`
    - `useCompositeRecord(compositeTypeId, recordId, childParams)`

### Workstream 6: Console UI Master-Detail Expandable DataGrid
- **`apps/console/src/features/metadata/components/data-explorer/composite-master-detail-row.tsx`**:
  - Expandable row container rendered within `EntityDataGrid`.
  - Indented Liquid Glass styling with frosted background and specular border.
  - Child collection tabs/accordions: Displays child records in nested clean tables.
  - Sub-collection micro-pagination controls (`Previous`, `Next`, item count badge `Showing 1-10 of 42`) updating child parameters.
- **`apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`**:
  - Detects if active entity type `isComposite == true`.
  - Adds row expansion column with animated chevron.
  - Renders `CompositeMasterDetailRow` when expanded.

### Workstream 7: Unified Sandbox Platform Parity
- **`mock-metadata.ts`**:
  - Implement `getCompositeRecords` and `getCompositeRecordById`:
    - In-memory graph traversal matching Pattern B foreign keys and Pattern C relations against `this.records`.
    - Performs child array slicing based on `childLimit` / `childOffset`.
    - Returns `CompositeRecordResponse` with child pagination metadata.
- **`metadata-sandbox-adapter.ts`**:
  - Route handlers for `/composite-entities/:id/records` and `/composite-entities/:id/records/:recordId`.

---

## 4. Verification Plan

### Automated Test Suites
1. **Backend Tests**:
   - `DynamicQueryCompilerTest`: SQL generation syntax, Pattern B/C joins, parameter bindings.
   - `CompositeRecordServiceTest`: Happy path pushdown, child pagination slicing, and DataLoader fallback on timeout.
   - Run via:
     ```powershell
     & "C:\Users\Admin\.m2\wrapper\dists\apache-maven-3.9.9-bin\6gbr3tfuiv8aocduf5pro8ephc\apache-maven-3.9.9\bin\mvn.cmd" test -f apps/backend/pom.xml -pl acc-fw "-Dtest=*Composite*,DynamicQueryCompilerTest" -q
     ```
2. **Frontend Tests**:
   - `composite-master-detail-row.test.tsx`: Master-detail expansion, child collection tabs, and micro-pagination interaction.
   - Run via:
     ```powershell
     pnpm --filter @acc/console exec vitest run src/features/metadata/components/data-explorer/composite-master-detail-row.test.tsx
     ```
3. **Monorepo Lint & Type Check**:
   - `pnpm --filter @acc/console exec tsc -b`
