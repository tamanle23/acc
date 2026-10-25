# Walkthrough 15 - Phase 0, 1, 2 & 3: Metadata Schema Compiler, Resilient Caching & Complete Lifecycle

Scope: `@acc/backend` (`acc-fw`, `acc-core`, `acc-db`)

## 1. Overview & Objectives

In Phase 0, 1, 2, and 3, we investigated and resolved core security, data contract, lifecycle management, schema compilation, and performance caching in the backend metadata module:

1. **Phase 0 Verification & PostgreSQL JSONB Bug Fix (C7)**:
   - Executed a real PostgreSQL smoke test via Testcontainers against `postgres:16-alpine`.
   - **Confirmed C7**: PostgreSQL rejected `@Column(columnDefinition="jsonb")` + `AttributeConverter<Map, String>` with `PSQLException: ERROR: column "options" is of type jsonb but expression is of type character varying`.
   - **Resolution**: Updated `AttributeDefinition` and `EntityRecord` to use `@JdbcTypeCode(SqlTypes.JSON)` for direct JSONB binding, and added the default no-arg constructor required by JPA converter specification.
2. **Mass Assignment & Entity Leaks (C1, H2)**: Introduced strict Java records / DTOs for request payloads and response envelopes. Banned binding JPA entities directly in `@RequestBody`.
3. **Authorization (C2, D4)**: Secured all metadata management endpoints with `@PreAuthorize` using fine-grained authorities (`METADATA_SCHEMA_WRITE`, `METADATA_SCHEMA_READ`, `METADATA_RECORD_WRITE`, `METADATA_RECORD_READ`) and `ROLE_ADMIN`.
4. **Soft-Delete Filtering (C6)**: Replaced unconstrained repository calls with soft-delete-aware queries (`findByIdAndDeletedDateIsNull`, `findByEntityTypeIdAndDeletedDateIsNull`, `findAllByDeletedDateIsNull`).
5. **Error Handling & Envelope Standardization (H3, D2)**: Standardized response contracts on `ResponseEntity<ResponseWrapper<ContextHeader, T>>` via `ResponseEntityBuilder`. Introduced domain business exceptions (`MetadataNotFoundException`, `MetadataConflictException`, `SchemaValidationException`) with proper 4xx status mapping. Added Jakarta Bean validation error mapping in `GlobalExceptionHandler`.
6. **Pagination Fix (H1)**: Fixed `PageBuilder` pagination calculations so `totalElements` is computed consistently across all pages, and `totalPages` calculation `(total + size - 1) / size` correctly handles exact multiples.
7. **Phase 2 Complete Lifecycle & Schema Versioning**:
   - Added `schemaVersion` to `EntityType` and `EntityRecord` to track schema evolution.
   - Added `displayOrder` to `AttributeDefinition` for UI rendering sequence.
   - Created Liquibase migration `changelog-000.000.00002.xml` adding new columns and replacing plain unique constraints with partial unique indexes (`WHERE "deletedDate" IS NULL`) on PostgreSQL.
   - Implemented full CRUD endpoints for `EntityType`, `AttributeDefinition`, and `EntityRecord`.
   - Implemented archive/unarchive endpoints (`POST .../attributes/{attrId}/archive` and `unarchive`).
   - Implemented attribute reordering (`PUT .../attributes/order`).
   - Implemented delete guards: reject attribute deletion if active records contain values (unless `force=true`); cascading soft-delete on entity type deletion.
   - Enforced immutability rules (`dataType` and `systemName` cannot change; `uiComponent` can only change to compatible types).
   - Optimistic locking checks on all update/patch operations returning HTTP 409 `MetadataConflictException` on version mismatch.
8. **Phase 3 Schema Compiler & Resilient Multi-Level Caching**:
   - **Pure `SchemaCompiler` (C3)**: Built pure function compiling Draft-07 JSON Schema documents mapping all 9 UI components (`text`, `textarea`, `number`, `switch`, `select`, `multiselect`, `datepicker`, `json_editor`, `relation_picker`), enforcing `additionalProperties: false`, handling field options (`pattern`, `minLength`, `maxLength`, `minimum`, `maximum`, `choices`, `format`), and applying `default` values.
   - **Compiled Schema Endpoint**: Exposed `GET /api/v1/metadata/entity-types/{id}/schema` returning `CompiledSchemaResponse` (with `entityTypeId`, `schemaVersion`, and `schema` JsonNode).
   - **Versioned Two-Level Cache (C4, C5)**:
     - L1 in-memory `ConcurrentHashMap` caching parsed `JsonSchema` instances for zero-reparsing runtime performance.
     - L2 Redis cache using versioned keys `schema:{entityTypeId}:v{version}` with 1-hour TTL and defensive try/catch fallbacks so Redis outages never fail writes or validations.
   - **Reliable Eviction**: `MetadataCacheListener` evicts L1 memory and L2 Redis versioned keys on `AttributeDefinitionUpdatedEvent`.

