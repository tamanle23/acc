# Implementation Plan - Phase 2: Database Isolation, System vs. Tenant Schemas & Row-Level Security

## 1. Context & Motivation
In Phase 2 of the Multi-Tenant Master Plan, we establish true multi-tenant database isolation, PostgreSQL Row-Level Security (RLS), and tenant-aware metadata plane models.
Previously, only `UNIPOST_ENTITIES` carried a `tenant_id` column, while metadata entities (`UNIPOST_ENTITY_TYPES`, `UNIPOST_ATTRIBUTE_DEFINITIONS`, `UNIPOST_RELATIONSHIP_TYPES`, `UNIPOST_ENTITY_RELATIONSHIPS`) lacked `tenant_id` and used global uniqueness constraints.
This plan implements:
1. Liquibase migration `changelog-000.000.00005.xml` with denormalized `tenant_id`, tenant-scoped partial unique indexes, performance indexes, and PostgreSQL Row-Level Security policies.
2. Tenant schema inheritance allowing all tenants to read system schemas (`tenant_id = 'SYSTEM'`), while isolating custom tenant schemas and records.
3. JPA Entity updates for `EntityType`, `AttributeDefinition`, `RelationshipType`, and `EntityRelationship` to map `tenantId`.
4. Tenant context management (`TenantContextHolder`) and session-binding aspect (`TenantSessionAspect`) executing `SET LOCAL app.current_tenant_id = :tenantId`.
5. Unit and repository tests to verify multi-tenant isolation and RLS behaviors.

## 2. Proposed Changes

### Database Layer (`apps/backend/acc-db`)
- Create `src/main/resources/db/acc/changelog-000.000.00005.xml`:
  - Add `tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant'` to:
    - `UNIPOST_ENTITY_TYPES`
    - `UNIPOST_ATTRIBUTE_DEFINITIONS`
    - `UNIPOST_RELATIONSHIP_TYPES`
    - `UNIPOST_ENTITY_RELATIONSHIPS`
  - Drop global unique indexes/constraints:
    - `uk_entity_type_sysname_active`
    - `uk_attr_def_type_sysname_active`
    - `uk_rel_type_sysname_active`
  - Create tenant-scoped partial unique indexes:
    - `uk_entity_type_tenant_sysname_active ON UNIPOST_ENTITY_TYPES (tenant_id, system_name) WHERE "deletedDate" IS NULL`
    - `uk_attr_def_tenant_type_sysname_active ON UNIPOST_ATTRIBUTE_DEFINITIONS (tenant_id, entity_type_id, system_name) WHERE "deletedDate" IS NULL`
    - `uk_rel_type_tenant_sysname_active ON UNIPOST_RELATIONSHIP_TYPES (tenant_id, system_name) WHERE "deletedDate" IS NULL`
  - Create composite indexes for high-throughput queries:
    - `idx_entities_tenant_type_active ON UNIPOST_ENTITIES (tenant_id, entity_type_id) WHERE "deletedDate" IS NULL`
    - `idx_entity_rels_tenant_source_active ON UNIPOST_ENTITY_RELATIONSHIPS (tenant_id, source_entity_id) WHERE "deletedDate" IS NULL`
    - `idx_entity_rels_tenant_target_active ON UNIPOST_ENTITY_RELATIONSHIPS (tenant_id, target_entity_id) WHERE "deletedDate" IS NULL`
  - Enable and force RLS on all 5 tables:
    - `FORCE ROW LEVEL SECURITY`
    - Policies on metadata tables (`ENTITY_TYPES`, `ATTRIBUTE_DEFINITIONS`, `RELATIONSHIP_TYPES`):
      `USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '') OR tenant_id = 'SYSTEM') WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '') AND tenant_id != 'SYSTEM')`
    - Policies on record/edge tables (`ENTITIES`, `ENTITY_RELATIONSHIPS`):
      `USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))`
- Update `src/main/resources/db/acc/changelog-master.xml` to include `changelog-000.000.00005.xml`.

### Domain Model Layer (`apps/backend/acc-fw`)
- Update `EntityType.java`: add `tenantId` field (`@Column(name = "tenant_id", nullable = false)`).
- Update `AttributeDefinition.java`: add `tenantId` field (`@Column(name = "tenant_id", nullable = false)`).
- Update `RelationshipType.java`: add `tenantId` field (`@Column(name = "tenant_id", nullable = false)`).
- Update `EntityRelationship.java`: add `tenantId` field (`@Column(name = "tenant_id", nullable = false)`).
- Ensure `EntityRecord.java` has standard defaults for `tenantId`.

### Tenancy Framework Layer (`apps/backend/acc-fw`)
- Create `com.acc.fw.tenancy.TenantContextHolder`:
  - `ThreadLocal<String>` store for current tenant.
  - Safe methods: `setTenantId(String)`, `getTenantId()`, `clear()`.
- Create `com.acc.fw.tenancy.TenantSessionAspect`:
  - Intercept `@Transactional` methods to set PostgreSQL session setting `SET LOCAL app.current_tenant_id = :tenantId`.
  - Defensive SQL escaping to prevent SQL injection in session setting.

### Verification & Testing
- Add unit tests for `TenantContextHolder` and `TenantSessionAspect`.
- Verify compilation and existing tests with `.\mvnw test-compile` and relevant unit tests.
