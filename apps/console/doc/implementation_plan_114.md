# Implementation Plan 114: Phase 44 - Composite Computed Rollups, Aggregate Projections & Deep Child Filtering

## 1. Executive Summary & Architectural Overview
Phase 44 enhances the Unipost metadata engine's **Adaptive Read-Time Resolution Engine** with **declarative computed aggregate rollups** and **deep child collection filtering and sorting**, without introducing physical data duplication, pre-rendered document stores, or eventual consistency lag.

In accordance with architectural grilling decisions:
1. **Zero Pre-Rendered Data / Pure Live Pushdown**:
   - Physical document materialization (`UNIPOST_MATERIALIZED_COMPOSITE_DOCUMENTS`) and background coalescing workers are completely avoided.
   - All aggregations and filtered projections execute in real time via PostgreSQL single-roundtrip pushdown queries in `DynamicQueryCompiler`.
2. **Companion Lateral Aggregation Subqueries**:
   - Because child sub-collections are paginated (e.g., `LIMIT 10 OFFSET 0`), computed rollups (e.g., `total_spend = SUM(orders.total)`, `resource_count = COUNT(cloud_resources)`) MUST compute across the **entire unpaginated child population**.
   - `DynamicQueryCompiler` compiles an unpaginated companion `LEFT JOIN LATERAL (SELECT COUNT(*), SUM(...) ...) rollup_agg ON TRUE` alongside the paginated child slice.
3. **Deep Child Filtering & Sorting Protocol**:
   - `CompositeEntityController` accepts an encoded JSON parameter `?childQueries=<url-encoded-json>`:
     ```json
     {
       "orders": {
         "limit": 10,
         "offset": 0,
         "sort": "total_amount:desc",
         "filters": {
           "status": { "op": "eq", "value": "COMPLETED" },
           "total_amount": { "op": "gte", "value": 100 }
         }
       }
     }
     ```
   - Standard operators supported: `eq`, `like` / `contains`, `gte`, `lte`, `in`.
   - All filter values are bound as parameterized variables (`:child_filter_...`); attributes and sort directions are strictly whitelisted against `UNIPOST_ATTRIBUTE_DEFINITIONS`.
4. **Console UI Bento Studio & Master-Detail View**:
   - **VisualSchemaStudio**: Rollup Builder in the center canvas with live JSON & SQL preview in `CompositePreviewHub`.
   - **CompositeMasterDetailRow**: Top KPI Bento Chips rendering rollup metrics (`[💰 Total Spend: $1,420.50]`, `[☁️ Active Resources: 8]`) + child tab search inputs and column sort headers.
5. **Unified Sandbox Parity**:
   - `metadata-sandbox-adapter.ts` and `mock-metadata.ts` provide 100% offline simulation for child filtering, sorting, and live rollup recalculation.

---

## 2. Proposed Changes

### A. Domain & Contracts Layer (`packages/client` & `apps/backend/acc-fw`)
- **Domain Records**:
  - Create `CompositeRollup.java`:
    - `alias` (String)
    - `targetNodeAlias` (String)
    - `aggregateFunction` (Enum: `SUM`, `COUNT`, `AVG`, `MIN`, `MAX`)
    - `targetField` (String, optional for `COUNT`)
    - `filterPredicate` (String, optional)
  - Update `CompositeSpec.java` and `CompositeNode.java` with `@JsonProperty("rollups") List<CompositeRollup> rollups`.
  - Update `packages/client/src/contracts/metadata.ts`:
    - Define `CompositeRollup` interface and `AggregateFunction` type (`'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX'`).
    - Add `rollups?: CompositeRollup[]` to `CompositeSpec` and `CompositeNode`.
    - Define `ChildQueryFilter` and `ChildQueryParams` contract.

### B. SQL Compiler & Service Layer (`apps/backend/acc-fw`)
- **Query Parameter DTOs**:
  - Create `ChildFilterCriteria.java` (`op`, `value`) and `ChildQueryOptions.java` (`limit`, `offset`, `sort`, `filters`).
- **`DynamicQueryCompiler.java`**:
  - Add companion lateral aggregation builder:
    - Generates `LEFT JOIN LATERAL (SELECT ... FROM UNIPOST_ENTITIES ...) <alias>_rollup ON TRUE`.
    - Embeds computed rollup fields directly into root/parent `jsonb_build_object`.
  - Add dynamic child filtering & sorting compiler:
    - Injects `AND (attributes->>:filterKey)::type <op> :filterVal` into child subqueries with parameterized variables.
    - Adds `ORDER BY (attributes->>:sortCol) <ASC|DESC>` prior to child `LIMIT :limit OFFSET :offset`.
- **`CompositeRecordService.java` & `CompositeEntityController.java`**:
  - Update `getCompositeRecord` and `listCompositeRecords` to accept optional `@RequestParam(required = false) String childQueries`.
  - Parse `childQueries` JSON into `Map<String, ChildQueryOptions>` and forward to `DynamicQueryCompiler`.

### C. Frontend Bento Studio (`apps/console`)
- **Studio Rollup Builder**:
  - Create `apps/console/src/features/metadata/components/studio/composite/composite-rollup-builder.tsx`:
    - Allows operators to add, configure, and delete rollups with target collection dropdown, function selector, and attribute picker.
  - Integrate into `CompositeProjectionCanvas.tsx`.
- **Preview Hub Updates**:
  - Update `CompositePreviewHub.tsx` to preview companion lateral SQL queries and mock rollup outputs.

### D. Frontend Master-Detail View (`apps/console`)
- **`CompositeMasterDetailRow.tsx`**:
  - Add frosted glass KPI Bento Chips bar above child tabs displaying rollup metrics.
  - Add inline search filter input on child sub-collection tabs.
  - Add column header sort toggles.
  - Bind child search and sort state to `childQueries` parameter when fetching composite record details.

### E. Unified Sandbox Platform (`apps/console`)
- **`mock-metadata.ts`**:
  - Update `Customer 360 View` seed with sample rollups:
    - `total_spend = SUM(orders.total)`
    - `resource_count = COUNT(cloud_resources)`
- **`metadata-sandbox-adapter.ts`**:
  - Parse `childQueries` parameter in sandbox route handler.
  - Implement client-side filtering, sorting, and rollup calculation over mock datasets.

---

## 3. Verification & Automated Test Strategy

1. **Backend Unit & Integration Tests**:
   - `DynamicQueryCompilerTest.java`:
     - Test companion lateral aggregate SQL generation for `COUNT` and `SUM`.
     - Test unpaginated rollup accuracy with child `limit`/`offset`.
     - Test child filtering with `eq`, `gte`, `like` operators and parameter binding.
     - Test child sorting with SQL injection prevention.
   - `CompositeRecordServiceTest.java`:
     - Test end-to-end execution with rollups and child query filters.
2. **Frontend Vitest Suites**:
   - `composite-master-detail-row.test.tsx`:
     - Verify KPI Bento Chips render rollup values.
     - Verify child tab search input triggers query updates.
   - `composite-bento-studio.test.tsx`:
     - Verify adding and configuring a rollup in Bento Studio.
3. **Typecheck & Monorepo Build**:
   - `pnpm --filter @acc/console exec tsc --noEmit`
   - `pnpm check-types`
