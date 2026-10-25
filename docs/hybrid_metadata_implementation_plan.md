# Comprehensive Implementation Plan: Hybrid Metadata Architecture

## 1. Design Strategy

The objective is to implement a robust Hybrid Metadata Architecture that allows for dynamic schema definition and entity management without requiring database schema changes for every new attribute, while ensuring seamless integration with the existing `@acc/backend` (Spring Modulith) and frontend ecosystem (React 19/Next.js/Expo, Zustand, TanStack Query).

The strategy divides the system into two distinct zones:
*   **The Rules (Metadata):** Strictly relational tables (`entity_types`, `attribute_definitions`) defining the schema.
*   **The Records (Data):** Hybrid tables (`entities`) storing structured core data in columns and dynamic data in `JSONB` payloads, alongside dynamic graph relationships (`entity_relationships`).

This approach balances flexibility with strict referential integrity, performance, and cache-driven validation.

## 2. Architecture

The architecture spans the entire full-stack ecosystem:

### Backend (`@acc/backend`)
*   **Database (PostgreSQL via Liquibase in `acc-db`):**
    *   Leverages `JSONB` for dynamic attributes.
    *   Implements the "Edge Table" (Pattern C) for complex dynamic relationships while maintaining referential integrity.
*   **Domain Models (`acc-fw`):**
    *   JPA Entities extend `com.acc.domain.BaseModel` utilizing `Long` IDs to conform to enterprise standards.
    *   A custom `JsonConverter` (backed by Jackson) natively maps Postgres `JSONB` columns to Java `Map<String, Object>`.
*   **Schema Validation & Caching (`acc-fw`):**
    *   A `SchemaValidationService` acts as a Facade to compile and validate schemas.
    *   Validation rules are serialized and cached in Redis (`schema:{entity_type_id}`).
*   **CQRS & Event-Driven Invalidation (`acc-fw`):**
    *   Schema mutations dispatch cross-module Spring Events (e.g., `AttributeDefinitionUpdatedEvent`).
    *   A Mediator/Saga listener processes these events using `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)` combined with `@Async` to invalidate Redis caches cleanly.
    *   Generic type resolution within mediators strictly utilizes `org.springframework.core.ResolvableType` for proxy safety.

### Frontend (`@acc/console`, `@acc/tekgo-ui`)
*   **State Decoupling (Zustand):**
    *   Centralized UI stores manage the state of dynamically generated forms and schemas, minimizing prop-drilling.
*   **Network & Caching (TanStack Query):**
    *   Custom hooks wrap TanStack Query (Mediator pattern) to fetch dynamic schemas (`useSchema(entityTypeId)`) and entity data (`useEntity(entityId)`), decoupling components from raw fetch logic.
*   **Dynamic UI (`@acc/ui`):**
    *   A generic `DynamicForm` component renders input fields based on the `ui_component` metadata (e.g., dropdowns, number inputs).
    *   Styling strictly adheres to the 'Liquid Glass' design system (e.g., wrapping forms in `GlassCard` components).

## 3. Implementation Steps

### Phase 1: Backend Database & Domain
1.  **Liquibase Migrations (`acc-db`):**
    *   Create a changeset to define `UNIPOST_ENTITY_TYPES`, `UNIPOST_ATTRIBUTE_DEFINITIONS`, `UNIPOST_ENTITIES`, `UNIPOST_RELATIONSHIP_TYPES`, and `UNIPOST_ENTITY_RELATIONSHIPS`.
    *   Ensure all primary tables include standard audit columns defined in `BaseModel`.
    *   Apply `JSONB` data types and `GIN` indexing on the `attributes` and `options` columns.
2.  **JPA Domain Models (`acc-fw`):**
    *   Implement entities (`EntityType`, `AttributeDefinition`, `EntityRecord`, `EntityRelationship`) in the `domain/metadata` package.
    *   Implement `MapJsonConverter` extending the base `JsonConverter` to handle JSON mapping.

### Phase 2: Backend Services & CQRS
1.  **Caching Layer:**
    *   Implement `SchemaValidationService` leveraging Spring's `RedisTemplate` to manage `schema:{entity_type_id}` keys.
2.  **Event Listeners:**
    *   Create `AttributeDefinitionUpdatedEvent`.
    *   Implement `MetadataCacheListener` with `@TransactionalEventListener` and `@Async` to clear the cache upon schema modification commands.
3.  **Validation Logic:**
    *   Integrate a JSON Schema validation library (e.g., `networknt/json-schema-validator`) within the `SchemaValidationService` to execute payload validation before JPA persistence.

### Phase 3: Frontend Dynamic UI
1.  **Data Fetching Mediators:**
    *   Create `useDynamicSchema` and `useDynamicEntity` hooks wrapping TanStack query for fetching and caching Rules and Records.
2.  **Zustand Store:**
    *   Implement `useDynamicFormStore` to hold the transient state of complex dynamic entities being edited.
3.  **Liquid Glass Components:**
    *   Implement a `DynamicFieldRenderer` component that switches on the `ui_component` metadata to render the appropriate input (Text, Select, Checkbox).
    *   Assemble these into a `GlassCard` wrapped `DynamicEntityEditor` page.

## 4. Extensibility (OCP)

*   **Open/Closed Principle in UI:** The `DynamicFieldRenderer` on the frontend is designed so that new UI component types (e.g., `markdown_editor`, `map_picker`) can be added by registering a new renderer strategy without modifying the core form traversal logic.
*   **Validation Extensibility:** The backend `SchemaValidationService` is built to easily swap out validation engines (e.g., Draft 7 vs Draft 2020-12) or append custom programmatic rules on top of the dynamic JSON validation via an interceptor pattern.
*   **Analytics Extraction:** The schema is primed for integration with ETL tools like dbt via Materialized Views that can safely unnest the `JSONB` payload into flattened analytical tables without touching the transactional application code.
