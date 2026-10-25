# Unlocking the Full Potential of Dynamic Metadata: Architectural Blueprint & Implementation Design

**Target Domain:** Enterprise Dynamic Data Fabric & Low-Code Ecosystem  
**Target Systems:** `@acc/backend` (Spring Modulith / Java 21), `@acc/console` (React 19 / Vite 8), `mobile-ui` (Expo SDK 57), `tekgo-ui` (Next.js 15)  
**Foundational Invariants:** Hybrid Relational + JSONB, Draft-07 JSON Schema, Distributed Hazelcast/Redis Caching (`schema:{id}:v{version}`), 3-Tier Edge Relationships (Patterns A, B, C)  
**Status:** Living Architectural Specification & Implementation Roadmap

---

## 1. Executive Vision & Motivation

The Unipost Dynamic Metadata Engine addresses the traditional impedance mismatch between rigid relational database schemas and evolving business entities. By coupling **PostgreSQL JSONB** storage with **Draft-07 JSON Schema compilation**, strict **schema versioning**, and **graph-capable edge relationships**, Unipost guarantees zero-downtime data modeling without physical `ALTER TABLE` DDL migrations.

However, treating dynamic metadata solely as an administrative back-office CRUD utility significantly underutilizes the system. When elevated to a first-class **dynamic data fabric**, the metadata engine becomes the central nervous system for:
1. **Dynamic Client UI Generation**: Zero-code form, data grid, and filter generation compliant with the Liquid Glass design system across Web and Mobile.
2. **Event-Driven Operational State Machines**: Transition validation, declarative lifecycle management, and tenant-level change event dispatching.
3. **Native AI Agent Integration & MCP Tools**: Machine-readable schemas as self-describing tool boundaries for autonomous LLM agents and semantic hybrid search.
4. **Graph Intelligence & Edge Computing**: Deep traversal, lineage tracing, and attributed relationships using the Pattern C connected edge engine.
5. **Enterprise Governance & Analytical Virtualization**: Audit time-travel, declarative virtual data marts, and streaming ingestion.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 UNIPOST ENTERPRISE PLATFORM                                 │
├───────────────────────────────┬──────────────────────────────┬──────────────────────────────┤
│      @acc/console         │          mobile-ui           │          tekgo-ui            │
│  (Dynamic Liquid Glass Studio)│   (Expo Dynamic Renderer)    │    (Customer Portal B2B)     │
├───────────────────────────────┴──────────────────────────────┴──────────────────────────────┤
│                         METADATA-DRIVEN APPLICATION FABRIC LAYER                            │
│  ┌───────────────────────┐  ┌────────────────────────┐  ┌────────────────────────────────┐  │
│  │ Headless Form Engine  │  │ Dynamic State Machine  │  │ AI Agent MCP / Tool Bridge     │  │
│  │ (Liquid Glass Schema) │  │ (Transition Rules/CEL) │  │ (Auto OpenAPI & JSON Schema)   │  │
│  └───────────────────────┘  └────────────────────────┘  └────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │ Pattern C Graph Engine & Lineage Traversal        │  │ Analytical Marts & Time-Travel │  │
│  └───────────────────────────────────────────────────┘  └────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                  CORE BACKEND ENGINE                                        │
│               SchemaValidationService (Draft-07) + Distributed Hazelcast L1/L2              │
│                  UNIPOST_ENTITY_TYPES  |  UNIPOST_ATTRIBUTE_DEFINITIONS                     │
│                  UNIPOST_ENTITIES      |  UNIPOST_ENTITY_RELATIONSHIPS                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Deep-Dive Track 1: Headless Dynamic UI Engine & Schema-Driven Renderers

### 2.1 Problem Statement
Developers currently spend hours manually assembling form inputs, tables, comboboxes, and validation hooks (`react-hook-form` + `zod`) for every newly defined entity model.

