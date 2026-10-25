# Part 7: Common System Schemas vs. Tenant-Based Custom Schemas & Inheritance

**Series:** Multi-Tenant Architecture Blueprint Series (Document 07 of N)  
**Document Level:** Core Data Modeling & Schema Resolution Architecture  
**Target Systems:** `@acc/backend` (Spring Modulith / Java 21 / PostgreSQL 16+), `@acc/console` (React 19 / Vite 8)  
**Scope:** Universal Core Entities (`tenant_id = 'SYSTEM'`), Tenant Overlay Attributes, RLS Read-Inheritance Policies, Dual-Layer Draft-07 JSON Schema Compilation, Immutability Guards  
**Status:** Canonical Living Architecture Document  

---

## 1. Executive Summary & Problem Rationale

In enterprise SaaS platforms, entities are rarely 100% bespoke or 100% rigid. A real-world platform requires a **hybrid layered schema model**:
1. **Common System Schemas (`SYSTEM`)**: Universal business primitives (e.g. `User`, `CustomerAccount`, `AuditLog`, `CoreShipment`) defined and maintained centrally by Acc engineering.
2. **Tenant-Based Schemas (`tnt_...`)**: Completely bespoke, domain-specific models created from scratch by a tenant's admin (e.g. `DroneFlightPath`, `CustomLabTest`).
3. **Tenant-Extended Schemas (Overlay Inheritance)**: Standard system entities that a tenant customizes by attaching custom attributes without forking the base schema.

Without a formal model for **System Schemas vs. Tenant Schemas**, the platform suffers from:
* **The Blueprint Drift Problem**: Cloning templates into tenants forks schemas forever; platform updates cannot propagate to existing tenants without manual database scripts.
* **Accidental Mutation of Core Entities**: A tenant admin could accidentally delete a mandatory system column (like `user_email`), crashing core platform modules.
* **RLS Lockout**: Strict tenant RLS blocks tenants from reading system metadata.

---

## 2. The 3-Tier Layered Schema Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SCHEMA RESOLUTION & INHERITANCE HIERARCHY                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TIER 1: COMMON SYSTEM SCHEMAS (`tenant_id = 'SYSTEM'`)                                 │
│ • Universal platform baseline entities created by Acc migrations.                  │
│ • Examples: `ent_user`, `ent_customer_acc`, `ent_invoice`.                             │
│ • Read-accessible to ALL tenants; WRITE-RESTRICTED to Platform Super-Admin.            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TIER 2: TENANT OVERLAY EXTENSIONS (`entity_type_id = SYSTEM.id`, `tenant_id = 'tnt_X'`)│
│ • Custom attributes declared by Tenant X on top of a System Entity.                    │
│ • Example: Tenant X adds `custom_telematics_code` to `ent_vehicle`.                    │
│ • Isolated to Tenant X; invisible to all other tenants.                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TIER 3: PURE TENANT BESPOKE SCHEMAS (`tenant_id = 'tnt_X'`)                            │
│ • Entirely custom entity models created from scratch by Tenant X.                      │
│ • Examples: `ent_hazardous_waste_log`.                                                 │
│ • Full CRUD lifecycle owned exclusively by Tenant X.                                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema & RLS Policy Adjustments

To enable tenants to read common system schemas while strictly preventing cross-tenant leakage or unauthorized system mutations, PostgreSQL RLS policies and table constraints must support the `SYSTEM` tenant identifier.

### 3.1 PostgreSQL RLS Read-Inheritance Policy
In `UNIPOST_ENTITY_TYPES` and `UNIPOST_ATTRIBUTE_DEFINITIONS`:
* **READ (USING)**: Tenants can read rows belonging to **their own `tenant_id` OR `tenant_id = 'SYSTEM'`**.
* **WRITE (WITH CHECK)**: Tenants can **ONLY** insert, update, or delete rows belonging to **their own `tenant_id`**. Modifying `SYSTEM` rows requires `ROLE_PLATFORM_SUPERADMIN`.

```sql
-- Liquibase changeset update in changelog-000.000.00005.xml

-- 1. Entity Types RLS Policy
DROP POLICY IF EXISTS tenant_isolation_entity_types ON UNIPOST_ENTITY_TYPES;

CREATE POLICY tenant_isolation_entity_types ON UNIPOST_ENTITY_TYPES
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR tenant_id = 'SYSTEM'
    )
    WITH CHECK (
        -- Standard tenants can only write to their own tenant_id
        -- Platform superadmins can write to SYSTEM
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        AND tenant_id != 'SYSTEM'
    );

-- 2. Attribute Definitions RLS Policy
DROP POLICY IF EXISTS tenant_isolation_attribute_defs ON UNIPOST_ATTRIBUTE_DEFINITIONS;

CREATE POLICY tenant_isolation_attribute_defs ON UNIPOST_ATTRIBUTE_DEFINITIONS
    FOR ALL
    USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        OR tenant_id = 'SYSTEM'
    )
    WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        AND tenant_id != 'SYSTEM'
    );

-- 3. Data Plane (UNIPOST_ENTITIES) Remains 100% Isolated
-- System never stores operational tenant data records
DROP POLICY IF EXISTS tenant_isolation_entities ON UNIPOST_ENTITIES;

CREATE POLICY tenant_isolation_entities ON UNIPOST_ENTITIES
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
```

