# Part 1: High-Level Multi-Tenant Architecture Specification (Dynamic Metadata Platform)

**Series:** Multi-Tenant Architecture Blueprint Series (Document 01 of N)  
**Document Level:** High-Level Architecture (HLA) & System Blueprint  
**Target Systems:** `@acc/backend` (Spring Modulith / Java 21), `@acc/console` (React 19 / Vite 8), `mobile-ui` (Expo SDK 57), `tekgo-ui` (Next.js 15)  
**Foundational Paradigm:** Pure Tenant-Isolated Dynamic Metadata & Data Engine  
**Status:** Canonical Living Architecture Document  

---

## 1. Executive Summary & Anchor Principles

The Unipost platform serves a diverse spectrum of tenants ranging from large multi-department enterprises to single-person professional operators. To support this heterogeneity without software fragmentation or database migration bottlenecks, the platform implements a **Pure Tenant-Based Dynamic Metadata Engine**.

### Core Anchor Principles
1. **The Tenant as the Atomic Boundary of Ownership**:
   A Tenant is the root isolation boundary representing an Organization, a Business Unit, or a Single Individual. A tenant owns its users, its schemas, its data records, and its relational graph edges.
2. **Users as Identity Principals within a Tenant**:
   A tenant contains one or many users. A single-operator tenant consists of exactly one user with full administrative privileges; an enterprise tenant consists of hundreds of users partitioned by granular Role-Based Access Control (RBAC).
3. **Pure Tenant Isolation across Both Metadata and Data Planes**:
   * **Metadata Plane (Schemas)**: `UNIPOST_ENTITY_TYPES`, `UNIPOST_ATTRIBUTE_DEFINITIONS`, and `UNIPOST_RELATIONSHIP_TYPES` are scoped to the tenant. Schema definitions, validations, and field configurations belong purely to that tenant.
   * **Data Plane (Records & Graph)**: `UNIPOST_ENTITIES` (JSONB attributes) and `UNIPOST_ENTITY_RELATIONSHIPS` (Pattern C connected edges) belong strictly to that tenant.
4. **Zero Cross-Tenant Contamination by Construction**:
   Physical database keys, composite unique constraints, in-memory cache namespaces, and recursive graph traversal queries are all bound to `tenant_id`. Cross-tenant data leaks or schema collisions are rendered structurally impossible.

---

## 2. High-Level Architectural Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          UNIPOST CLIENT PLATFORM                                       │
│                                                                                                        │
│   ┌────────────────────────────────────────┐         ┌────────────────────────────────────────┐        │
│   │           @acc/console             │         │       mobile-ui / tekgo-ui             │        │
│   │   Tenant Context & Active Persona      │         │     Tenant-Bound Operational Apps      │        │
│   └───────────────────┬────────────────────┘         └───────────────────┬────────────────────┘        │
└───────────────────────┼──────────────────────────────────────────────────┼─────────────────────────────┘
                        │ HTTPS (Bearer JWT with tenant_id, user_id, roles)│
                        ▼                                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       @acc/backend GATEWAY                                         │
│                                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │ TenantSecurityFilter: Cryptographic JWT Verification -> Extract Claims -> Bind TenantContext   │   │
│   └────────────────────────────────────────────────┬───────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┼───────────────────────────────────────────────────┘
                                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  METADATA & OPERATIONAL CORE ENGINE                                    │
│                                                                                                        │
│    ┌─────────────────────────────────────────┐          ┌─────────────────────────────────────────┐    │
│    │             METADATA PLANE              │          │               DATA PLANE                │    │
│    │     (Schema Management & Validation)    │          │      (Record Engine & Pattern C Graph)  │    │
│    │                                         │          │                                         │    │
│    │  • Entity Type & Attribute Registry     │          │  • Entity Record CRUD & JSONB Store     │    │
│    │  • Draft-07 JSON Schema Compiler        │          │  • Dynamic Query Engine (GIN Filters)   │    │
│    │  • Tenant Cache:                        │          │  • Graph Traversal & Connected Edges    │    │
│    │    `schema:{tenant_id}:{type}:v{ver}`   │          │  • FSM Operational State Transitions    │    │
│    └────────────────────┬────────────────────┘          └────────────────────┬────────────────────┘    │
└─────────────────────────┼────────────────────────────────────────────────────┼─────────────────────────┘
                          │                                                    │
                          ▼                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SHARED POSTGRESQL MULTI-TENANT DB                                    │
