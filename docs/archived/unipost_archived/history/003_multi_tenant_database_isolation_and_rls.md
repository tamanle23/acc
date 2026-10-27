# 003: Multi-Tenant Database Isolation, Tenant-Scoped Uniqueness & Row-Level Security (Phase 2)

**Date:** 2026-10-09  
**Type:** feat  
**Scope:** backend, db, rls  

## Problem
In the dynamic metadata engine, entity types and attribute definitions lacked tenant scoping and relied on global unique constraints, preventing distinct tenants from creating models with the same slug. Furthermore, database-level multi-tenant isolation relied solely on application query predicates without row-level database safeguards.

## Plan
1. Create Liquibase changelog `changelog-000.000.00005.xml` and include in `changelog-master.xml`.
2. Denormalize `tenant_id` onto `UNIPOST_ENTITY_TYPES`, `UNIPOST_ATTRIBUTE_DEFINITIONS`, `UNIPOST_RELATIONSHIP_TYPES`, `UNIPOST_ENTITY_RELATIONSHIPS`.
3. Drop global unique indexes and replace with tenant-partitioned soft-delete unique indexes.
4. Enable and force PostgreSQL Row-Level Security (RLS) policies with `SYSTEM` schema read-inheritance.
5. Update JPA entity models (`EntityType`, `AttributeDefinition`, `RelationshipType`, `EntityRelationship`, `EntityRecord`) to map `tenantId`.
6. Implement `TenantContextHolder` and `TenantSessionAspect` executing `SET LOCAL app.current_tenant_id = :tenantId`.
7. Add automated tests and verify build.

## Changes
- **Database (`apps/backend/acc-db`)**:
  - `src/main/resources/db/acc/changelog-000.000.00005.xml`: Added DDL for tenant columns, soft-delete composite partial indexes, and PostgreSQL RLS policies (`FORCE ROW LEVEL SECURITY`).
  - `src/main/resources/db/acc/changelog-master.xml`: Included changelog 00005.
- **Entities (`apps/backend/acc-fw`)**:
  - `com.acc.domain.metadata.EntityType`: Added `tenantId` mapping.
  - `com.acc.domain.metadata.AttributeDefinition`: Added `tenantId` mapping.
  - `com.acc.domain.metadata.RelationshipType`: Added `tenantId` mapping.
  - `com.acc.domain.metadata.EntityRelationship`: Added `tenantId` mapping.
  - `com.acc.domain.metadata.EntityRecord`: Added non-null default for `tenantId`.
- **Tenancy Framework (`apps/backend/acc-fw`)**:
  - `com.acc.fw.tenancy.TenantContextHolder`: Thread-local context manager.
  - `com.acc.fw.tenancy.TenantSessionAspect`: Spring AOP Aspect executing `SET LOCAL app.current_tenant_id`.
  - `com.acc.fw.tenancy.TenantContextAndAspectTest`: Unit tests for tenant context and aspect.

## Verification
- `.\mvnw test-compile` across all 10 modules: **BUILD SUCCESS**.
- `.\mvnw test -Dtest=TenantContextAndAspectTest`: 4 tests passed, 0 failures.
