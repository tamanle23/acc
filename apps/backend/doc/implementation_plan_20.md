# Implementation Plan - Phase 6: Tenant Onboarding & Blueprint Catalog Seeding

## Overview
Implement the Tenant Onboarding & Blueprint Catalog Seeding framework in `@acc/backend` (`apps/backend/acc-fw`), allowing new tenant workspaces to be instantly initialized from pre-modeled domain blueprints (Logistics Fleet, B2B CRM, Blank Workspace) in $< 250\text{ ms}$, deep-cloning entity types, attributes, and relationships stamped with the new `tenant_id` and pre-warming Hazelcast/L1 schema caches with zero blueprint coupling.

## User Review Required

> [!IMPORTANT]
> - Domain blueprints are declarative JSON template files loaded from classpath `metadata/blueprints/`.
> - Cloned entity types, attribute definitions, and relationship types are fully stamped with `tenant_id = :targetTenantId`.
> - Blueprint linkage is severed upon provisioning ("Decoupled Evolution"): tenants retain 100% ownership to customize, extend, or delete schemas.
> - Schemas are pre-warmed directly into the Hazelcast distributed cache and L1 memory via `SchemaValidationService.getOrCompileJsonSchema(tenantId, entityTypeId, schemaVersion)`.

## Proposed Changes

### 1. Blueprint Manifest JSONs (`apps/backend/acc-fw/src/main/resources/metadata/blueprints/`)
- `logistics-fleet-blueprint.json`:
  - `ent_vehicle` (Vehicle): license_plate, vehicle_type, max_payload_kg, status.
  - `ent_dispatch_order` (Dispatch Order): tracking_number, delivery_status, destination_address.
  - Relationship `rel_vehicle_assigned_order` (Dispatch Order -> Vehicle, MANY_TO_ONE).
- `b2b-crm-billing-blueprint.json`:
  - `ent_customer_acc` (Customer Account): company_name, tax_id, tier, billing_email.
  - `ent_invoice` (Invoice): invoice_number, total_amount, currency, due_date, status.
  - Relationship `rel_customer_invoice` (Invoice -> Customer Account, MANY_TO_ONE).
- `blank-workspace-blueprint.json`:
  - Minimal/empty canvas template.

### 2. Blueprint DTOs & Loader (`apps/backend/acc-fw/src/main/java/com/acc/tenant/blueprint/`)
- `BlueprintManifest.java`, `BlueprintEntityType.java`, `BlueprintAttribute.java`, `BlueprintRelationship.java`.
- `BlueprintCatalogService.java`:
  - Scans and caches blueprint templates from `classpath:metadata/blueprints/*.json`.
  - Exposes `List<BlueprintSummaryDto> getAvailableBlueprints()` and `BlueprintManifest getBlueprint(String blueprintId)`.

### 3. Tenant Provisioning Service & Controller (`com.acc.tenant.service`, `com.acc.presentation`)
- `TenantProvisioningRequest.java`:
  - `tenantId`: slug / identifier (e.g. `tnt_fleet_express`).
  - `tenantName`: organization display name.
  - `blueprintId`: template ID (e.g. `bp_logistics_v1`, `bp_crm_billing_v1`, `bp_blank_v1`).
- `TenantProvisioningResult.java`:
  - `tenantId`, `blueprintId`, `createdEntityTypesCount`, `createdAttributesCount`, `createdRelationshipsCount`, `executionTimeMs`.
- `TenantProvisioningService.java`:
  - Runs in `@Transactional` boundary.
  - Temporarily sets or binds `tenantId` in `TenantContextHolder` so all queries and audits stamp accurately.
  - Loads blueprint manifest.
  - Deep-clones each `EntityType` stamped with `tenant_id = targetTenantId` and `schemaVersion = 1L`.
  - Deep-clones each `AttributeDefinition` stamped with `tenant_id = targetTenantId`.
  - Deep-clones each `RelationshipType` connecting source and target entity types.
  - Calls `schemaValidationService.getOrCompileJsonSchema(tenantId, entityTypeId, 1L)` to pre-warm cache.
  - Returns structured `TenantProvisioningResult`.
- `TenantProvisioningController.java`:
  - `GET /api/v1/metadata/blueprints`: returns catalog of available blueprints.
  - `POST /api/v1/metadata/tenants/provision`: provisions new tenant workspace from blueprint.
  - Guarded by `@PreAuthorize("hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")`.

## Verification Plan

### Automated Tests
- Create `TenantProvisioningIntegrationTest.java`:
  1. Provision a tenant `tenant-logistics-test` with `bp_logistics_v1`:
     - Assert $< 250\text{ ms}$ execution time.
     - Verify entity types `ent_vehicle` and `ent_dispatch_order` are created with `tenant_id = 'tenant-logistics-test'`.
     - Verify attributes have `tenant_id = 'tenant-logistics-test'` and are properly ordered.
     - Verify relationship type `rel_vehicle_assigned_order` is created and links the cloned entity types.
     - Verify Hazelcast / L1 cache is pre-warmed for both entities (`schema:tenant-logistics-test:{id}:v1_s1`).
  2. Verify Blueprint Decoupled Evolution:
     - Mutate an attribute on `tenant-logistics-test` (rename or add custom attribute).
     - Assert blueprint manifest in memory remains completely unaffected.
  3. Provision another tenant `tenant-crm-test` with `bp_crm_billing_v1`:
     - Assert independent entities and isolated cache keys without cross-contamination.

### Build Verification
- Run `.\mvnw test -Dtest=TenantProvisioningIntegrationTest,CompositeCacheFabricTest,SchemaValidationServiceTest -Dsurefire.failIfNoSpecifiedTests=false`.
- Run full reactor build `.\mvnw test-compile -DskipTests`.