│                                                                                                        │
│   ┌─────────────────────────────────────────┐          ┌─────────────────────────────────────────┐     │
│   │ UNIPOST_ENTITY_TYPES                    │          │ UNIPOST_ENTITIES (JSONB Attributes)     │     │
│   │ UNIQUE(tenant_id, system_name)          │          │ Composite Index: (tenant_id, type_id)   │     │
│   ├─────────────────────────────────────────┤          ├─────────────────────────────────────────┤     │
│   │ UNIPOST_ATTRIBUTE_DEFINITIONS           │          │ UNIPOST_ENTITY_RELATIONSHIPS (Graph)    │     │
│   │ Foreign Key to EntityType with tenant_id│          │ Strict Invariant: Source & Target same  │     │
│   └─────────────────────────────────────────┘          └─────────────────────────────────────────┘     │
│                                                                                                        │
│   Row-Level Security (RLS) Policy Guard: tenant_id = current_setting('app.current_tenant_id')          │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The Two-Plane Separation: Metadata vs. Data

The architecture cleanly bifurcates every tenant's operational footprint into two distinct planes:

```
                                  ┌───────────────────────────┐
                                  │      TENANT BOUNDARY      │
                                  │ (tenant_id = "tenant-007")│
                                  └─────────────┬─────────────┘
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 ▼                                                             ▼
  ┌─────────────────────────────┐                               ┌─────────────────────────────┐
  │       METADATA PLANE        │                               │         DATA PLANE          │
  ├─────────────────────────────┤                               ├─────────────────────────────┤
  │ What does data LOOK LIKE?   │                               │ What data ACTUALLY EXISTS?  │
  │                             │                               │                             │
  │ • Entity Definitions        │                               │ • Entity Records            │
  │ • Attribute Specs & Types   │                               │ • Attribute JSONB Payloads  │
  │ • Validation Constraints    │                               │ • Graph Edges (Pattern C)   │
  │ • Lifecycle Transitions     │                               │ • Audit Logs & History      │
  │                             │                               │                             │
  │ Managed by: Tenant Admin    │                               │ Managed by: Tenant Users    │
  └─────────────────────────────┘                               └─────────────────────────────┘
```

### 3.1 Metadata Plane (Schema Management & Inheritance)
* **Hybrid Schema Model**: As detailed in Document 07, the Metadata Plane distinguishes between:
  1. **Common System Schemas (`tenant_id = 'SYSTEM'`)**: Universal platform core entities (`User`, `CustomerAccount`, `Invoice`) accessible read-only to all tenants.
  2. **Tenant Overlay Extensions**: Custom attributes attached by a specific tenant onto a System Entity without forking the base definition.
  3. **Pure Tenant Schemas (`tenant_id = 'tnt_...'`)**: Bespoke entities created entirely by and for a specific tenant.
* **Zero DDL Migrations**: Schema creation and modifications take place entirely via row entries in `UNIPOST_ENTITY_TYPES` and `UNIPOST_ATTRIBUTE_DEFINITIONS`. The underlying physical database executes zero `ALTER TABLE` operations.
* **Deterministic Composite Cache Partitioning**: Compilations of Draft-07 JSON Schemas are stored in distributed memory (Hazelcast/Redis) namespaced by tenant and dual-versioned:
  $$\text{Cache Key} = \text{"schema:"} + \text{tenant\_id} + \text{":"} + \text{system\_name} + \text{":v"} + \text{tenantVer} + \text{"\_s"} + \text{systemVer}$$
  A schema alteration by Tenant A increments only Tenant A's version, maintaining uninterrupted cache validity for all other tenants. Platform updates to `SYSTEM` schemas cleanly bump the system version across all tenants.

### 3.2 Data Plane (Records and Connected Edges)
* **Universal JSONB Record Storage**: All tenant data records reside in `UNIPOST_ENTITIES`. Dynamic attributes are stored in `attributes JSONB`. Data records are 100% tenant-isolated (the `SYSTEM` tenant never stores business data records).
* **Runtime Validation Invariant**: Prior to persisting any record mutation, the backend fetches the tenant's compiled JSON Schema from cache, applying strict server-side validation against `record.attributes`.
* **Pattern C Graph Isolation**: Connected relationship edges (`UNIPOST_ENTITY_RELATIONSHIPS`) link records belonging exclusively to that same tenant.

