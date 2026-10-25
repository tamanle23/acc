# Implementation Plan 53 - Metadata Module Alignment in Console & Embedded Hazelcast Cache Migration

Scope: `@acc/console` (Frontend UI alignment) and `@acc/backend` (`acc-fw` embedded Hazelcast cache engine).

---

## 1. Executive Summary & Problem Analysis

Following the successful completion of the Backend Metadata Engine (Phases 0 to 6), the backend offers:
1. Pure JSON Schema Draft-07 compilation with strict `additionalProperties: false` via `GET /entity-types/{id}/schema`.
2. Optimistic locking on all entities (`version` field) returning `409 CONFLICT`.
3. Dynamic PostgreSQL JSONB filtering and sorting (`filter[attr][op]=val`, `sort=field,dir`, `tenantId`) with GIN indexes.
4. Attribute archiving (`/archive`, `/unarchive`), reordering (`/order`), and delete guards (`force=true`).
5. Entity Relationship types and edge tables with strict cardinality enforcement (`ONE_TO_ONE`, `ONE_TO_MANY`, `MANY_TO_ONE`, `MANY_TO_MANY`) and `relation_picker` referential integrity validation.

However:
- **`@acc/console` Misalignments**:
  - Catches errors silently in `metadata-api.ts` and falls back to mock data, hiding real backend status and errors.
  - Re-implements its own client-side JSON Schema Draft-07 compiler instead of consuming `GET /entity-types/{id}/schema`.
  - Performs local array filtering and sorting instead of passing query parameters to the backend.
  - Has zero UI or hooks for `RelationshipType` or `EntityRelationship`.
  - Does not send `version` or handle `409 CONFLICT`.
  - Lacks structured mapping for server validation violations onto form field error states.
- **Backend Cache Architecture Evolution**:
  - The current L1 in-memory + L2 Redis cache architecture relies on an external Redis instance.
  - **Requirement**: Replace the two-tier L1 Caffeine/ConcurrentHashMap + L2 Redis architecture with **Embedded Hazelcast** (`IMap<String, String>` and distributed event listeners), providing out-of-the-box cluster clustering without requiring an external Redis infrastructure dependency.

---

## 2. Target Architectural Design

```
+------------------------------------------------------------------------------+
|                           @acc/console                                  |
|                                                                              |
|  [ EntityTypeSidebar ] ---> [ SchemaBuilder ] ---> [ SchemaJsonPreview ]     |
|         |                           |                        |               |
|         v                           v                        |               |
|  [ EntityDataGrid ]        [ AttributeDialog ]               |               |
|         |                           |                        |               |
|         +---> [ RecordEditor ] <----+                        |               |
|         |            |                                       |               |
|         v            v                                       v               |
|   Server-Side   Structured 400                    Authoritative Backend      |
|   Filter/Sort   Inline Errors                     Draft-07 Schema Endpoint   |
+------------------------------------------------------------------------------+
                                |
                   REST API / JWT Authenticated
                                |
                                v
+------------------------------------------------------------------------------+
|                           @acc/backend                                  |
|                                                                              |
|  [ MetadataController ]                                                      |
|         |                                                                    |
|         v                                                                    |
|  [ MetadataService ] <========================+                              |
|         |                                     |                              |
|         +-------------------+                 |                              |
|         |                   |                 |                              |
|         v                   v                 |                              |
|  [ SchemaValidation ] [ SchemaCompiler ]     |                              |
|         |                                     |                              |
|         v                                     v                              |
|  +-----------------------------------------------------------------------+  |
|  |           EMBEDDED HAZELCAST DISTRIBUTED CACHE CLUSTER                |  |
|  |   - Distributed IMap<String, String> "metadata-schemas"               |  |
|  |   - In-Process Parsed JsonSchema Fast-Path                            |  |
|  |   - Versioned Keys: schema:{id}:v{version} (Stale Unreachable)        |  |
|  |   - Near-Cache Configuration for Microsecond Local Reads              |  |
|  |   - Hazelcast EntryListener for Cluster-wide Invalidation             |  |
|  +-----------------------------------------------------------------------+  |
|         |                                                                    |
|         v                                                                    |
|  [ PostgreSQL 16 ] (JSONB, GIN, Partial Active Unique Indexes)               |
+------------------------------------------------------------------------------+
```

---

## 3. Implementation Phases

### Phase 1: Backend Embedded Hazelcast Migration
1. **Dependency Management**:
   - Add `com.hazelcast:hazelcast-spring` to `apps/backend/acc-fw/pom.xml`.
2. **Hazelcast Configuration**:
   - Create `com.acc.boot.config.HazelcastConfiguration`:
     - Configure embedded `HazelcastInstance` with cluster name `acc-cluster`.
     - Configure `metadata-schemas` `MapConfig` with:
       - Eviction policy `LRU`, max size 1,000 entries.
       - TTL 1 hour.
       - **NearCacheConfig**: In-memory near cache on caller nodes for near-zero latency reads.
3. **Refactor Schema Caching & Invalidation**:
   - In `SchemaValidationService.java`:
     - Replace `RedisTemplate<String, String>` with `IMap<String, String>` from `HazelcastInstance`.
     - Keep L1 parsed `JsonSchema` memory cache.
     - On cache miss, retrieve from Hazelcast `metadata-schemas` `IMap` or recompile and put with versioned key `schema:{id}:v{version}`.
   - In `MetadataCacheListener.java`:
     - Evict from Hazelcast `metadata-schemas` `IMap` (e.g. `remove(key)` and versioned prefix cleanup).
