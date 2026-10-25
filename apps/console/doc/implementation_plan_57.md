# Implementation Plan 57 - Enterprise Enhancements for Three-Tier Metadata Architecture

Comprehensive implementation roadmap detailing the 5 most impactful architectural enhancements and practical improvements for the Three-Tier Metadata Management Module across Frontend (`@acc/console`), Backend (`@acc/backend`), and Database (`acc-db`).

---

## Executive Summary & Architecture Context

The Three-Tier architecture moves schema enforcement from database DDL to the application tier:
1. **Tier 1 (Frontend)**: Schema-driven dynamic UI rendering (`DynamicFieldRenderer`, React Query, Zod).
2. **Tier 2 (Backend)**: Authoritative Draft-07 JSON Schema compilation, L1/L2 multi-level cache, strict rejection (`additionalProperties: false`).
3. **Tier 3 (Database)**: PostgreSQL `JSONB` storage with `GIN (attributes jsonb_path_ops)` inverted indexing.

To transform this foundation into a resilient, enterprise-grade engine capable of supporting high concurrency, advanced querying, schema evolution, and real-time client feedback, we outline 5 major enhancements and 3 practical usability improvements.

---

## 1. Enhancement 1: Native PostgreSQL JSONB Containment (`@>`) Query Optimization (Tier 3)

