# [126] Phase 44: Composite Computed Rollups & Deep Child Filtering

## Problem
In composite entity aggregates, child sub-collections are paginated (e.g., 10 or 50 records per page), which previously made it impossible to project aggregate summary metrics (e.g. `total_spend = SUM(orders.total)` or `total_resources = COUNT(*)`) across the entire unpaginated child population. Furthermore, clients could not filter (e.g. `status = 'ACTIVE'`, `total >= 100`) or sort child collections without loading all records into memory. Attempting to physically pre-render and materialize these aggregates into separate database tables caused storage bloat, cache invalidation storms, and eventual consistency lag.

## Plan
1. **Domain & Contracts**:
   - Model `CompositeRollup` as an immutable record (`alias`, `targetNodeAlias`, `aggregateFunction`, `targetField`, `filterPredicate`).
   - Add `rollups` list to `CompositeSpec` and `CompositeNode`.
   - Update `packages/client/src/contracts/metadata.ts` with TypeScript interfaces and `ChildQueryParams` contracts.
2. **Companion Lateral Pushdown Compiler**:
   - Enhance `DynamicQueryCompiler` to compile unpaginated `LEFT JOIN LATERAL (SELECT ... FROM UNIPOST_ENTITIES c_agg ...) rollup_agg ON TRUE` companion queries alongside child collection slices.
   - Project computed rollups into root `composite_document` JSON.
   - Inject schema-whitelisted dynamic filters (`eq`, `like`, `contains`, `gte`, `lte`, `in`) with parameterized variable bindings.
   - Inject dynamic child sort orders (`ORDER BY (c.attributes->>'col') DESC`).
3. **Controller & Service Layer**:
   - Update `CompositeEntityController` and `CompositeRecordService` to parse `?childQueries=<url-encoded-json>` and legacy bracket parameters.
4. **Console Bento Studio & Master-Detail View**:
   - Build `CompositeRollupBuilder.tsx` in `VisualSchemaStudio` allowing operators to visually configure computed aggregates.
   - Update `CompositePreviewHub.tsx` to preview companion lateral SQL queries and mock rollup values.
   - Render frosted glass KPI Bento chips in `CompositeMasterDetailRow.tsx` for computed rollups.
   - Add inline search filter input and column sort headers on child sub-collection tabs.
5. **Unified Sandbox Parity**:
   - Seed `Customer 360 View` with rollups (`total_vcpu`, `total_resources`, `total_policies`).
   - Implement live rollup calculation, child filtering, and sorting in `mock-metadata.ts` and `metadata-sandbox-adapter.ts`.
6. **Automated Verification**:
   - Unit tests covering companion lateral SQL generation, parameter binding, rollups, and filtering/sorting.
   - Vitest tests covering Master-Detail row rollup chips, search filtering, and column sorting.

## Changes
- `apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/CompositeRollup.java`: Domain record for computed rollups.
- `apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/CompositeSpec.java` & `CompositeNode.java`: Extended with `rollups`.
- `apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/ChildFilterCriteria.java` & `ChildQueryOptions.java`: Query parameter DTOs.
- `apps/backend/acc-fw/src/main/java/com/acc/service/DynamicQueryCompiler.java`: Companion lateral queries, dynamic filters, and custom child sorting.
- `apps/backend/acc-fw/src/main/java/com/acc/service/CompositeRecordService.java`: Overloaded with `ChildQueryOptions`.
- `apps/backend/acc-fw/src/main/java/com/acc/presentation/CompositeEntityController.java`: `childQueries` parameter parser.
- `apps/backend/acc-fw/src/test/java/com/acc/service/DynamicQueryCompilerTest.java`: Rollup and child filtering/sorting tests.
- `packages/client/src/contracts/metadata.ts`: Added rollup and query types.
- `apps/console/src/features/metadata/components/studio/composite/composite-rollup-builder.tsx`: Rollup configuration UI.
- `apps/console/src/features/metadata/components/studio/composite/composite-projection-canvas.tsx`: Embedded rollup builder.
- `apps/console/src/features/metadata/components/studio/composite/composite-preview-hub.tsx`: Preview hub rollup and companion lateral query support.
- `apps/console/src/features/metadata/components/data-explorer/composite-master-detail-row.tsx`: KPI Bento chips, search filter, and column sort headers.
- `apps/console/src/features/metadata/components/data-explorer/composite-master-detail-row.test.tsx`: Master-detail Vitest suite.
- `apps/console/src/features/metadata/components/studio/composite/composite-bento-studio.test.tsx`: Studio Vitest suite.
- `apps/console/src/features/metadata/data/mock-metadata.ts`: Seeded rollups and simulated filtering/sorting/rollups.
- `apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts`: Routed `childQueries`.
- `apps/console/ROUTE.md`: Updated Section 3.8.
- `apps/console/doc/implementation_plan_114.md` & `apps/console/doc/walkthrough_114.md`: Paired feature documentation.

## Verification
- **Backend Tests**: `DynamicQueryCompilerTest`, `CompositeRecordServiceTest`, `CompositeEntityTypeVerificationTest`, and `RecordMutationPipelineTest` passed (25/25 total tests, 0 failures).
- **Frontend Vitest Suites**:
  - `composite-master-detail-row.test.tsx`: 7/7 tests passed.
  - `composite-bento-studio.test.tsx`: 4/4 tests passed.
  - `visual-schema-studio.test.tsx`: 8/8 tests passed.
- **Frontend Typecheck**: `pnpm --filter @acc/console exec tsc --noEmit` passed with 0 errors.

## Walkthrough
Detailed blueprint and verification logs available in `apps/console/doc/walkthrough_114.md`.

## Tasks
- [x] Create `CompositeRollup.java` and update `CompositeSpec` / `CompositeNode`
- [x] Create `ChildFilterCriteria.java` and `ChildQueryOptions.java`
- [x] Update `DynamicQueryCompiler.java` with companion lateral rollups and parameterized child filtering/sorting
- [x] Update `CompositeRecordService.java` & `CompositeEntityController.java` with `childQueries`
- [x] Update TypeScript contracts in `packages/client/src/contracts/metadata.ts`
- [x] Create `CompositeRollupBuilder.tsx` and integrate into `CompositeProjectionCanvas.tsx`
- [x] Update `CompositePreviewHub.tsx` with companion lateral SQL and mock rollup preview
- [x] Update `CompositeMasterDetailRow.tsx` with KPI Bento chips, child search, and sort controls
- [x] Update `mock-metadata.ts` and `metadata-sandbox-adapter.ts` with offline sandbox simulation
- [x] Write backend unit tests and frontend Vitest suites
- [x] Document in `apps/console/doc/walkthrough_114.md` and `apps/console/ROUTE.md`

## Enhancement
Future iterations can support windowed statistical functions (`PERCENTILE_CONT`, `STDDEV`) or cross-collection rollup formulas (e.g. `average_order_value = total_spend / order_count`) directly compiled into the lateral projection.