### 2.2 Architectural Design
Create a headless renderer package in `@acc/ui` that transforms a retrieved `JsonSchema` and layout metadata into high-fidelity UI components styled with the **Liquid Glass** design tokens.

```
┌──────────────────────────┐
│   Backend Entity Schema   │ ──(GET /api/v1/metadata/types/{id}/schema)──┐
└──────────────────────────┘                                              │
                                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ @acc/ui: <DynamicEntityForm />                                              │
│                                                                                 │
│  ┌───────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐ │
│  │ Text / String Field   │  │ Enum Select / Radio    │  │ Pattern B Picker   │ │
│  │ (Specular border,     │  │ (Frosted glass popover,│  │ (Async search      │ │
│  │  backdrop blur)       │  │  accessible aria list) │  │  modal + Combobox) │ │
│  └───────────────────────┘  └────────────────────────┘  └────────────────────┘ │
│                                                                                 │
│  Validation Engine: Ajv (Draft-07) + React-Hook-Form FormProvider               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Detailed Implementation Plan

#### Step 1: Layout Annotations in Schema Extension
Extend attribute definitions with a `ui_schema` JSON column to provide rendering hints without polluting relational definitions:
```json
{
  "widget": "entity_picker",
  "gridSpan": 6,
  "placeholder": "Select parent account...",
  "dependsOn": {
    "field": "account_type",
    "equals": "ENTERPRISE"
  }
}
```

#### Step 2: Component Architecture (`@acc/ui`)
Implement the universal renderer:
```tsx
// packages/ui/src/dynamic-form/dynamic-entity-form.tsx
export interface DynamicEntityFormProps {
  entityTypeSystemName: string;
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  mode?: 'create' | 'edit' | 'readonly';
}
```
* **Field Mapping Registry**: Maps primitive types (`STRING`, `INTEGER`, `BOOLEAN`, `TIMESTAMP`, `GEO_POINT`) to Liquid Glass input tokens (`backdrop-blur-xl bg-white/65 dark:bg-slate-900/65 border-white/30`).
* **Pattern B Combobox Resolver**: For attributes flagged as `RELATION`, dynamically bind to `/api/v1/metadata/entities?entityType={targetType}` with debounce search and virtualized listing.
* **Client-side JSON Schema Pre-Validation**: Run `ajv-formats` client-side before dispatching network requests, guaranteeing identical error messaging between client and server.

---

## 3. Deep-Dive Track 2: Declarative State Machines & Operational Workflows

### 3.1 Problem Statement
Dynamic records are often not merely static data records; they represent lifecycles (e.g., `JobOrder`, `ReturnTicket`, `PolicyDocument`) that require controlled state transitions, permission gates, and side effects.

### 3.2 Architectural Design
Introduce a lightweight, metadata-driven Finite State Machine (FSM) engine integrated into the `@acc/backend` write pipeline:

```
[Record Draft] ──(Event: SUBMIT)──> [Validation Gate] ──(Pass)──> [Pending Review]
                                           │
                                         (Fail: Missing Approver ID)
                                           │
                                           ▼
                                    Throw BusinessException
