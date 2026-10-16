# Walkthrough 110: Phase 41 - Composite Entity Type Registry & Specification DSL

## Overview
Phase 41 delivers the **Composite Entity Type Registry & Specification DSL** across the full-stack architecture of Unipost. It empowers architects and operators to declare single-table composite views aggregating base entity records across foreign keys (Pattern B) and association matrices (Pattern C) up to depth 4, compile draft-07 JSON schemas, generate lateral SQL projections, enforce strict dependency and read-only invariants, provision partial functional B-tree indexes, and visualize everything in a Liquid Glass Bento Studio.

---

## Changes Implemented

### 1. Database Migration (Liquibase)
- Added `apps/backend/unipost-db/src/main/resources/db/unipost/changelog-000.000.00011.xml`:
  - Extended `UNIPOST_ENTITY_TYPES` with:
    - `is_composite BOOLEAN DEFAULT FALSE NOT NULL`
    - `composite_spec JSONB`
- Registered changelog in `apps/backend/unipost-db/src/main/resources/db/unipost/changelog-master.xml`.

### 2. Domain & Specification AST (Java 21)
- Created AST records in `com.unipost.domain.metadata`:
  - `CompositeJoinPattern.java`: `PATTERN_B_FOREIGN_KEY`, `PATTERN_C_ASSOCIATION`.
  - `CompositeField.java`: Source attribute mapping with target projection alias.
  - `CompositeNode.java`: Child join node containing target entity, pattern, cardinality, foreign key attribute, fields, and recursive children.
  - `CompositeSpec.java`: Root specification containing root entity, aliases, fields, and recursive child join nodes.
- Updated `EntityType.java` with `isComposite` and `compositeSpec` fields, getters, setters, and builder.

### 3. Compiler & Schema Validation Engine
- Created `CompositeSpecCompiler.java`:
  - Validates recursion ceiling (`MAX_DEPTH = 4`) and detects cycles along recursive paths using an immutable `Set<Long> visitedEntities`.
  - Derives draft-07 JSON Schema with nested object (`ONE_TO_ONE`) and array (`ONE_TO_MANY`) properties and required field rules.
  - Generates pushdown SQL preview utilizing `LEFT JOIN LATERAL` and `jsonb_build_object` / `jsonb_agg`.
- Created `DynamicIndexProvisioner.java`:
  - Generates `CREATE INDEX CONCURRENTLY IF NOT EXISTS` DDL for Pattern B foreign key references inside JSONB:
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_composite_fk_{table}_{attr} ON {table} (((data->>'{attr}')::text))`
  - Spawns asynchronous non-transactional execution to comply with PostgreSQL's restriction on concurrent indexing inside active transaction blocks.
- Updated `SchemaValidationService.java`:
  - Delegates schema compilation for composite entities to `CompositeSpecCompiler`.
  - Caches compiled JSON schemas in Distributed **Hazelcast** (`METADATA_SCHEMAS_MAP`) under key format `schema:{tenantId}:{entityTypeId}:v{version}`.

### 4. Metadata Service Invariants & DTOs
- Updated `MetadataService.java`:
  - **Strict Dependency Guard**: Prevents deleting or archiving base attributes or entity types referenced within any composite specification (`MetadataConflictException` / `409 Conflict`).
  - **Read-Only Invariant**: Rejects record mutation operations on composite entities (`createEntityRecord`, `updateEntityRecord`, `patchEntityRecord`, `transitionRecordState`, `deleteEntityRecord`) with `UnsupportedOperationException` (`405 Method Not Allowed`).
  - Handled `isComposite` and `compositeSpec` across entity creation and updates, invoking `DynamicIndexProvisioner` on specification changes.
  - Added backward-compatible constructors to preserve zero regression across all test suites.
- Updated DTOs & Contracts:
  - `CreateEntityTypeRequest.java`, `UpdateEntityTypeRequest.java`, `EntityTypeResponse.java`, `MetadataDtoMapper.java`.
  - TypeScript types in `packages/client/src/contracts/metadata.ts` and `apps/console/src/features/metadata/api/types.ts`.

### 5. Frontend Visual Studio & Bento Builder
- Created `apps/console/src/features/metadata/components/studio/composite/`:
  - `composite-catalog-rail.tsx`: Left catalog rail listing available base entities with Pattern B (🔗 FK) and Pattern C (ᛦ Assoc) filters and search.
  - `composite-projection-canvas.tsx`: Central recursive tree projection canvas showing hierarchy levels 1–4, alias overrides, cardinality toggles (1:1 vs 1:N), and attribute projection checkboxes.
  - `composite-preview-hub.tsx`: Right live preview hub with 3 tabs: Live JSON Envelope, Pushdown SQL Query, and JSON Schema Draft-07.
  - `composite-bento-studio.tsx`: Top action bar with depth indicator badge, cycle detector warning, and save mutation orchestrator.
- Integrated into `VisualSchemaStudio.tsx`:
  - Added `Boxes` tab trigger ("Composite Bento") when entity is composite or requested.
- Unified Sandbox Parity:
  - Added `Customer 360 View` composite entity seed in `mock-metadata.ts` with Pattern B orders and Pattern C support tickets.
  - Added 405 Read-Only guards on record mutations for composite entities.

---

## Verification Results

### 1. Backend Verification Test Suite
Command:
```bash
mvn test -f apps/backend/pom.xml -pl unipost-fw "-Dtest=CompositeEntityTypeVerificationTest" -q
```
Results:
- `testCompositeValidation_Success`: Passed.
- `testCompositeValidation_ExceedMaxDepth_ThrowsException`: Passed (depth > 4 rejected).
- `testCompositeValidation_CycleDetection_ThrowsException`: Passed (recursive cycles detected).
- `testStrictDependencyGuard_ThrowsConflict`: Passed (409 Conflict on base attribute deletion).
- `testCompositeEntity_ReadOnlyInvariant_RejectsMutation`: Passed (405 / UnsupportedOperationException on write mutations).
- `testDynamicIndexProvisioner_GeneratesConcurrentIndexSql`: Passed (DDL verification).
- **All 6 tests passed with 0 failures.**

### 2. Frontend Vitest Test Suites
Command:
```bash
pnpm --filter @unipost/console test src/features/metadata/components/studio/composite/composite-bento-studio.test.tsx
pnpm --filter @unipost/console test src/features/metadata/components/studio/visual-schema-studio.test.tsx
```
Results:
- `composite-bento-studio.test.tsx`: 3 passed.
- `visual-schema-studio.test.tsx`: 8 passed.

### 3. Linting and TypeScript Type Check
Commands:
```bash
pnpm --filter @unipost/console exec eslint src/features/metadata/components/studio/composite
pnpm --filter @unipost/console exec tsc --noEmit
```
Results:
- `eslint`: 0 problems (0 errors, 0 warnings).
- `tsc`: 0 errors.