### 3.2 Scoped Partial Unique Constraints
```sql
-- Ensure system names don't conflict, allowing tenants to shadow or extend
CREATE UNIQUE INDEX uk_entity_type_tenant_sysname_active 
ON UNIPOST_ENTITY_TYPES (tenant_id, system_name) 
WHERE "deletedDate" IS NULL;

-- In Attribute Definitions, an attribute system_name must be unique within that entity type for that tenant
CREATE UNIQUE INDEX uk_attr_def_tenant_type_sysname_active 
ON UNIPOST_ATTRIBUTE_DEFINITIONS (tenant_id, entity_type_id, system_name) 
WHERE "deletedDate" IS NULL;
```

---

## 4. Runtime Schema Composition & Cache Resolution

When a tenant fetches the schema for an entity or performs record validation, the backend dynamically composites the effective Draft-07 JSON Schema:

$$\text{Effective Schema} = \text{BaseAttributes}(\text{tenant} = \text{'SYSTEM'}) \cup \text{OverlayAttributes}(\text{tenant} = \text{currentTenant})$$

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│ System Base Attributes          │       │ Tenant Custom Attributes        │
│ (`tenant_id = 'SYSTEM'`)        │       │ (`tenant_id = 'tnt_acme'`)      │
│ • legal_name (STRING, Required) │   +   │ • loyalty_tier (ENUM, Optional) │
│ • vat_id (STRING, Optional)     │       │ • internal_cost_center (STRING) │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 └────────────────────┬────────────────────┘
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │ Composite Draft-07 JSON Schema                  │
             │ Cache Key: `schema:tnt_acme:ent_customer:v4_s2` │
             └─────────────────────────────────────────────────┘
```

### 4.1 Schema Versioning in Composite Models
To ensure cache safety when either the System base schema OR the Tenant overlay changes:
$$\text{Composite Cache Key} = \text{"schema:"} + \text{tenantId} + \text{":"} + \text{systemName} + \text{":v"} + \text{tenantVer} + \text{"\_s"} + \text{systemVer}$$
* If Acc rolls out a global platform update incrementing `SYSTEM` version from `s1` $\to$ `s2`, all tenants' composite cache keys seamlessly transition to `s2` without manual cache purging.

### 4.2 System Immutability & Conflict Rules
1. **System Field Protection**: A tenant can **never** archive, delete, or rename an attribute where `tenant_id = 'SYSTEM'`.
2. **Name Collision Prevention**: A tenant cannot define a custom attribute with a `system_name` that conflicts with an existing System attribute on the same model.
3. **Soft Constraint Relaxation**: A tenant cannot make a mandatory system attribute optional, preserving platform code invariants.

---

## 5. Console UI Experience (`@acc/console`)

In `@acc/console`'s **Schema Builder**, system-defined attributes and tenant-custom attributes are visually distinct:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 🏢 Customer Account  (ent_customer_acc)   [System Base Model with Tenant Custom Fields] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔒 Legal Name (legal_name)          [STRING]  [Required]   [SYSTEM CORE FIELD]     │ │
│ │    ↳ Standard platform attribute. Cannot be deleted or renamed.                    │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔒 VAT Identification (vat_id)      [STRING]  [Optional]   [SYSTEM CORE FIELD]     │ │
│ │    ↳ Standard platform attribute. Cannot be deleted or renamed.                    │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ✏️  Loyalty Tier (loyalty_tier)      [ENUM]    [Optional]   [TENANT CUSTOM FIELD]   │ │
│ │    ↳ Custom field added by your organization. [Edit] [Archive] [Delete]             │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        │
│ [ + Add Custom Attribute ]       [ 👁️ View Composite JSON Schema ]                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

* **System Badges (🔒)**: Core attributes display a locked padlock and disabled delete controls.
* **Tenant Badges (✏️)**: Custom attributes display amber indicators with full edit/reorder/archive controls.
* **Universal Form Generation**: In the **Data Explorer** and `<RecordEditorDialog />`, both system and custom fields render together into a single seamless Liquid Glass form.

---

## 6. Summary of Architectural Advantages

| Metric | Pure Cloning / Forking (Old) | Hybrid System vs. Tenant Layering (Part 7) |
| :--- | :--- | :--- |
| **Platform Upgrades** | Broken: Updates require DDL scripts across every tenant. | Seamless: Updates to `SYSTEM` schemas instantly propagate to all tenants. |
| **System Integrity** | Fragile: Tenant admins can delete core platform fields. | Guaranteed: System attributes are immutable to tenant users. |
| **Tenant Customization** | Complete, but unmaintainable. | Complete and maintainable: Tenants extend models with custom overlays. |
| **Storage Efficiency** | Duplicates system schema rows $N$ times per tenant. | System attributes stored once in `SYSTEM`; only custom delta stored per tenant. |