---

## 4. Tenant Personas & Granular RBAC

Users within a tenant are assigned roles that grant permissions across the Metadata Plane, the Data Plane, or both:

| Persona | Typical Organization Profile | Metadata Plane Access (Schemas) | Data Plane Access (Records) | Example Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Solo Operator** | Freelancer, Independent Consultant, Single-user business | **Full Access** (`CREATE`, `UPDATE`, `ARCHIVE`) | **Full Access** (`CRUD`) | `OWNER` (Full autonomy over own workspace) |
| **Tenant Administrator** | Solutions Architect, IT Lead in an Enterprise Tenant | **Full Access** (`CREATE`, `UPDATE`, `ARCHIVE`) | **Optional / Full Access** | `metadata:schema:*`, `tenant:user:*` |
| **Operational User** | Business Specialist, Logistics Dispatcher, Account Rep | **No Access** (Read-only schema inspection) | **Create / Read / Update** | `entity:record:create`, `entity:record:update` |
| **Auditor / Viewer** | External Auditor, Read-only Stakeholder | **Read-Only** | **Read-Only** | `metadata:schema:read`, `entity:record:read` |
| **Platform Super-Admin**| Unipost Core Platform Support / SRE team | **Cross-Tenant Oversight** (Emergency break-glass only) | **Restricted / Redacted** | Platform-level infrastructure monitoring |

---

## 5. Security & Isolation Invariants

Multi-tenant integrity in Unipost is guaranteed through defense-in-depth spanning five discrete barriers:

### Invariant 1: Cryptographic JWT Claims (Zero Client Trust)
* The client application never supplies `tenant_id` via HTTP request bodies, route query parameters, or mutable headers.
* The API Gateway / `TenantSecurityFilter` extracts `tenant_id` exclusively from the cryptographically verified JWT issued during authentication.
* The extracted `tenant_id` is bound to the execution thread via `TenantContextHolder` and propagated down the service pipeline.

### Invariant 2: Scoped Database Constraints
Global uniqueness constraints are strictly prohibited on multi-tenant metadata tables. Uniqueness is enforced compositely with `tenant_id`:
```sql
-- UNIPOST_ENTITY_TYPES
ALTER TABLE UNIPOST_ENTITY_TYPES 
ADD CONSTRAINT uq_entity_type_tenant_system_name 
UNIQUE (tenant_id, system_name);

-- UNIPOST_ATTRIBUTE_DEFINITIONS
ALTER TABLE UNIPOST_ATTRIBUTE_DEFINITIONS 
ADD CONSTRAINT uq_attribute_def_tenant_entity_name 
UNIQUE (tenant_id, entity_type_id, name);
```

### Invariant 3: PostgreSQL Row-Level Security (RLS) Failsafe
To protect against human error in custom queries or repository methods, PostgreSQL RLS is enabled as a physical safety net:
```sql
ALTER TABLE UNIPOST_ENTITIES ENABLE ROW LEVEL SECURITY;
ALTER TABLE UNIPOST_ENTITY_TYPES ENABLE ROW LEVEL SECURITY;
ALTER TABLE UNIPOST_ATTRIBUTE_DEFINITIONS ENABLE ROW LEVEL SECURITY;

-- 1. Data Plane: 100% strict isolation
CREATE POLICY tenant_isolation_entities ON UNIPOST_ENTITIES
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id', true));

-- 2. Metadata Plane: Tenants can read their own schemas + global 'SYSTEM' schemas
CREATE POLICY tenant_isolation_metadata ON UNIPOST_ENTITY_TYPES
FOR ALL
USING (
    tenant_id = current_setting('app.current_tenant_id', true) 
    OR tenant_id = 'SYSTEM'
)
WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true) 
    AND tenant_id != 'SYSTEM'
);
```
Every database transaction initialized by the backend executes `SET LOCAL app.current_tenant_id = :tenantId`. Any query attempting to read or write a row outside the active tenant is rejected at the database engine level.

