# Walkthrough - Phase 2: Database Isolation, System vs. Tenant Schemas & Row-Level Security

## 1. Overview
In Phase 2 of the Multi-Tenant Master Plan, we implemented pure multi-tenant database isolation, PostgreSQL Row-Level Security (RLS), and Spring Modulith session-binding interceptors.
Metadata tables (`UNIPOST_ENTITY_TYPES`, `UNIPOST_ATTRIBUTE_DEFINITIONS`, `UNIPOST_RELATIONSHIP_TYPES`, `UNIPOST_ENTITY_RELATIONSHIPS`) now possess tenant scoping alongside the record data plane (`UNIPOST_ENTITIES`).

## 2. Key Changes Implemented

### Database Migration (`apps/backend/acc-db`)
- Created `changelog-000.000.00005.xml` and registered in `changelog-master.xml`.
- **Column Denormalization**: Added `tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant'` to:
  - `UNIPOST_ENTITY_TYPES`
  - `UNIPOST_ATTRIBUTE_DEFINITIONS`
  - `UNIPOST_RELATIONSHIP_TYPES`
  - `UNIPOST_ENTITY_RELATIONSHIPS`
- **Tenant-Scoped Partial Uniqueness**:
  - Dropped global unique indexes (`uk_entity_type_sysname_active`, `uk_attr_def_type_sysname_active`, `uk_rel_type_sysname_active`).
  - Added tenant-partitioned soft-delete unique indexes:
    - `uk_entity_type_tenant_sysname_active ON UNIPOST_ENTITY_TYPES (tenant_id, system_name) WHERE "deletedDate" IS NULL`
    - `uk_attr_def_tenant_type_sysname_active ON UNIPOST_ATTRIBUTE_DEFINITIONS (tenant_id, entity_type_id, system_name) WHERE "deletedDate" IS NULL`
    - `uk_rel_type_tenant_sysname_active ON UNIPOST_RELATIONSHIP_TYPES (tenant_id, system_name) WHERE "deletedDate" IS NULL`
- **Composite Indexes**: Added indexes on `(tenant_id, entity_type_id)`, `(tenant_id, source_entity_id)`, `(tenant_id, target_entity_id)` for high performance under heavy multi-tenant concurrency.
- **PostgreSQL Row-Level Security (RLS)**:
  - Enabled and forced (`FORCE ROW LEVEL SECURITY`) across all 5 metadata and data tables.
  - Applied `SYSTEM` schema read-inheritance on metadata tables (`USING (tenant_id = :ctx OR tenant_id = 'SYSTEM') WITH CHECK (tenant_id = :ctx AND tenant_id != 'SYSTEM')`).
  - Applied strict tenant isolation on `UNIPOST_ENTITIES` and `UNIPOST_ENTITY_RELATIONSHIPS`.

### JPA Domain Entities (`apps/backend/acc-fw`)
- Added `tenantId` field (`@Column(name = "tenant_id", nullable = false)`) with default `"default-tenant"` to:
  - `EntityType.java`
  - `AttributeDefinition.java`
  - `RelationshipType.java`
  - `EntityRelationship.java`
  - `EntityRecord.java`

### Tenancy Session Framework (`apps/backend/acc-fw`)
- `TenantContextHolder`: Thread-local storage for current tenant ID.
- `TenantSessionAspect`: Spring AOP Aspect around `@Transactional` methods executing `SET LOCAL app.current_tenant_id = '<tenant_id>'` with input slug sanitization to guard against SQL injection.

## 3. Verification & Results
- Executed `.\mvnw test-compile` across all 10 modules: **BUILD SUCCESS**.
- Executed `TenantContextAndAspectTest` covering:
  - Context holder state storage and thread isolation.
  - Setting PostgreSQL session setting `SET LOCAL app.current_tenant_id`.
  - No-op behavior when context is null/blank.
  - Rejection of malformed or SQL-injected tenant identifiers.
  - Results: **4 tests run, 0 failures, 0 errors**.
