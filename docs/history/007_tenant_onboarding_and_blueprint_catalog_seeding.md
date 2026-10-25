# 007. Phase 6: Tenant Onboarding & Blueprint Catalog Seeding

**Date:** 2026-10-09  
**Status:** Completed  
**Scope:** `@acc/backend` (`apps/backend/acc-fw`)

## 1. Problem Statement
When new tenant organizations onboard to the Unipost platform, configuring entity schemas, field attributes, UI components, and relationship graphs manually from scratch is high-friction and error-prone. Tenants need pre-modeled, production-ready industry blueprints (such as Logistics & Fleet Management, B2B CRM & Invoicing, or Blank Workspace) that can be seeded atomically in $< 250\text{ ms}$, deep-cloning all metadata stamped with the target tenant ID, pre-warming Hazelcast/L1 schema caches, and ensuring decoupled schema evolution (zero runtime linkage back to template files).

## 2. Plan & Architecture Decisions
- Create declarative domain blueprint manifests in JSON format within `classpath:metadata/blueprints/`.
- Build dynamic `BlueprintCatalogService` utilizing Spring's `PathMatchingResourcePatternResolver` to discover, parse, and catalog blueprints on startup.
- Implement atomic `TenantProvisioningService` running in a `@Transactional` boundary:
  - Validates requested blueprint and checks for entity system name collisions in target tenant.
  - Temporarily sets `TenantContextHolder.setTenantId(targetTenantId)` ensuring proper tenancy auditing.
  - Deep-clones `EntityType`, `AttributeDefinition`, and `RelationshipType` stamped with `tenant_id = targetTenantId` and `schema_version = 1L`.
  - Performs synchronous pre-warming of Draft-07 compiled JSON Schemas into Hazelcast and L1 memory via `SchemaValidationService.getOrCompileJsonSchema(tenantId, entityTypeId, 1L)`.
- Expose REST controller endpoints: `GET /api/v1/metadata/blueprints` and `POST /api/v1/metadata/tenants/provision` guarded by security authorities.
- Build comprehensive unit test suite to verify atomic cloning, tenant stamping, edge wiring, cache pre-warming, and decoupled schema evolution.

## 3. Changes
- **Blueprint JSON Manifests:**
  - `apps/backend/acc-fw/src/main/resources/metadata/blueprints/logistics-fleet-blueprint.json`: models Fleet Vehicles, Dispatch Orders, and vehicle assignment edges.
  - `apps/backend/acc-fw/src/main/resources/metadata/blueprints/b2b-crm-billing-blueprint.json`: models Customer Accounts, Invoices, and customer billing edges.
  - `apps/backend/acc-fw/src/main/resources/metadata/blueprints/blank-workspace-blueprint.json`: clean canvas workspace template.
- **Blueprint DTOs & Catalog Loader:**
  - `com.acc.tenant.blueprint.BlueprintManifest`: record mapping blueprint schema.
  - `com.acc.tenant.blueprint.BlueprintSummaryDto`: lightweight projection for catalog listing.
  - `com.acc.tenant.blueprint.BlueprintCatalogService`: scans `classpath:metadata/blueprints/*.json` and maintains in-memory catalog.
- **Tenant Provisioning DTOs & Service:**
  - `com.acc.tenant.dto.TenantProvisioningRequest`: validation annotations for `tenantId`, `tenantName`, `blueprintId`.
  - `com.acc.tenant.dto.TenantProvisioningResult`: execution statistics and created entity names.
  - `com.acc.tenant.service.TenantProvisioningService`: deep-cloning pipeline, tenant context stamping, relationship wiring, and cache pre-warming.
- **REST Presentation:**
  - `com.acc.presentation.TenantProvisioningController`: exposed `/api/v1/metadata/blueprints` and `/api/v1/metadata/tenants/provision`.
- **Testing:**
  - `com.acc.tenant.service.TenantProvisioningServiceTest`: verified blueprint onboarding, empty template, collision rejection, and schema pre-warming.

## 4. Verification
- `TenantProvisioningServiceTest`: 4/4 tests passed.
- `CompositeCacheFabricTest` and `SchemaValidationServiceTest`: all passed.
- Full Maven reactor build: 10/10 modules compiled and passed with 0 errors (`BUILD SUCCESS`).
