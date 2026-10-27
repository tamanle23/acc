# 005. Phase 4: Composite Cache Fabric & Dual-Layer Versioning

**Date:** 2026-10-09  
**Status:** Completed  
**Scope:** `@acc/backend` (`apps/backend/acc-fw`)

## 1. Problem Statement
In a multi-tenant dynamic metadata architecture, tenants share base system entity definitions (e.g., standard customer, order, or invoice attributes) while defining proprietary custom fields. Without tenant-isolated composite caching and dual-layer schema versioning:
1. Cache keys collision could lead to cross-tenant data corruption or attribute leakage.
2. Tenant schema mutations would either blow away the global cache (causing distributed thundering herds) or fail to invalidate their own cached schemas.
3. Tenants could potentially mutate or delete base platform attributes (`SYSTEM`), breaking core workflows.

## 2. Plan & Architecture Decisions
- Formulate composite cache keys: `schema:{tenant_id}:{entity_type_id}:v{tenantVer}_s{systemVer}`.
- Resolve effective schemas on cache miss by dynamically composing base `SYSTEM` attributes (`tenant_id = 'SYSTEM'`) with tenant overlay attributes (`tenant_id = currentTenant`).
- System Field Immutability: strictly forbid update, delete, or archive operations on attributes marked with `SYSTEM` tenant ID.
- Partitioned Cache Eviction: evict L1 and Hazelcast L2 cache entries strictly by tenant prefix without wiping other tenants' cached compilation graphs.

## 3. Changes
- **Event Bus:**
  - `AttributeDefinitionUpdatedEvent.java`: enriched event payload with `tenantId`.
- **Cache & Compilation:**
  - `SchemaValidationService.java`:
    - Implemented composite cache key generator `buildCacheKey(tenantId, entityTypeId, schemaVersion)`.
    - Added `resolveEffectiveAttributes(tenantId, entityTypeId)` and `compileEffectiveSchema(tenantId, entityTypeId)`.
    - Added tenant-partitioned `invalidateL1Cache(entityTypeId, tenantId)`.
  - `MetadataCacheListener.java`:
    - Scoped Hazelcast map key iteration and eviction to target tenant prefix.
- **Service Guards:**
  - `MetadataService.java`:
    - Enforced immutability on `updateAttributeDefinition`, `deleteAttributeDefinition`, and `archiveAttributeDefinition` for `SYSTEM` attributes.
    - Added collision detection in `createAttributeDefinition` against base `SYSTEM` attributes.
    - Published `AttributeDefinitionUpdatedEvent` with active tenant ID.
  - `MetadataConflictException.java`: fixed `getMessage()` delegation to `super(message)`.
- **Testing:**
  - `SchemaValidationServiceTest.java`: updated test cases to match composite cache keys.
  - `CompositeCacheFabricTest.java`: dedicated test suite verifying composite keys, effective composition, tenant cache isolation, and SYSTEM immutability guards.

## 4. Verification
- `.\mvnw test "-Dtest=CompositeCacheFabricTest,SchemaValidationServiceTest" "-Dsurefire.failIfNoSpecifiedTests=false"`: PASSED.
- Full reactor check `.\mvnw test-compile -DskipTests`: PASSED across all 10 modules.