### Problem & Motivation
Currently, [`EntityRecordSpecifications.java`](file:///C:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/EntityRecordSpecifications.java#L57-L68) constructs SQL predicates using `jsonb_extract_path_text(attributes, :attrName) = :val`. While functional, this prevents PostgreSQL from leveraging the `GIN (attributes jsonb_path_ops)` index for exact-match equality and multi-attribute filters. The index only accelerates the native JSON containment operator (`@>`).

### Proposed Solution
1. **Add Custom SQL Function / Operator to Hibernate / Criteria**:
   - Register or invoke native PostgreSQL containment expression:
     ```sql
     attributes @> cast(? as jsonb)
     ```
   - When filter parameters contain equality (`eq`) operations, group them into a single containment JSON payload:
     `{"brand": "Dell", "status": "active"}`.
2. **Specification Routing**:
   - Route `eq` and composite filter conditions to the GIN containment operator predicate.
   - Keep `jsonb_extract_path_text` for string pattern matching (`contains`/`like`) and numeric ranges (`gt`, `lt`).

### Verification & Value
- Benchmark: Explain plan shows `Bitmap Index Scan on idx_entities_attributes_gin` instead of `Seq Scan` on large entity datasets.
- Query latency drops from $O(N)$ to $O(\log N)$.
- **Status**: [COMPLETED] Implemented in `EntityRecordSpecifications.java` with JSONB containment (`jsonb_contains` / `@>`) and verified by unit test `testGetEntityRecords_WithEqualityContainmentFilters`.

---

## 2. Enhancement 2: Cache Stampede Mitigation & Lock-Free L1 Compilation (Tier 2)

### Problem & Motivation
In [`SchemaValidationService.java`](file:///C:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/SchemaValidationService.java#L67-L105), if the Hazelcast cache key expires or is invalidated during a burst of concurrent traffic, multiple threads simultaneously query the database and re-compile the JSON schema.

### Proposed Solution
1. **Per-Model Atomic In-Process Locking**:
   - Introduce a stripped key-lock or `ConcurrentHashMap.computeIfAbsent()` mechanism:
     ```java
     private final ConcurrentHashMap<String, CompletableFuture<JsonSchema>> inFlightCompilations = new ConcurrentHashMap<>();
     ```
   - All concurrent requests for the same `entityTypeId:v{version}` coalesce around a single compilation future.
2. **Graceful Degradation Fallback**:
   - If Hazelcast or Redis throws an exception (e.g. cluster restart or split-brain), log a warning once and serve seamlessly from local compiled L1 cache or fallback to fast in-memory compilation without blocking API calls.

### Verification & Value
- Load test with 500 concurrent threads hitting cache-miss scenarios: DB queries capped at exactly 1 per model.

---

## 3. Enhancement 3: Server-Authoritative Pre-Validation Endpoint (Tier 1 & Tier 2)

### Problem & Motivation
The frontend validates inputs using dynamic Zod schemas (`buildZodSchema()`) while the backend uses NetworkNT Draft-07 JSON Schema. Although they match for standard primitives, complex constraints (custom regex dialects, strict number bounds, custom date formats) can result in discrepancies where the frontend allows submission but the backend rejects it.

### Proposed Solution
1. **Backend Validation Endpoint**:
   - Add `POST /api/v1/metadata/entity-types/{id}/records/validate` accepting `{ "attributes": { ... } }`.
   - Executes validation against `SchemaValidationService` without writing to the database.
   - Returns `{ "valid": true }` or `{ "valid": false, "errors": [{ "field": "...", "message": "..." }] }`.
2. **Frontend Integration**:
   - In [`record-editor-dialog.tsx`](file:///C:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/record-editor-dialog.tsx), connect an optional debounced validation hook before form submission to highlight exact backend-enforced constraints in real time.

### Verification & Value
- Complete parity between frontend warning messages and backend schema errors; zero surprise rejections on form submit.

---

## 4. Enhancement 4: Retroactive Schema Evolution & Backfill Migrations (Tier 2 & Tier 3)

### Problem & Motivation
When an administrator adds a new mandatory attribute with a `defaultValue` (e.g. `currency: "USD"`) in the Schema Builder, existing records in `UNIPOST_ENTITIES` have `{}` for that attribute. When an existing record is edited, the new backend validator rejects it because the legacy record is missing the new mandatory field.

### Proposed Solution
1. **Batch Backfill Job**:
   - Add a migration utility method in `MetadataService`:
     ```java
     public int backfillDefaultValue(Long entityTypeId, String attributeKey, Object defaultValue);
     ```
   - Executes atomic SQL update:
     ```sql
     UPDATE UNIPOST_ENTITIES
     SET attributes = jsonb_set(attributes, cast('{' || :attrKey || '}' as text[]), cast(:defaultJson as jsonb), true),
         "version" = "version" + 1
     WHERE entity_type_id = :entityTypeId 
       AND NOT (attributes ? :attrKey)
       AND "deletedDate" IS NULL;
     ```
2. **Schema Builder UI Prompt**:
   - When an admin marks a new attribute as `isRequired` with a default value, display a checkbox: *"Apply default value to existing records (backfill)"*.

### Verification & Value
- Prevents breaking legacy records when schemas evolve over time in production environments.

---

## 5. Enhancement 5: Visual Multi-Attribute Filter Builder in Data Explorer (Tier 1)

### Problem & Motivation
The Data Explorer currently features a single search input that queries the first detected string attribute. Users managing complex data (e.g. products, customers, policies) require compound filtering (e.g. `Status = Active AND Price >= 100 AND Category IN [Electronics, Hardware]`).

### Proposed Solution
1. **Advanced Filter Popover & Rule Builder**:
   - Add a "Filter" button with active filter counter badge on the [`EntityDataGrid`](file:///C:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx) toolbar.
   - Interactive rule builder component (`FilterRuleBuilder` / `AdvancedFilterPopover`):
     - Field selector (populates from active model `AttributeDefinition` list with data type indicators).
     - Operator selector adapted to attribute type:
       - String: `equals`, `contains`, `not equals`, `in list`
       - Number/Decimal: `equals`, `greater than`, `greater or equal`, `less than`, `less or equal`, `not equals`
       - Boolean: `equals` (`true`/`false`)
       - Date/Timestamp: `equals`, `greater than`, `less than`
     - Value input: Renders dynamic input matching data type (text, number, switch/toggle, or select choices).
     - Removable rule rows with "Add Condition" and "Clear All" actions.
2. **Faceted Search Integration & Architecture Readiness**:
   - **Unified Filter State Model**: Define a composable filter clause schema:
     ```ts
     export interface AttributeFilterClause {
       id: string;
       field: string;
       operator: 'eq' | 'ne' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
       value: string;
     }
     ```
   - **Dual-Mode Adapter (Filter Builder + Faceted Search)**:
     - The filter structure serializes to both the backend query format (`filter[attr][op]=val`) and a canonical filter clause array.
     - Designed to connect seamlessly with future Faceted Search sidebars (aggregating counts per facet like `Category: Electronics (42), Furniture (18)`) where clicking a facet simply toggles an `AttributeFilterClause` in the same state store.
3. **Query Serialization & Persistence**:
   - Seamlessly serializes to the backend's existing query format:
     `filter[status][eq]=active&filter[price][gte]=100`.
   - Stored in `useMetadataUiStore.gridStateByModel` per model, ensuring filter state is preserved when switching models or tabs.
   - Renders active filter pills above the table with single-click dismiss.

### Verification & Value
- Empowers non-technical users to filter through complex JSONB record datasets without writing code or raw queries.
- Future-proofed for instant integration with dedicated entity data explorers and faceted search bars.
- **Status**: [COMPLETED] Implemented `AdvancedFilterPopover` with type-adapted operators, unified `AttributeFilterClause` state model in `useMetadataUiStore`, compound query serialization in `entity-data-grid.tsx`, active filter chip dismissals, and verified clean `@acc/console` build.

---

## Practical Usability & DX Enhancements

In addition to the 5 major architectural enhancements, the following practical improvements provide immediate ergonomic value:

1. **Bulk Record Export & Import (CSV / JSON)**:
   - Allow exporting filtered records to CSV/JSON and importing new records in bulk with transactional validation.
2. **JSON Schema Diff / Audit Log**:
   - Maintain a historical schema version log (`entity_types.schema_version`) showing which attributes were added, modified, or archived over time.
3. **Quick Inline Cell Editing in Data Explorer**:
   - Double-click a cell in the table to edit text, numbers, or toggles with immediate optimistic validation.

---

## Prioritization & Phasing Roadmap

| Phase | Enhancement | Scope | Est. Effort |
|---|---|---|---|
| **Phase 1** | **Enhancement 1**: Native GIN `@>` Containment Operator | Backend & Database | 1 - 2 days |
| **Phase 2** | **Enhancement 2**: Cache Stampede & Compilation Lock | Backend | 1 day |
| **Phase 3** | **Enhancement 5**: Multi-Attribute Filter Builder UI | Frontend | 2 - 3 days |
| **Phase 4** | **Enhancement 3**: Pre-Validation Dry-Run Endpoint | Frontend & Backend | 1 - 2 days |
| **Phase 5** | **Enhancement 4**: Schema Backfill & Migration Tooling | Backend & Database | 2 days |
