# Implementation Plan - Phase 4: Composite Cache Fabric & Dual-Layer Versioning

## 1. Context & Motivation
In Phase 4 of the Multi-Tenant Master Plan, we establish multi-tenant cache isolation and dynamic schema composition:
1. **Multi-Tenant Composite Cache Keys**:
   - `schema:{tenant_id}:{entity_type_id_or_slug}:v{tenantVer}_s{systemVer}`
   - Guarantees that schema mutations by Tenant A never invalidate, stampede, or corrupt Tenant B's compiled Draft-07 JSON Schema caches.
2. **Dynamic Effective Schema Composition**:
   - When resolving the schema for an entity, composite System Base Attributes (`tenant_id = 'SYSTEM'`) with Tenant Custom Overlay Attributes (`tenant_id = activeTenant`).
   - Tenant attributes take precedence or augment system attributes.
3. **Atomic Schema Version Increments**:
   - Every attribute definition mutation (`create`, `update`, `reorder`, `archive`, `unarchive`, `delete`) increments `UNIPOST_ENTITY_TYPES.schema_version` within the same transaction.
4. **System Field Immutability Protection**:
   - Non-superadmin tenants cannot archive, delete, or modify attributes owned by `tenant_id = 'SYSTEM'`.
   - Prevent tenants from registering custom attributes with `system_name` matching existing system attributes.
5. **Multi-Tenant Invalidation**:
   - Update `MetadataCacheListener` to invalidate composite cache keys partitioned by `tenant_id`.

## 2. Proposed Changes

### 1. `SchemaValidationService` Updates (`apps/backend/acc-fw`)
- Update `buildCacheKey(String tenantId, Long entityTypeId, Long tenantSchemaVersion, Long systemSchemaVersion)`:
  - Generates format `schema:{tenantId}:{entityTypeId}:v{tenantVer}_s{systemVer}`.
- Update `getOrCompileJsonSchema`:
  - Determines active `tenantId` (from `TenantContextHolder.getTenantId()`, defaulting to `"default-tenant"`).
  - Fetches attributes combining `SYSTEM` and `tenantId` attributes.
  - Compiles and caches using composite key.
- Update `invalidateL1Cache`:
  - Support scoped eviction by `(tenantId, entityTypeId)` or clear all.

### 2. `MetadataService` Immutability & Composition (`apps/backend/acc-fw`)
- Guard `updateAttributeDefinition`, `deleteAttributeDefinition`, `archiveAttributeDefinition`:
  - If target attribute has `tenant_id = 'SYSTEM'`, throw `MetadataConflictException("System attributes are immutable and cannot be modified or deleted by tenant admins")`.
- Guard `createAttributeDefinition`:
  - Check if `system_name` conflicts with any active `SYSTEM` attribute on the entity type.
  - Stamp new attributes with `TenantContextHolder.getTenantId()`.
- Update `getAttributeDefinitions`:
  - Return composite list of `SYSTEM` base attributes + current tenant's attributes ordered by `displayOrder`.

### 3. `MetadataCacheListener` Eviction (`apps/backend/acc-fw`)
- Evict keys matching `schema:{tenantId}:{entityTypeId}:*` in Hazelcast and L1 parsed schema cache.

### 4. Verification & Testing
- Unit test `CompositeCacheFabricTest`:
  - Verifies composite key format `schema:{tenantId}:{type}:v{tenantVer}_s{systemVer}`.
  - Verifies Tenant A and Tenant B maintain independent cache entries.
  - Verifies effective schema composition (SYSTEM base + Tenant overlay).
  - Verifies SYSTEM field immutability guard.
- Run `.\mvnw test-compile` and full test suite.