---

## 2. Changes Implemented

### Liquibase & Database Migrations (`acc-db`)
- [`changelog-000.000.00002.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00002.xml):
  - Added `schema_version` to `entity_type` and `entity_record`.
  - Added `display_order` to `attribute_definition`.
  - Dropped unique constraints `uk_entity_type_sys_name` and `uk_attr_def_type_sys_name`.
  - Created PostgreSQL partial unique indexes `idx_entity_type_sysname_active` and `idx_attr_def_sysname_active` where `"deletedDate" IS NULL`.
- [`changelog-master.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/acc/changelog-master.xml): Included changeset `changelog-000.000.00002.xml`.

### Domain & DTO Layer (`acc-fw`)
- [`EntityType.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/EntityType.java): Added `schemaVersion`.
- [`AttributeDefinition.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/AttributeDefinition.java): Added `displayOrder`. Migrated `options` to `@JdbcTypeCode(SqlTypes.JSON)`.
- [`EntityRecord.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/EntityRecord.java): Added `schemaVersion`. Migrated `attributes` to `@JdbcTypeCode(SqlTypes.JSON)`.
- [`MapJsonConverter.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/MapJsonConverter.java): Added default constructor.
- [`DataType.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/DataType.java) & [`UiComponent.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/UiComponent.java): Type safety enums.
- DTOs:
  - [`CompiledSchemaResponse.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/CompiledSchemaResponse.java): Schema response record.
  - [`UpdateEntityTypeRequest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/UpdateEntityTypeRequest.java): Includes `version` for optimistic locking.
  - [`EntityTypeResponse.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/EntityTypeResponse.java): Includes `schemaVersion` and `version`.
  - [`UpdateAttributeRequest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/UpdateAttributeRequest.java): Includes `displayOrder`, `isArchived`, `options`, `defaultValue`, `version`.
  - [`AttributeDefinitionResponse.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/AttributeDefinitionResponse.java): Includes `displayOrder` and `version`.
  - [`ReorderAttributesRequest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/ReorderAttributesRequest.java): List of ordered attribute IDs.
  - [`UpdateRecordRequest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/UpdateRecordRequest.java) & [`PatchRecordRequest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/PatchRecordRequest.java): Include `version` for optimistic locking.
  - [`EntityRecordResponse.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/EntityRecordResponse.java): Includes `schemaVersion` and `version`.
  - [`MetadataDtoMapper.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/MetadataDtoMapper.java): Updated bidirectional mapping for schemaVersion and displayOrder.

### Schema Compilation, Caching & Services (`acc-fw`)
- [`SchemaCompiler.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/SchemaCompiler.java): Pure component compiling Draft-07 schemas from `List<AttributeDefinition>`.
- [`SchemaValidationService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/SchemaValidationService.java): L1 in-memory cache + L2 Redis versioned key caching (`schema:{id}:v{version}`) + structured validation error conversion.
- [`MetadataCacheListener.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataCacheListener.java): Evicts L1 cache and Redis keys on schema change events.
- [`MetadataService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java): Added `getCompiledSchema(id)` method.
- [`MetadataController.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/MetadataController.java): Exposed `GET /api/v1/metadata/entity-types/{id}/schema`.

### Query, Filtering & Server-Side Defaults (`acc-fw` & `acc-db`)
- [`changelog-000.000.00003.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00003.xml):
  - Added partial index `idx_entities_type_tenant_active` ON `UNIPOST_ENTITIES (entity_type_id, tenant_id) WHERE "deletedDate" IS NULL`.
  - Added GIN index `idx_entities_attributes_gin` ON `UNIPOST_ENTITIES USING GIN (attributes jsonb_path_ops)`.
- [`EntityRecordSpecifications.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/EntityRecordSpecifications.java):
  - Dynamic JPA Criteria Specification using `cb.function("jsonb_extract_path_text", ...)` for whitelisted active attributes.
  - Supports operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `in` (with numeric cast for number/integer types).
  - Handles soft-delete condition and multi-tenancy filtering (`tenantId`).
- [`MetadataService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java):
  - `applyAttributeDefaults`: Automatically populates missing attribute values with active attribute defaults on record creation and updates.
  - `getEntityRecords(...)`: Overload accepting `filterParams`, `sortProperty`, `sortDirection`, and `tenantId` running via Spring Data `JpaSpecificationExecutor`.
