# [122] Phase 41: Composite Entity Type Registry & Specification DSL

## Problem
In multi-tenant domain modeling, querying relational customer/entity hierarchies (e.g. Customer 360, Order with Line Items & Fulfillment) requires ad-hoc backend joins or multiple client network round-trips. There was no declarative way in Unipost's dynamic metadata engine to define single-table composite views aggregating base entity records across foreign keys (Pattern B) and association matrices (Pattern C), compile validation schemas, generate pushdown SQL projections, protect base attributes from breaking deletions, or design these composite models visually in Console.

## Plan
1. **Liquibase Migration**: Extend `UNIPOST_ENTITY_TYPES` with `is_composite` flag and `composite_spec` JSONB column.
2. **Domain AST & Compiler**:
   - Model `CompositeSpec`, `CompositeNode`, `CompositeField`, and `CompositeJoinPattern` as immutable Java records.
   - Implement `CompositeSpecCompiler` with hard max depth 4, cycle detection along traversal paths, draft-07 JSON Schema compilation, and lateral SQL preview generation.
3. **Database Concurrency & Indexing**:
   - Implement `DynamicIndexProvisioner` generating `CREATE INDEX CONCURRENTLY IF NOT EXISTS` for Pattern B foreign keys executed outside active transactions.
4. **Metadata Service Invariants**:
   - Enforce Strict Dependency Guard: Throw 409 Conflict if attempting to delete/archive an attribute or entity type referenced in any composite spec.
   - Enforce Read-Only Invariant: Throw 405 Method Not Allowed / UnsupportedOperationException on any write mutation (`create`, `update`, `patch`, `transition`, `delete`) to composite entity records.
   - Integrate with Hazelcast distributed cache under key format `schema:{tenantId}:{entityTypeId}:v{version}`.
5. **Frontend Bento Builder**:
   - Build `CompositeBentoStudio` in Console with 3-pane Bento layout: Catalog Rail (left), Projection Canvas (center), and Preview Hub (right).
   - Integrate into `VisualSchemaStudio`.
6. **Unified Sandbox Parity**:
   - Seed `Customer 360 View` composite entity and mock 405 mutation guards.
7. **Verification**:
   - Unit tests covering compiler invariants, dependency guards, read-only behavior, and dynamic index DDL generation.

## Changes
- `apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00011.xml`: Liquibase migration.
- `apps/backend/acc-db/src/main/resources/db/acc/changelog-master.xml`: Registered changelog.
- `apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/`: Created `CompositeJoinPattern`, `CompositeField`, `CompositeNode`, `CompositeSpec`, and updated `EntityType`.
- `apps/backend/acc-fw/src/main/java/com/acc/service/CompositeSpecCompiler.java`: Validation, JSON Schema compilation, SQL preview generation.
- `apps/backend/acc-fw/src/main/java/com/acc/service/DynamicIndexProvisioner.java`: Asynchronous non-transactional DDL executor.
- `apps/backend/acc-fw/src/main/java/com/acc/service/SchemaValidationService.java`: Hazelcast caching and composite delegation.
- `apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java`: Strict Dependency Guard & Read-Only Invariant enforcement.
- `apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/`: DTO mapping for composite fields.
- `apps/backend/acc-fw/src/test/java/com/acc/service/CompositeEntityTypeVerificationTest.java`: Comprehensive JUnit 5 tests.
- `packages/client/src/contracts/metadata.ts`: TypeScript contracts for composite specifications.
- `apps/console/src/features/metadata/components/studio/composite/`: Created `CompositeCatalogRail`, `CompositeProjectionCanvas`, `CompositePreviewHub`, `CompositeBentoStudio`, and Vitest tests.
- `apps/console/src/features/metadata/components/studio/visual-schema-studio.tsx`: Added Composite Studio tab.
- `apps/console/src/features/metadata/data/mock-metadata.ts`: Added Customer 360 View seed and 405 mutation guards.

## Verification
- **Backend Unit Tests**: `mvn test -f apps/backend/pom.xml -pl acc-fw "-Dtest=CompositeEntityTypeVerificationTest" -q` passed 6/6 tests with 0 failures.
- **Frontend Vitest**:
  - `composite-bento-studio.test.tsx`: 3 tests passed.
  - `visual-schema-studio.test.tsx`: 8 tests passed.
- **Frontend Linting & Typecheck**:
  - `pnpm --filter @acc/console exec eslint src/features/metadata/components/studio/composite`: 0 errors.
  - `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.

## Walkthrough
See `apps/console/doc/walkthrough_110.md` for a complete architectural walkthrough and screenshot blueprint.

## Tasks
- [x] Create Liquibase migration `changelog-000.000.00011.xml`
- [x] Define AST records (`CompositeSpec`, `CompositeNode`, `CompositeField`, `CompositeJoinPattern`)
- [x] Implement `CompositeSpecCompiler` with cycle detection and depth 4 limit
- [x] Implement `DynamicIndexProvisioner` for concurrent indexing
- [x] Wire Hazelcast caching in `SchemaValidationService`
- [x] Enforce Strict Dependency Guard & Read-Only Invariant in `MetadataService`
- [x] Build Master-Detail Bento Builder in Console UI
- [x] Update Unified Sandbox Platform
- [x] Verify backend and frontend test suites

## Enhancement
Future iterations can introduce dynamic materialization views (materialized view refreshing via transactional outbox triggers) and GraphQL query compilation directly from the `CompositeSpec` AST.
