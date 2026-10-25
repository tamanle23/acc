# Walkthrough - Phase 6: Tenant Onboarding & Blueprint Catalog Seeding

Implemented domain blueprint manifests, dynamic catalog service, atomic tenant provisioning pipeline with deep-cloning, distributed cache pre-warming, and decoupled schema evolution.

## Changes

### 1. Blueprint Manifests (`metadata/blueprints/`)
- [`logistics-fleet-blueprint.json`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/resources/metadata/blueprints/logistics-fleet-blueprint.json):
  - Models `ent_vehicle` (Fleet Vehicle) and `ent_dispatch_order` (Dispatch Order).
  - 7 attributes with types `STRING`, `INTEGER`, `BOOLEAN`, ui-components `text`, `select`, `number`, `switch`, `textarea`.
  - Relationship `rel_vehicle_assigned_order` (`Dispatch Order` -> `Fleet Vehicle`, `MANY_TO_ONE`).
- [`b2b-crm-billing-blueprint.json`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/resources/metadata/blueprints/b2b-crm-billing-blueprint.json):
  - Models `ent_customer_acc` (Customer Account) and `ent_invoice` (Sales Invoice).
  - 8 attributes for billing accounts and invoices.
  - Relationship `rel_customer_invoice` (`Sales Invoice` -> `Customer Account`, `MANY_TO_ONE`).
- [`blank-workspace-blueprint.json`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/resources/metadata/blueprints/blank-workspace-blueprint.json):
  - Clean canvas workspace template with zero default entities.

### 2. DTOs and Blueprint Catalog Service
- [`BlueprintManifest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/tenant/blueprint/BlueprintManifest.java): Record representation mapping blueprint JSON format.
- [`BlueprintSummaryDto.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/tenant/blueprint/BlueprintSummaryDto.java): Lightweight catalog projection.
- [`BlueprintCatalogService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/tenant/blueprint/BlueprintCatalogService.java): Dynamically scans `classpath:metadata/blueprints/*.json` at startup via `PathMatchingResourcePatternResolver`.
- [`TenantProvisioningRequest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/tenant/dto/TenantProvisioningRequest.java): Validates tenant ID format, name, and blueprint ID.
- [`TenantProvisioningResult.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/tenant/dto/TenantProvisioningResult.java): Returns provisioning statistics and created entities.

### 3. Tenant Provisioning Service & Controller
- [`TenantProvisioningService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/tenant/service/TenantProvisioningService.java):
  - Executes in an atomic `@Transactional` boundary.
  - Stamps all cloned `EntityType`, `AttributeDefinition`, and `RelationshipType` records with `tenant_id = :targetTenantId`.
  - Enforces decoupled schema evolution: provisioned models have no runtime dependency on blueprints.
  - Pre-warms Hazelcast distributed map and in-memory L1 cache using `schemaValidationService.getOrCompileJsonSchema(tenantId, entityTypeId, 1L)`.
- [`TenantProvisioningController.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/TenantProvisioningController.java):
  - Exposes `GET /api/v1/metadata/blueprints` and `POST /api/v1/metadata/tenants/provision`.

## Verification Results

### Automated Tests
- Executed `TenantProvisioningServiceTest`, `CompositeCacheFabricTest`, and `SchemaValidationServiceTest`:
  - `provisionLogisticsFleetSuccessfully`: PASS (creates 2 entity types, 7 attributes, 1 relationship, stamps tenant ID, and pre-warms cache).
  - `provisionBlankWorkspaceSuccessfully`: PASS (provisions empty workspace without entities or errors).
  - `throwExceptionForUnknownBlueprint`: PASS (throws `MetadataNotFoundException`).
  - `throwExceptionForDuplicateEntityInTenant`: PASS (throws `MetadataConflictException` on collision).
  - Full Maven Reactor Build: all 10 modules compiled and passed with 0 errors (`BUILD SUCCESS`).