### Invariant 4: Graph Edge Boundary Enforcement (Pattern C)
Cross-tenant graph links are strictly prohibited:
$$\forall e \in \text{UNIPOST\_ENTITY\_RELATIONSHIPS} \implies \text{source.tenant\_id} = \text{target.tenant\_id} = e\text{.tenant\_id}$$
During relationship edge creation, the service layer queries both endpoints with the active `tenant_id`. If either record does not exist within the tenant, the operation fails fast with an `EntityNotFoundException`.

### Invariant 5: Recursive Traversal Depth and Scope Clamping
All recursive graph queries enforce the active `tenant_id` on both the anchor and recursive CTE terms. Furthermore, recursive queries enforce maximum depth guards (e.g. `depth <= 10`) to prevent denial-of-service cycles.

---

## 6. High-Scale Data & Query Strategy

To scale efficiently when thousands of tenants share the storage layer:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              POSTGRESQL STORAGE & QUERYING                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Composite B-Tree Indexing:                                                          │
│    CREATE INDEX idx_entities_tenant_type_active                                        │
│    ON UNIPOST_ENTITIES (tenant_id, entity_type_id) WHERE deletedDate IS NULL;          │
│                                                                                        │
│ 2. GIN Indexing on JSONB attributes:                                                   │
│    CREATE INDEX idx_entities_jsonb_gin ON UNIPOST_ENTITIES USING GIN (attributes);     │
│                                                                                        │
│ 3. Partitioning Strategy (At Hyper-Scale):                                             │
│    Declarative Hash / List Partitioning on UNIPOST_ENTITIES BY (tenant_id)             │
│    -> Tier 1 High-Throughput Tenants routed to dedicated physical table partitions.    │
│    -> Long-tail single users and small tenants pooled in shared partitions.            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

* **Query Execution Path**: Every query generated by the backend begins with `tenant_id = :tenantId`. The PostgreSQL query planner uses index-only or bitmap index scans that immediately isolate the search space to the tenant’s records.
* **Noisy Neighbor Protection**: CPU-heavy operations (e.g. JSON Schema validation, complex regex evaluations) run inside the stateless JVM application layer rather than the database engine, safeguarding shared database throughput.

---

## 7. Client & UI Integration (`@acc/console`)

In `@acc/console`, the user experience gracefully adapts based on the active user’s permissions within their tenant:

1. **Adaptive Workspace Navigation**:
   * **Tenant Administrators / Solo Operators**: See the complete **Metadata Studio** (Entity Model Tree, Schema Builder, JSON Schema Preview, Connected Edge Type Manager).
   * **Operational Users**: The Schema Builder is hidden; the UI defaults directly to the **Data Explorer** (Dynamic Data Grids, Dynamic Liquid Glass Forms, Filter Panels).
2. **Dynamic UI Rendering**:
   * Client applications fetch `/api/v1/metadata/types` and receive the tenant-specific schema definitions.
   * Universal renderers dynamically construct form fields, validations, and comboboxes without requiring bespoke front-end code per tenant.
3. **Tenant Switcher (Cross-Tenant Principals)**:
   * Users who belong to multiple tenants (e.g. an agency consultant managing multiple client accounts) can switch active tenants via the UI header. Switching tenants invalidates the client-side metadata store and requests a new scoped JWT token for the target tenant.

---

## 8. Summary & Architectural Validation

This Multi-Tenant Architecture achieves the optimal balance for the Unipost platform:

| Requirement | How Unipost Solves It |
| :--- | :--- |
| **Serving Solo Users to Giant Enterprises** | A unified Tenant model where a tenant can contain 1 user or 10,000 users. |
| **Unique Schemas per Tenant** | Dynamic Metadata Engine stores schemas as data in `UNIPOST_ENTITY_TYPES`, requiring zero DDL changes. |
| **Security & Isolation** | Cryptographic JWT claims + Composite DB Keys + Hazelcast Cache Namespacing + PostgreSQL Row-Level Security. |
| **High Performance at Scale** | Tenant-scoped composite indexing, compiled JSON Schema caching, and stateless validation workloads. |
| **Developer Velocity** | Single codebase, single deployment pipeline, zero tenant-specific migration scripts. |
