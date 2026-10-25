# Implementation Plan 15 - Backend Metadata / SchemaBuilder Module Hardening & Completion

Scope: `@acc/backend` (`apps/backend/acc-fw`, `acc-db`, `acc-ms-worker`). Companion console work is in `apps/console/doc/implementation_plan_52.md`.

## 1. Investigation Summary

### 1.1 What exists today

| Layer | Artifact | Notes |
| :--- | :--- | :--- |
| API | [`MetadataController`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/MetadataController.java) | 6 endpoints under `/api/v1/metadata`: list/create EntityType, list/create Attribute, list/create Record. **No GET-by-id, PUT, or DELETE anywhere.** |
| Service | [`MetadataService`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java) | Thin pass-through to repositories; publishes `AttributeDefinitionUpdatedEvent` on attribute create only. |
| Validation | [`SchemaValidationService`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/SchemaValidationService.java) | Compiles attributes to JSON Schema Draft-07 (networknt), caches in Redis key `schema:{id}`. |
| Cache | [`MetadataCacheListener`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataCacheListener.java) | `@Async @TransactionalEventListener(AFTER_COMMIT)` deletes the Redis key. |
| Domain | `domain/metadata/*` | `EntityType`, `AttributeDefinition`, `EntityRecord` (JSONB `attributes`), `RelationshipType`, `EntityRelationship` (edge table), `MapJsonConverter`. |
| DB | [`changelog-000.000.00001.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00001.xml) | 5 tables, JSONB columns, unique `(entity_type_id, system_name)`. |
| Tests | `MetadataServiceTest`, `MetadataControllerTest`, `SchemaValidationServiceTest`, `MapJsonConverterTest`, `MetadataCacheListenerTest` | Mockito-only; controller tests call methods directly (no MockMvc, no security, no DB, no Redis). |

### 1.2 Findings (ordered by severity)

**Critical - correctness / security**

| # | Finding | Evidence |
| :-: | :--- | :--- |
| C1 | **Mass assignment / overwrite.** Controllers bind JPA entities straight from `@RequestBody`. A client that sends `id`, `uid`, `version`, `deletedDate`, `mode`, `state` or `entityType` gets them persisted. Sending an existing `id` makes `save()` update another row. | `MetadataController` L33, L43, L53 |
| C2 | **No authorization on schema management.** `@EnableMethodSecurity` is on but nothing uses `@PreAuthorize`; any authenticated user can create entity types/attributes. Under profile `nonsecured`, everything is open. | `SecurityConfiguration` L31, L63-88 |
| C3 | **Backend validator does not enforce what the schema says.** `compileSchema` maps only `text/textarea/number`; everything else (`switch`, `multiselect`, `datepicker`, `json_editor`, `relation_picker`, `select`) falls back to `type: string`. Result: boolean and array values are **rejected**, `select` choices, `min/max`, `pattern`, `dataType` are **ignored**, **archived attributes are still compiled** (and can stay `required`), unknown keys are accepted. | `SchemaValidationService` L69-94 |
| C4 | **Stale-schema race, no TTL.** Cache-miss path compiles then `set`s without TTL. If an attribute is committed + invalidated between compile and `set`, the stale schema is cached forever. Invalidation is `@Async` after commit with no retry, so a Redis blip or crash also leaves a stale schema permanently. | `SchemaValidationService` L33-39, `MetadataCacheListener` |
| C5 | **Redis is a hard dependency of every record write.** `validatePayload` calls Redis unconditionally; Redis down = all writes fail, no fallback to compile-in-process. The compiled schema is also re-parsed (`readTree` + `getSchema`) on every request. | `SchemaValidationService` L32-46 |
| C6 | **Soft delete is not honoured by derived queries.** `BaseRepository` filters `deletedDate IS NULL` only on the custom `findAll()`. `findAll(Pageable)` and `findByEntityTypeId(...)` do not, so soft-deleted rows appear in listings and **soft-deleted attributes are compiled into the schema**. | `MetadataService` L37, L47, L64; `AttributeDefinitionRepository` |
| C7 | **Probable JSONB write failure on PostgreSQL (verify first).** `@Column(columnDefinition="jsonb")` + `AttributeConverter<Map,String>` binds a `varchar` parameter to a `jsonb` column. PostgreSQL rejects that unless `stringtype=unspecified` or Hibernate's JSON type is used. The JDBC URL has no `stringtype`; there is no integration test that would catch it. | `AttributeDefinition` L43, `EntityRecord` L27, `application-local.yml` L125 |

**High - API / data contract**

| # | Finding |
| :-: | :--- |
| H1 | **Pagination metadata is wrong.** `PageBuilder` populates `totalElements` only when `number == 1` (otherwise `null`), and `totalPages = total/size + 1` is off by one when `total % size == 0` (10 rows, size 10 -> 2 pages). Any pager breaks from page 2. |
| H2 | **Entities leak as API.** JSON exposes `createdBy`, `mode`, `state`, `version`, and a nested `entityType` object (eager `@ManyToOne`) instead of a flat `entityTypeId`. `PageRequest` has no `sort`; clients cannot sort. |
| H3 | **Errors are 5xx.** `IllegalArgumentException` ("EntityType not found", "Payload validation failed") falls into `handleRuntimeException` -> `responseBuilder.error(...)`; not-found and validation failures are indistinguishable from server faults, with no per-field detail. Success bodies are a raw `Page` while errors use `ResponseWrapper`: inconsistent envelope. |
| H4 | **No uniqueness / format checks before insert.** `systemName` is free text (no `^[a-z][a-z0-9_]*$`), `dataType`/`uiComponent` are free strings (no enum). Duplicates surface as DB constraint exceptions (500). Soft-deleted rows still hold the unique `system_name`, so a deleted name can never be reused. |
| H5 | **Record updates are impossible**, so schema validation on update, partial update (PATCH) and optimistic locking are all moot today. |

**Medium - evolution, scale, architecture**

| # | Finding |
| :-: | :--- |
| M1 | **No schema versioning.** Changing `required`/type/choices does not revalidate existing records; no `schemaVersion` on `EntityType`/`EntityRecord`; no migration/backfill path. No attribute display order. |
| M2 | **No query capability on JSONB.** No filter/sort by attribute, no GIN index on `UNIPOST_ENTITIES.attributes`, no index on `UNIPOST_ENTITIES.entity_type_id` (PostgreSQL does not auto-index FKs). |
| M3 | **Relationships are dead code.** `RelationshipType`/`EntityRelationship` have entities + tables but no repositories, service, or endpoints; the console's `relation_picker` has nothing behind it. |
| M4 | **Tenancy is cosmetic.** `tenant_id` is client-supplied and never filtered or checked against the caller. |
| M5 | **Defaults not applied server-side.** `defaultValue` is stored (as `VARCHAR(255)`) but never applied; type of default is untyped. |
| M6 | **Modulith boundaries absent.** Metadata is spread across layered packages (`domain/service/presentation/repository`) with no `@ApplicationModule`; the event is in the domain package. `test:modulith` exists but metadata is not a module. `implementation_plan_14` set a Clean Architecture/CQRS direction that this module does not follow. |
| M7 | **DB portability.** Changelog uses `JSONB`/`TEXT`; datasource history shows MariaDB/HSQL/MySQL profiles. Metadata tables only work on PostgreSQL. |

### 1.3 Cross-app contract defects found during this investigation (console side)

The console work delivered under plan 52 has three problems that this backend plan resolves; they should be fixed together:

1. The console calls `GET /entity-types/{id}`, `PUT`/`DELETE` for all three resources - **none exist yet**. The console hides this behind a silent `catch -> mockMetadataStore` fallback, so the UI appears to work while writing nowhere.
2. The console's "Draft-07 preview" is its own re-implementation and **does not match** `SchemaValidationService` (finding C3). The backend must be the single source of truth.
3. The console reads `totalElements`/`totalPages` and a flat `entityTypeId`, which the backend does not reliably return (H1, H2).

## 2. Target Design

```
com.acc.metadata/                      (Spring Modulith module, @ApplicationModule)
├── package-info.java                       # allowed deps, named interface "api"
├── api/                                    # exposed to other modules
│   ├── MetadataSchemaApi.java              # compileSchema(typeId), validate(typeId, payload)
│   └── event/ SchemaChangedEvent.java      # (entityTypeId, schemaVersion) - externalized/registry-backed
├── web/                                    # MetadataController + request/response DTOs (records) + mappers
├── application/                            # EntityTypeService, AttributeService, RecordService, RelationshipService
├── schema/                                 # SchemaCompiler (pure), SchemaCache (L1 Caffeine + L2 Redis), RecordValidator
├── domain/                                 # existing entities (moved), enums DataType, UiComponent
└── repository/                             # Spring Data repos with soft-delete-aware methods
```

Principles: DTOs at the boundary (C1/H2); one pure `SchemaCompiler` shared by validator, preview endpoint, and tests (C3); cache is an optimisation never a dependency (C4/C5); every behaviour change has a Liquibase changeset, never an edit to `changelog-000.000.00001.xml`.

## 3. Phased Roadmap

### Phase 0 - Verify assumptions (0.5 day, blocking)
- Add a Testcontainers (PostgreSQL + Redis) smoke test that creates an `EntityType`, `AttributeDefinition` (with `options`), and `EntityRecord` through the real JPA stack. **Confirms or refutes C7.**
- Write a failing characterization test for C3 (boolean `switch` value rejected) and H1 (page 2 has `null` totals).
- Decision gate: if C7 is confirmed, Phase 1 includes the JSONB fix; otherwise it is dropped.

### Phase 1 - Safety & contract hotfixes (P0)
1. **DTO layer (C1, H2):** request records `CreateEntityTypeRequest`, `CreateAttributeRequest`, `CreateRecordRequest` (+ update variants) and response records with flat `entityTypeId`, `createdDate`, `lastUpdatedDate`, `version`. Never bind entities. Mapper via MapStruct (or manual).
2. **Input validation (H4):** Jakarta Bean Validation: `systemName` `^[a-z][a-z0-9_]{1,63}$`, `dataType`/`uiComponent` as enums `DataType`/`UiComponent` (matching console values), size limits, `options` shape check per component. Add `@Valid`.
3. **Soft-delete aware reads (C6):** add `findByIdAndDeletedDateIsNull`, `findByEntityTypeIdAndDeletedDateIsNull(...)` (paged + list) and use `Specification`s for `findAll`; stop calling `findAll(Pageable)`.
4. **Error mapping (H3):** introduce `MetadataNotFoundException` (404), `MetadataConflictException` (409), `SchemaValidationException` (400 with `[{field, code, message}]`) as `BusinessException` subclasses so `GlobalExceptionHandler` returns correct status + codes. Wrap success in the project's standard envelope or document why not (decision D2).
5. **Pagination (H1):** compute `totalElements` from the Spring `Page` always; `totalPages = ceil(total/size)`; add `sort` (whitelisted properties) to a `MetadataPageRequest`. Fix `PageBuilder` once, since other modules use it.
6. **Authorization (C2):** `@PreAuthorize("hasRole('ADMIN')")` on all schema-management endpoints (entity types, attributes, relationship types); record endpoints require a dedicated authority (`METADATA_RECORD_WRITE`) for writes. Tests for 401/403 via MockMvc.
7. **JSONB mapping (C7, if confirmed):** replace `MapJsonConverter` usage with `@JdbcTypeCode(SqlTypes.JSON)` on `Map<String,Object>` fields (Hibernate 6) or add `stringtype=unspecified`; keep converter only if the Phase 0 test passes.

Exit criteria: no entity crosses the controller; all errors are 4xx where the client is at fault; Phase 0 tests green.

### Phase 2 - Complete lifecycle (CRUD, archive, guards)
- Endpoints (all DTO-based, `@PreAuthorize`d):
  - `GET/PUT/DELETE /entity-types/{id}`
  - `GET/PUT/DELETE /entity-types/{id}/attributes/{attrId}`, `POST .../attributes/{attrId}/archive|unarchive`, `PUT .../attributes/order` (new `display_order` column)
  - `GET/PUT/PATCH/DELETE /entity-types/{id}/records/{recordId}`
- **Optimistic locking:** DTOs carry `version`; mismatch -> 409.
- **Immutability rules:** `systemName` of attribute and `dataType` are immutable once records exist (409 with guidance to archive + recreate); `uiComponent` changes only within compatible data types.
- **Delete guards:** deleting an attribute is rejected (409) if any non-deleted record contains its key (`attributes ? :key` jsonb operator), unless `?force=true` with an audit log; deleting an entity type cascades soft-delete to attributes and records in one transaction.
- **Unique + soft delete (H4):** Liquibase changeset replacing the plain unique constraints with **partial unique indexes** `WHERE deletedDate IS NULL` (`uk_attr_def_type_sysname`, entity type `system_name`), so deleted names can be reused. Pre-check duplicates in service for a clean 409.
- Publish `SchemaChangedEvent` from **every** mutation that affects the schema (create/update/archive/reorder/delete).

### Phase 3 - Schema compiler as single source of truth + resilient cache
1. **`SchemaCompiler` (pure function, C3):** full mapping

   | uiComponent | JSON Schema |
   | :--- | :--- |
   | text, textarea | `string` (+ `pattern`, `minLength/maxLength` from options) |
   | number | `integer` or `number` by `dataType`; `minimum`/`maximum` |
   | switch | `boolean` |
   | select | `string` + `enum` from `options.choices` |
   | multiselect | `array` of `string` + `enum`, `uniqueItems` |
   | datepicker | `string` + `format: date` / `date-time` |
   | json_editor | `object` |
   | relation_picker | `string`/`integer` + custom keyword validated in Phase 5 |

   Exclude archived attributes from `required` and from `properties` for new writes (still accept historical keys on update with a lenient mode flag); `additionalProperties: false`; apply `default`.
2. **Expose it:** `GET /entity-types/{id}/schema` returns the compiled Draft-07 document + `schemaVersion`. The console preview calls this instead of re-implementing it.
3. **Versioning:** add `schema_version BIGINT` to `UNIPOST_ENTITY_TYPES`, incremented in the same transaction as any attribute change. Cache key becomes `schema:{typeId}:v{version}` - stale entries are unreachable by construction (fixes C4's race without relying on invalidation timing).
4. **Two-level cache + fallback (C5):** Caffeine L1 holding the **parsed `JsonSchema`** (kills re-parsing), Redis L2 with TTL (e.g. 1h) holding JSON. Any Redis exception is caught, logged, metered, and falls through to in-process compile; Redis never fails a write.
5. **Reliable invalidation (C4):** move to Spring Modulith's event publication registry (`@ApplicationModuleListener`) so L1 eviction across nodes is retried/persisted; with versioned keys invalidation becomes a memory-hygiene concern only.

### Phase 4 - Records: validate on update, defaults, search, performance
- `RecordService.update/patch`: merge, apply defaults server-side (M5), validate against **current** schema, stamp `schema_version` (new column on `UNIPOST_ENTITIES`).
- Structured validation errors from `networknt` messages -> `[{field, code, message}]` (maps to H3 and drives console inline errors).
- **Filter/sort on attributes:** `GET .../records?filter[status]=active&filter[price][gte]=10&sort=attributes.price,desc` via a `Specification` using `jsonb_extract_path_text` / `@>`; whitelisted to defined, non-archived attributes only (no SQL injection surface); typed casts by `dataType`.
- **Indexes (M2)** in new changeset: `idx_entities_type (entity_type_id) WHERE deletedDate IS NULL`, `GIN (attributes jsonb_path_ops)`.
- **Tenancy (M4):** derive `tenantId` from the security context; ignore client value; add tenant predicate to all record queries.
- **Revalidation job:** Spring Batch job in `acc-ms-worker` that scans records with `schema_version < current`, reports violations (does not mutate), exposed as `POST /entity-types/{id}/revalidate` -> job execution id. Addresses M1 evolution safety.

### Phase 5 - Relationships
- Repositories + `RelationshipService` + endpoints: CRUD for `RelationshipType` (with optional `sourceEntityTypeId`/`targetEntityTypeId` constraints, `cardinality` - new columns) and `EntityRelationship` (`POST/DELETE /records/{id}/relationships`, `GET` with direction filter).
- Enforce at write time: both endpoints exist, belong to allowed entity types, not soft-deleted, triplet uniqueness (409), tenant match.
- `relation_picker` attribute validation: value must reference an existing record of `options.targetEntityTypeId`.
- Edge metadata validated against an optional per-relationship-type schema.

### Phase 6 - Modularity, observability, tests, docs
- Move to `com.acc.metadata` Modulith module (M6); `@ApplicationModule` + named interface; `ModularityTests` (`pnpm --filter @acc/backend test:modulith`) must pass. Decision D1 on aligning with plan 14's CQRS layout.
- Micrometer metrics: `metadata.schema.cache{level,result}`, `metadata.validation.failures{entityType}`, compile timer; structured log on schema change with before/after version.
- Tests: MockMvc slice tests (binding, validation, 401/403, error codes); `SchemaCompilerTest` table-driven over all 9 components (+ boundary cases); Testcontainers integration (PG + Redis down scenario); concurrency test reproducing C4 against versioned keys; Liquibase changeset test against PG.
- Docs: record C3/C4/C6/C7 in `docs/master_rules_reference.md` (hard-learned failure modes rule); `walkthrough_15.md`; update console `implementation_plan_52` follow-up list.

## 4. Database Changes (single new changeset `changelog-000.000.00002.xml`, registered in `changelog-master.xml`)

| Change | Reason |
| :--- | :--- |
| `UNIPOST_ENTITY_TYPES.schema_version BIGINT NOT NULL DEFAULT 1` | cache versioning, evolution |
| `UNIPOST_ATTRIBUTE_DEFINITIONS.display_order INT` | ordering |
| `UNIPOST_ENTITIES.schema_version BIGINT` | record/schema drift detection |
| Replace unique constraints with partial unique indexes `WHERE deletedDate IS NULL` | name reuse after soft delete |
| `idx_entities_type`, `GIN(attributes jsonb_path_ops)` | list/filter performance |
| `UNIPOST_RELATIONSHIP_TYPES`: `source_entity_type_id`, `target_entity_type_id`, `cardinality` | relationship constraints |
| Data fix-up: backfill `schema_version`, `display_order` | existing rows |

Existing changeset `hybrid-metadata-schema-init` is **not edited**.

## 5. Frontend (console) alignment - tracked separately, depends on Phases 1-3
1. Replace silent mock fallback with an explicit `VITE_METADATA_MOCK=true` dev switch; real HTTP errors must surface as toasts.
2. Consume `GET /entity-types/{id}/schema` for the preview and for client validation (drop the local compiler).
3. Map structured 400 errors to inline field errors in `RecordEditorDialog`.
4. Remove client-side reliance on `totalElements ?? rows.length` after H1 fix; pass `sort`/`filter` through.
5. Send/handle `version` for optimistic locking; show 409 conflict UX.

## 6. Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| Tightening validation (C3, `additionalProperties:false`) rejects data that was accepted before | Phase 4 revalidation job in report-only mode first; `lenient` flag for historical keys; release note |
| Enum-typing `dataType`/`uiComponent` breaks existing rows with other strings | Pre-migration query + data fix changeset; reject-on-unknown only after cleanup |
| Replacing unique constraint while data live | Create partial index first, then drop old constraint, in one transaction (PostgreSQL) |
| Authorization change locks out current console users | Roll out with role mapping documented; sandbox admin role already `ROLE_ADMIN` |
| `PageBuilder` is shared by other modules | Fix behind unit tests; grep all callers before merging |
| Scope creep on filtering | Whitelist operators (`eq, ne, gt, gte, lt, lte, in, contains`) in v1 |

## 7. Finalized Decisions
- **D1 (Architecture):** Lighter Modulith module with services (not heavy CQRS).
- **D2 (Response Envelope):** Standardize responses on the existing `ResponseWrapper` envelope via `ResponseEntityBuilder` (`responseBuilder.success(...)`).
- **D3 (Database Support):** PostgreSQL is the only supported datastore for metadata (JSONB, GIN, partial indexes).
- **D4 (Authority Model):** Fine-grained `METADATA_*` authorities (`METADATA_SCHEMA_WRITE`, `METADATA_RECORD_WRITE`, `METADATA_RECORD_READ`, etc.) combined with `ROLE_ADMIN`.

## 8. Verification Plan
- `pnpm --filter @acc/backend check-types` (compile incl. tests)
- `pnpm --filter @acc/backend test` (unit + slice + Testcontainers, requires Docker)
- `pnpm --filter @acc/backend test:modulith`
- Liquibase: apply changeset on a copy of local `acc` DB, run rollback, re-apply.
- Manual: with console pointed at the real backend (mock switch off) run create type -> add all 9 attribute kinds -> create/update/filter/delete records; confirm 400/404/409 bodies and pagination on page 2+.