4. **Testing**:
   - Verify unit tests and slice tests in `acc-fw` with Mockito/Embedded Hazelcast.

---

### Phase 2: Console Metadata Service Strategy & Mock Engine Enhancement
1. **Metadata Service Strategy Pattern**:
   - Create a clean `MetadataDataSource` interface defining all operations:
     - EntityTypes CRUD + getById
     - AttributeDefinitions CRUD + archive + unarchive + reorder
     - EntityRecords CRUD + patch + filtering/sorting
     - RelationshipTypes CRUD + EntityRelationships CRUD
     - Compiled JSON Schema fetching
   - Implement `HttpMetadataService` (calling `springApiClient` without silent error masking, letting 400/404/409/500 errors propagate naturally to React Query and toasts).
   - Implement `MockMetadataService` (improving `mockMetadataStore` with in-memory support for optimistic locking version bumps, relationship tables, attribute archival, reordering, and Draft-07 schema generation).
   - Instantiate the active strategy dynamically based on `import.meta.env.VITE_METADATA_MOCK === 'true' || import.meta.env.DEV && !backendAvailable` (or explicit config flag).
2. **DTO & Model Synchronization**:
   - In `apps/console/src/features/metadata/api/types.ts`:
     - Add `version?: number` and `schemaVersion?: number` to `EntityType`, `AttributeDefinition`, and `EntityRecord`.
     - Define `RelationshipType` and `EntityRelationship` models.
     - Define `RelationshipTypeResponse`, `CreateRelationshipTypeDto`, `UpdateRelationshipTypeDto`.
     - Define `EntityRelationshipResponse`, `CreateEntityRelationshipDto`.
     - Add `direction?: 'incoming' | 'outgoing'` filter query parameter.


---

### Phase 3: Console Schema Preview & Optimistic Locking
1. **Authoritative Schema Preview**:
   - Add `useCompiledSchema(entityTypeId)` query hook in `metadata-api.ts` calling `GET /v1/metadata/entity-types/{id}/schema`.
   - Update `apps/console/src/features/metadata/components/schema-builder/schema-json-preview.tsx` to display the backend's compiled schema and `schemaVersion` rather than client-compiled JSON.
2. **Optimistic Locking Conflict (409) Handling**:
   - In `useUpdateEntityType`, `useUpdateAttributeDefinition`, and `useUpdateEntityRecord`:
     - Pass the current `version` in payload.
   - In `entity-type-dialog.tsx`, `attribute-dialog.tsx`, and `record-editor-dialog.tsx`:
     - Detect HTTP 409 errors.
     - Display a user-friendly conflict banner: *"This record has been modified by another user. Please reload the latest changes."* with a "Refresh" action button.

---

### Phase 4: Server-Side Record Filtering & Sorting
1. **API Hook Parameters**:
   - Update `useEntityRecords` in `metadata-api.ts` to accept:
     - `filters?: Record<string, { op?: string; value: string }>` or `filterParams?: Record<string, string>`.
     - `sort?: string` (format: `field,asc` or `field,desc`).
     - `tenantId?: string`.
2. **EntityDataGrid Enhancements**:
   - In `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`:
     - Debounced server search input sending `filter[<attr>][contains]=query` or `filter[name]=query`.
     - Connect TanStack table column header clicks to server-side sorting (`sort=fieldName,asc|desc`).
     - Ensure pagination controls strictly use `recordsResponse.totalElements` and `recordsResponse.totalPages`.

---

### Phase 5: Structured 400 Error Mapping
1. **Form Error Integration**:
   - In `apps/console/src/features/metadata/components/data-explorer/record-editor-dialog.tsx`:
     - Catch Axios `error.response?.data?.errors`.
     - Map `{ code: 'VALIDATION_ERROR', detail: 'attributes.email', message: '...' }` to the specific input field in `errors` state.
     - Highlight invalid inputs directly with red specular borders and inline error messages.

---

### Phase 6: Relationships UI & Edge Management
1. **API Hooks**:
   - Add React Query hooks in `metadata-api.ts`:
     - `useRelationshipTypes`, `useCreateRelationshipType`, `useUpdateRelationshipType`, `useDeleteRelationshipType`.
     - `useRecordRelationships(recordId, direction)`, `useCreateEntityRelationship`, `useDeleteEntityRelationship`.
2. **Relationship Explorer**:
   - Add a "Relationships" tab in the Metadata console feature:
     - Manage Relationship Types (systemName, source type, target type, cardinality: `ONE_TO_ONE`, `ONE_TO_MANY`, `MANY_TO_ONE`, `MANY_TO_MANY`).
     - View and manage related record links directly in `EntityDataGrid` or record inspector.

---

## 4. Verification & Testing Plan
1. **Backend Verification**:
   - `node mvnw.cjs test -pl :acc-fw` (All unit tests passing with Hazelcast).
   - `node mvnw.cjs test` (Full 10-module reactor build passing).
2. **Console Verification**:
   - `pnpm --filter @acc/console check-types`
   - `pnpm --filter @acc/console build`
   - Test UI flows:
     - Schema JSON preview loads from backend.
     - Saving records with 409 version conflict triggers conflict UX.
     - Field validation errors returned from backend Draft-07 validation display inline on form fields.
     - Server-side sorting and filtering work seamlessly on `EntityDataGrid`.
3. **Documentation**:
   - Document changes in `apps/console/doc/walkthrough_53.md`.