```

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      State Machine Definition Schema                            │
│                                                                                 │
│  UNIPOST_ENTITY_TYPES.lifecycle_config (JSONB):                                 │
│  {                                                                              │
│    "state_field": "status",                                                     │
│    "initial_state": "DRAFT",                                                    │
│    "states": ["DRAFT", "PENDING_APPROVAL", "ACTIVE", "ARCHIVED"],               │
│    "transitions": [                                                             │
│      {                                                                          │
│        "from": "DRAFT",                                                         │
│        "to": "PENDING_APPROVAL",                                                │
│        "action": "SUBMIT",                                                      │
│        "required_attributes": ["title", "owner_id", "budget"],                  │
│        "guard_expression": "attributes.budget <= 100000",                       │
│        "allowed_roles": ["ROLE_CREATOR", "ROLE_ADMIN"]                          │
│      }                                                                          │
│    ]                                                                            │
│  }                                                                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Implementation Details
1. **FSM Enforcement Filter**: In `EntityRecordService.updateEntityRecord()`, inspect if `record.attributes[state_field]` has changed.
2. **Transition Validation**:
   - Check if current state $\to$ target state is registered in `transitions`.
   - Validate caller's Security Context against `allowed_roles`.
   - Evaluate `guard_expression` using Spring Expression Language (SpEL) or Google CEL (Common Expression Language).
3. **Application Event Publishing**: Upon successful transition, publish `EntityStateChangedEvent(tenantId, entityTypeId, recordId, oldState, newState)`.

---

## 4. Deep-Dive Track 3: Autonomous AI Agent Bridge & Dynamic MCP Tooling

### 4.1 Problem Statement
Modern enterprise applications require autonomous AI agents to query and manipulate domain entities. Hardcoding LLM tools for every entity type is unsustainable as entities evolve dynamically.

### 4.2 Architectural Design
Because the Unipost metadata engine already compiles complete Draft-07 JSON Schemas, it can **dynamically synthesize Model Context Protocol (MCP) Tool definitions and OpenAI/Gemini Function Signatures at runtime**.

```
┌─────────────────────────────────┐
│ UNIPOST Dynamic Metadata Engine │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ DynamicMcpToolRegistryService   │
└────────────────┬────────────────┘
                 │ Generates Tool Definitions
                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│ MCP Server / Tool API:                                                 │
│ 1. `acc_get_schema(entity_type)`                                   │
│ 2. `acc_query_entities(entity_type, filter_criteria, limit)`       │
│ 3. `acc_create_entity(entity_type, attributes)`                    │
│    └─ Parameters strictly validated against entity's JSON Schema       │
│ 4. `acc_link_entities(source_id, target_id, relation_system_name)` │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Implementation Strategy
* **On-the-Fly Tool Synthesis**: When an AI agent connects via SSE or WebSocket, the backend inspects all `UNIPOST_ENTITY_TYPES` available to the tenant and exposes an MCP tool manifest:
  ```json
  {
    "name": "create_deployment_policy",
    "description": "Create a new Deployment Policy record in tenant context",
    "inputSchema": {
      "type": "object",
      "properties": {
        "policy_name": { "type": "string" },
        "max_clusters": { "type": "integer", "minimum": 1 }
      },
      "required": ["policy_name"]
    }
  }
  ```
* **Semantic Hybrid Search**:
  * Add a pgvector or companion search index on `UNIPOST_ENTITIES`.
  * Index formatted text representations of attributes to enable semantic queries like: *"Find all delivery tickets marked as fragile in district 7"*.

---

## 5. Deep-Dive Track 4: Graph Intelligence & Connected Lineage Engine (Pattern C)

### 5.1 Problem Statement
Relationships in enterprise models are rarely simple lookup pointers; they form interconnected directed acyclic graphs (DAGs) or networks (e.g., Supply Chain routes, Organization Charts, Microservice dependencies).

### 5.2 Architectural Design
Leverage `UNIPOST_ENTITY_RELATIONSHIPS` with recursive graph queries and visual exploration tools:

```
[Customer Account: 101]
       │
       ├──(HAS_POLICY)──> [Deployment Policy: 301]
       │                         │
       └──(ASSIGNED_TO)──> [Cluster Node: 902] <──(CONNECTED_TO)── [Storage Volume: 405]
```