- [`MetadataController.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/MetadataController.java):
  - `GET /api/v1/metadata/entity-types/{id}/records`: Parses `filter[<attr>][<op>]=<val>`, `filter[<attr>]=<val>`, `sort=<prop>,<dir>`, and `tenantId`.

### Relationships & Cardinality (`acc-fw` & `acc-db`)
- [`changelog-000.000.00004.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00004.xml):
  - Added `source_entity_type_id`, `target_entity_type_id`, `cardinality` to `UNIPOST_RELATIONSHIP_TYPES`.
  - Added soft-delete partial unique index `uk_rel_type_sysname_active` on `UNIPOST_RELATIONSHIP_TYPES (system_name) WHERE "deletedDate" IS NULL`.
  - Added soft-delete partial unique index `uk_entity_rel_triplet_active` on `UNIPOST_ENTITY_RELATIONSHIPS (source_entity_id, target_entity_id, relationship_type_id) WHERE "deletedDate" IS NULL`.
  - Added active indexes `idx_entity_rel_source_active` and `idx_entity_rel_target_active`.
- [`RelationshipType.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/RelationshipType.java):
  - Mapped `sourceEntityType`, `targetEntityType`, and `cardinality` (`ONE_TO_ONE`, `ONE_TO_MANY`, `MANY_TO_ONE`, `MANY_TO_MANY`).
- [`EntityRelationship.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/EntityRelationship.java):
  - Edge table mapping with `@JdbcTypeCode(SqlTypes.JSON)` for `edgeMetadata`.
- Repositories:
  - [`RelationshipTypeRepository.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/RelationshipTypeRepository.java): soft-delete lookup and uniqueness queries.
  - [`EntityRelationshipRepository.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/EntityRelationshipRepository.java): triplet existence, source/target counts for cardinality enforcement, and direction-aware paging.
- [`MetadataService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java):
  - RelationshipType CRUD with delete guard (`force=true` check against existing relationships) and optimistic locking.
  - EntityRelationship CRUD with cross-tenant check, source/target entity type constraint validation, triplet uniqueness, and cardinality constraints (`ONE_TO_ONE`, `ONE_TO_MANY`, `MANY_TO_ONE`, `MANY_TO_MANY`).
  - `relation_picker` attribute validation ensuring referenced records exist in the target entity type table.
- [`MetadataController.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/MetadataController.java):
  - `/api/v1/metadata/relationship-types`: Full CRUD with `@PreAuthorize` security checks.
  - `/api/v1/metadata/records/{id}/relationships`: Query with `direction` filter (`incoming`, `outgoing`, both), create relationship, and delete relationship.

### Observability, Architecture Invariants & Rules (`acc-fw` & `.agents/rules`)
- **Structured Schema Evolution Logging**:
  - In [`MetadataService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java), added `@Slf4j` and structured logging on schema changes:
    `Schema evolved for entityType '{}' (id: {}): version {} -> {}`.
- **Institutional Knowledge & Master Rules**:
  - Updated [`docs/master_rules_reference.md`](file:///c:/Users/Admin/workspace/git/acc/docs/master_rules_reference.md) with **Section 9: Dynamic Metadata Engine Architecture & Failure Modes**, detailing:
    1. Two-tier schema caching with versioned keys and resilient Redis fallback.
    2. Atomic schema version evolution and Modulith cache eviction.
    3. Soft-delete partial unique indexes on PostgreSQL.
    4. Validation integrity with `additionalProperties: false`, server defaults, and `relation_picker` referential integrity.
    5. Relationship cardinality and strict multi-tenancy boundaries.
  - Distilled and appended active constraints to [`.agents/rules/01-workspace-specific.md`](file:///c:/Users/Admin/workspace/git/acc/.agents/rules/01-workspace-specific.md) following the monorepo rule management SOP.

---

## 3. Verification & Tests

- **PostgreSQL JSONB Integration Smoke Test**:
  - [`MetadataPostgresJpaSmokeIT.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/test/java/com/acc/domain/metadata/MetadataPostgresJpaSmokeIT.java): Verified against real PostgreSQL database.
- **Unit & Slice Tests**:
  - `SchemaCompilerTest`: Verified all 9 UI components, constraints, format, enum choices, defaults, and archived exclusion.
  - `SchemaValidationServiceTest`: Verified L1 memory cache, L2 Redis versioned caching, validation failure extraction, boolean switch, and `additionalProperties: false`.
  - `MetadataCacheListenerTest`: Verified L1 and L2 cache eviction.
  - `MetadataServiceTest`: 28 unit tests verifying EntityType CRUD, `getCompiledSchema`, AttributeDefinition lifecycle, EntityRecord CRUD, delete guards, versioning, default value injection, specification filtering, RelationshipType CRUD, EntityRelationship validation, cardinality constraints, and `relation_picker` checks.
  - `MetadataControllerTest`: 22 controller slice tests verifying routing, envelope wrapping, filter/sort query parameters, and relationship endpoints.
- **Maven Reactor Execution**:
  - `node mvnw.cjs test -pl :acc-fw`: 70 tests passed (0 failures, 0 errors).
  - `node mvnw.cjs test`: 100% passed across all 10 monorepo reactor modules (including Spring Modulith `ModularityTests`).




