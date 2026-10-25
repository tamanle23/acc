# Implementation Plan 110: Phase 41 - Composite Entity Type Registry & Specification DSL

## 1. Executive Summary & Architectural Overview
Phase 41 introduces the **Composite Entity Type Registry & Specification DSL** into the Unipost metadata engine. Composite entities synthesize real-time, unified read projections across heterogeneous base entities without physical data duplication or ETL pipelines. 

In accordance with architectural grilling decisions and the authoritative Monorepo Directives:
1. **Single Table Inheritance / Extension**: No separate `UNIPOST_COMPOSITE_VIEWS` table. `UNIPOST_ENTITY_TYPES` is extended with `is_composite = TRUE` and a declarative JSON Tree `composite_spec` column.
2. **Master-Detail Bento Builder in Console**: A 3-pane Liquid Glass studio tab inside `VisualSchemaStudio`:
   - **Left Rail**: Catalog of accessible base Entity Types partitioned into **Pattern B** (Direct 1:1 / N:1 Foreign Key Joins 🔗) and **Pattern C** (Association Engine N:M / 1:N Hierarchies ᛦ).
   - **Center Canvas**: Interactive Tree Projection Builder with attribute inclusion, alias renames (`order_id AS tracking_code`), default fallback expressions, and depth-level indicators.
   - **Right Preview Hub**: Live dual-pane JSON Projection & SQL Pushdown preview with syntax highlighting.
3. **Backend AST Compiler & Guardrails**:
   - Recursive tree validation with a hard max depth ceiling of 4 levels.
   - Path-based cycle detection (e.g., $Customer \rightarrow Order \rightarrow Customer$).
   - Strict Dependency Guard (`409 Conflict`) preventing deletion or destructive modification of base attributes referenced in composite specifications.
   - Generation of draft-07 JSON Schema with `additionalProperties: false`.
4. **Read-Only Invariant**:
   - Write mutations (`POST`, `PUT`, `DELETE` against composite entities) are strictly rejected with `405 Method Not Allowed`.
5. **Distributed Hazelcast Caching**:
   - Versioned cache keys `schema:{tenantId}:{entityTypeId}:v{version}` stored in Hazelcast distributed maps with L1 in-memory fast-path fallback.
6. **Dynamic Partial B-Tree Functional Index Provisioning**:
   - Automated index generation for Pattern B join keys and filter attributes via non-transactional `CREATE INDEX CONCURRENTLY IF NOT EXISTS` background worker.

---

## 2. Proposed Changes

### A. Database Layer (`apps/backend/acc-db`)
- Create Liquibase migration `changelog-000.000.00011.xml`:
  - Add `is_composite BOOLEAN NOT NULL DEFAULT FALSE` to `UNIPOST_ENTITY_TYPES`.
  - Add `composite_spec JSONB NULL` to `UNIPOST_ENTITY_TYPES`.
  - Register `changelog-000.000.00011.xml` in `changelog-master.xml`.

### B. Domain & Service Layer (`apps/backend/acc-fw`)
- **Domain Models**:
  - Update `EntityType.java` with `isComposite` and `compositeSpec`.
  - Create `CompositeSpec.java`, `CompositeNode.java`, `CompositeField.java`, `CompositeJoinPattern.java`.
- **AST Compiler & Validation**:
  - Create `CompositeSpecCompiler.java`:
    - Compiles `CompositeSpec` into standard JSON Schema draft-07.
    - Validates max depth (ceiling 4) and cycles via visited path set.
    - Resolves and verifies base entity types and attribute definitions exist.
- **Strict Dependency Guard**:
  - In `MetadataService.java`, guard `deleteAttributeDefinition`, `archiveAttributeDefinition`, and `deleteEntityType`: check if attribute is actively referenced by any composite entity's `composite_spec`; throw `MetadataConflictException` (`409 Conflict`) if referenced.
- **Read-Only Invariant**:
  - In `MetadataService.java` (`createEntityRecord`, `updateEntityRecord`, `deleteEntityRecord`), check `entityType.getIsComposite()`; if true, throw `UnsupportedOperationException` / HTTP 405.
- **Dynamic Index Provisioning**:
  - Create `DynamicIndexProvisioner.java` that inspects `CompositeSpec` for Pattern B join paths and schedules asynchronous index creation:
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_composite_... ON UNIPOST_ENTITIES ((attributes->>'...')) WHERE (entity_type_id = ...);`
- **Hazelcast Distributed Cache Invariant**:
  - Integrate composite JSON Schema compilation into `SchemaValidationService` using `schema:{tenantId}:{entityTypeId}:v{version}` key pattern.

### C. Backend API & Testing (`apps/backend/acc-ms-aio`)
- Expose composite entity creation and retrieval in metadata endpoints.
- Provide comprehensive JUnit 5 test suite `CompositeEntityTypeVerificationTest.java`:
  - Verifies AST compilation to JSON Schema.
  - Verifies cycle detection (depth > 4 and recursive cycles rejected).
  - Verifies read-only mutation rejection (HTTP 405 / UnsupportedOperation).
  - Verifies dependency guard (deleting base attribute referenced in composite throws 409 Conflict).
  - Verifies DynamicIndexProvisioner SQL query formatting.

### D. Frontend Visual Schema Studio (`apps/console`)
- **Types & API**:
  - Update `apps/console/src/features/metadata/api/types.ts` with `CompositeSpec`, `CompositeNode`, `CompositeField`, and `isComposite`.
  - Update `apps/console/src/features/metadata/api/metadata-api.ts` with composite entity support.
- **Master-Detail Bento Builder UI Components**:
  - Create `apps/console/src/features/metadata/components/studio/composite/`:
    - `composite-bento-studio.tsx`: The primary orchestrator.
    - `composite-catalog-rail.tsx`: Left rail displaying base entity types grouped into Pattern B (🔗 Foreign Key Joins) and Pattern C (ᛦ Association Engine).
    - `composite-projection-canvas.tsx`: Interactive tree node builder with drag/drop/checkbox inclusion, alias renames, depth level indicators, and fallback expressions.
    - `composite-preview-hub.tsx`: Dual-pane preview with syntax-highlighted Live JSON Projection and Generated Pushdown SQL.
- **Studio Tab Integration**:
  - Integrate "Composite Bento Studio" into `VisualSchemaStudio.tsx` alongside Canvas, FSM Workflow, and Visual DAG modes.
- **Unified Sandbox Platform Integration**:
  - Update `apps/console/src/core/sandbox/handlers/metadata-sandbox-handler.ts` (and seed data):
    - Seed `Customer360Composite` entity type with complete `composite_spec`.
    - Handle composite schema compilation and pushdown SQL simulation.
    - Enforce 405 rejection on write attempts to composite entities.
    - Wire `reset()` into `sandboxResetRegistry`.
- **Vitest Automated Tests**:
  - Add `composite-bento-studio.test.tsx` verifying Left Catalog rendering, tree node projection updates, and preview switching.

---

## 3. Verification Plan
1. **Automated Backend Tests**:
   - Execute Maven quiet tests: `mvn test -pl apps/backend/acc-ms-aio -Dtest=CompositeEntityTypeVerificationTest -q`.
2. **Automated Frontend Tests**:
   - Run Vitest: `pnpm --filter @acc/console test run src/features/metadata/components/studio/composite/composite-bento-studio.test.tsx`.
3. **Type & Lint Checking**:
   - Run `pnpm --filter @acc/console check-types`.
   - Run `pnpm --filter @acc/console lint`.
4. **Unified Sandbox Validation**:
   - Verify offline rendering of composite entity in sandbox mode with zero live backend dependency.