### 5.3 Implementation Specifications
1. **Recursive Graph Traversal API**:
   Provide a Spring Modulith graph traversal service with depth-limiting guards to prevent infinite cycles:
   ```sql
   WITH RECURSIVE entity_graph AS (
       SELECT source_entity_id, target_entity_id, relationship_type_id, 1 as depth
       FROM UNIPOST_ENTITY_RELATIONSHIPS
       WHERE source_entity_id = :startEntityId AND deleted_date IS NULL
     UNION ALL
       SELECT r.source_entity_id, r.target_entity_id, r.relationship_type_id, eg.depth + 1
       FROM UNIPOST_ENTITY_RELATIONSHIPS r
       INNER JOIN entity_graph eg ON r.source_entity_id = eg.target_entity_id
       WHERE eg.depth < :maxDepth AND r.deleted_date IS NULL
   )
   SELECT * FROM entity_graph;
   ```
2. **React Flow Graph Inspector Component**:
   In `@acc/console`, create an interactive visualization canvas (`RecordLineageCanvas.tsx`) showing live nodes, edge labels, and metadata badges.
3. **Attributed Edge Properties**:
   Store contextual business data directly on `edge_metadata` (e.g., `effective_date`, `sla_priority`, `weight`) without denormalizing the related entities.

---

## 6. Deep-Dive Track 5: Enterprise Governance, Virtual Data Marts & Time-Travel

### 6.1 Problem Statement
Enterprise customers require point-in-time auditing, compliance rollbacks, and fast BI querying over JSONB datasets without degrading write throughput.

### 6.2 Architectural Design & Implementation
1. **JSONB Delta Audit Logging (Time-Travel Engine)**:
   * Record every attribute mutation in `UNIPOST_ENTITY_AUDIT_LOGS` storing RFC 6902 JSON Patches (`[{"op": "replace", "path": "/status", "value": "ACTIVE"}]`).
   * Provide a point-in-time snapshot API: `GET /api/v1/metadata/entities/{id}/history?timestamp=...` which reconstructs the record state by applying inverse patches.
2. **Declarative Virtual Data Marts**:
   * Generate read-only PostgreSQL views or DuckDB virtual tables for analytical dashboards:
   ```sql
   CREATE OR REPLACE VIEW view_customer_accounts AS
   SELECT 
       id,
       tenant_id,
       attributes->>'company_name' AS company_name,
       (attributes->>'annual_revenue')::numeric AS annual_revenue,
       created_date
   FROM UNIPOST_ENTITIES
   WHERE entity_type_id = 'ent_customer_acc' AND deleted_date IS NULL;
   ```
3. **Data Import/Export Engine**:
   * Build a streaming CSV/Parquet import pipeline that runs bulk validation against the compiled `JsonSchema` before batch-inserting into PostgreSQL.

---

## 7. Phased Implementation Roadmap

| Phase | Milestone | Deliverables | Monorepo Scope |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Headless UI Renderer & Studio** | `<DynamicEntityForm />`, `<DynamicDataGrid />`, Filter Builder, Liquid Glass Tokens | `@acc/ui`, `@acc/console`, `mobile-ui` |
| **Phase 2** | **AI Agent MCP & OpenAPI Bridge** | Runtime MCP Tool registry, JSON Schema $\to$ MCP schema converter, Semantic Search | `@acc/backend`, AI sidecar |
| **Phase 3** | **FSM Operational State Engine** | Lifecycle config in `UNIPOST_ENTITY_TYPES`, CEL/SpEL validation, transition events | `@acc/backend` |
| **Phase 4** | **Pattern C Graph Studio & Lineage** | Recursive traversal SQL, React Flow visualizer, edge metadata editor | `@acc/backend`, `@acc/console` |
| **Phase 5** | **Data Governance & Virtual Marts** | RFC 6902 patch auditing, virtual SQL view generator, bulk CSV ingestion | `@acc/backend`, database layer |

---

## 8. Conclusion

By treating dynamic metadata not merely as an isolated schema configurator, but as the **central foundation for UI rendering, agentic workflows, operational lifecycles, and graph intelligence**, Unipost unlocks true platform-grade composability. This architecture eliminates technical debt, drastically shortens feature delivery cycles, and prepares the platform for enterprise multi-tenant scale and AI-driven automation.
