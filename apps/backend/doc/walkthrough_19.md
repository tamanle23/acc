# Walkthrough - Phase 4: Composite Cache Fabric & Dual-Layer Versioning

Implemented dual-layer schema versioning, composite cache keys (`schema:{tenant_id}:{entity_type_id}:v{tenantVer}_s{systemVer}`), effective schema composition, SYSTEM attribute immutability protection, and tenant-isolated L1/L2 cache invalidation.

## Changes

### 1. Events & Tenancy Context Propagation
- [`AttributeDefinitionUpdatedEvent.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/AttributeDefinitionUpdatedEvent.java): Added `tenantId` field and backward-compatible constructors to convey tenant identity across application events.

### 2. Composite Cache Fabric & Schema Compilation
- [`SchemaValidationService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/SchemaValidationService.java):
  - Formatted composite cache key as `schema:{tenant_id}:{entity_type_id}:v{tenantVer}_s1`.
  - Implemented `resolveEffectiveAttributes(tenantId, entityTypeId)`: fetches entity attributes and filters for either base `SYSTEM` attributes or tenant-specific custom attributes, guaranteeing no cross-tenant leakage.
  - Implemented `compileEffectiveSchema(tenantId, entityTypeId)`: compiles unified JSON Schema containing base platform attributes plus tenant overlay attributes.
  - Implemented tenant-aware `invalidateL1Cache(entityTypeId, tenantId)` preventing cross-tenant cache purges.

### 3. Distributed Cache Eviction
- [`MetadataCacheListener.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataCacheListener.java):
  - Listens for `AttributeDefinitionUpdatedEvent` and evicts L1 in-memory cache and L2 Hazelcast distributed map entries scoped strictly to the target tenant prefix (`schema:{tenantId}:`).

### 4. SYSTEM Schema Immutability & Collision Guards
- [`MetadataService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java):
  - Guarded `updateAttributeDefinition`, `deleteAttributeDefinition`, and `archiveAttributeDefinition` with immutability checks throwing `MetadataConflictException` if `tenant_id = 'SYSTEM'`.
  - Stamped active `TenantContextHolder.getTenantId()` on newly created attribute definitions.
  - Guarded `createAttributeDefinition` against system name collisions with existing attributes (both base `SYSTEM` and tenant-scoped).
  - Emits `AttributeDefinitionUpdatedEvent` carrying active tenant ID.
- [`MetadataConflictException.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/exception/MetadataConflictException.java): Ensured `super(message)` is called so `getMessage()` returns the descriptive error message.

## Verification Results

### Automated Tests
- Executed `CompositeCacheFabricTest` and `SchemaValidationServiceTest`:
  - `testEffectiveSchemaComposition`: PASS (merges SYSTEM + tenant attributes, enforces required fields, writes composite key `schema:tenant-alpha:100:v2_s1`).
  - `testTenantCacheIsolationOnInvalidation`: PASS (tenant alpha invalidation evicts only alpha keys; beta keys preserved untouched).
  - `testSystemAttributeCollisionCheck`: PASS (rejects tenant custom attributes conflicting with base SYSTEM names).
  - `testSystemAttributeImmutability`: PASS (rejects update, delete, and archive on `SYSTEM` attributes).
  - Reactor build: 10/10 modules compiled and tested cleanly (`BUILD SUCCESS`).
