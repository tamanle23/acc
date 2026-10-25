# Part 5: Tenant Provisioning, Onboarding & Dynamic Schema Catalog

**Series:** Multi-Tenant Architecture Blueprint Series (Document 05 of N)  
**Document Level:** Platform Engineering & System Integration Specification  
**Target Systems:** `@acc/backend` (Spring Modulith / Java 21), `@acc/console` (React 19 / Vite 8)  
**Scope:** Automated Tenant Creation, Global Blueprint Catalog, Schema Cloning & Seeding, Isolated Tenant Workspaces  
**Status:** Canonical Living Architecture Document  

---

## 1. Executive Summary & Problem Context

When a new organization or solo operator signs up for the Unipost platform, greeting them with an empty database ("the blank canvas problem") leads to high drop-off and slow time-to-value. Conversely, hardcoding industry-specific schemas directly into application code destroys the extensibility of our dynamic metadata engine.

To solve this, **Part 5** establishes the **Tenant Provisioning Pipeline & Global Blueprint Catalog**:
1. **Global Blueprint Catalog**: A versioned, system-level repository of pre-modeled domain templates (e.g., *Logistics & Fleet Dispatch*, *Customer CRM & B2B Billing*, *IT Infrastructure & Assets*).
2. **Atomic Schema Seeding**: During tenant onboarding, selected blueprints are cloned and stamped with the new `tenant_id` inside `UNIPOST_ENTITY_TYPES` and `UNIPOST_ATTRIBUTE_DEFINITIONS`.
3. **Instant Operational Readiness**: The new tenant immediately possesses a working application with forms, data grids, and Draft-07 JSON Schema validation, while retaining full autonomy to customize fields later.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               TENANT ONBOARDING PIPELINE                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Registration / Invite -> Create Tenant & Super-Admin User                           │
│ 2. Catalog Selection     -> Select Starter Blueprint (e.g. "Fleet Logistics")          │
│ 3. Atomic Seeding        -> Deep-clone Blueprint Entity Types, Attributes, & Edges     │
│ 4. Cache Pre-warming     -> Compile Draft-07 JSON Schemas into Hazelcast cache         │
│ 5. Workspace Ready       -> Redirect to Console Data Explorer with instant mock/data   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Blueprint Catalog vs. Common System Schemas
*(Cross-Reference: Document 07)*

It is critical to distinguish between **Common System Schemas** and **Onboarding Blueprints**:
* **Common System Schemas (`tenant_id = 'SYSTEM'`)**: Universal platform core entities (`User`, `CustomerAccount`, `Invoice`). These are **never cloned**. Tenants inherit them read-only and attach custom overlay attributes to them.
* **Domain Starter Blueprints (`bp_...`)**: Optional, vertical-specific starter packages (e.g. *Fleet Logistics*, *Hazardous Waste Tracking*). These are **deep-cloned** into the tenant's scope (`tenant_id = newTenantId`), giving the tenant 100% ownership to evolve them as pure bespoke models.

```
apps/backend/acc-fw/src/main/resources/metadata/blueprints/
├── logistics-fleet-blueprint.json
├── b2b-crm-billing-blueprint.json
├── it-asset-management-blueprint.json
└── blank-workspace-blueprint.json
```

### 2.1 Blueprint Manifest Structure (`logistics-fleet-blueprint.json`)
```json
{
  "id": "bp_logistics_v1",
  "name": "Logistics & Fleet Management",
  "category": "SUPPLY_CHAIN",
  "description": "Vehicle tracking, dispatch orders, maintenance logs, and driver assignments.",
  "icon": "Truck",
  "entityTypes": [
    {
      "systemName": "ent_vehicle",
      "name": "Fleet Vehicle",
      "description": "Commercial transportation vehicles",
      "attributes": [
        {
          "systemName": "license_plate",
          "name": "License Plate",
          "dataType": "STRING",
          "uiComponent": "TEXT_INPUT",
          "isRequired": true,
          "displayOrder": 10
        },
        {
          "systemName": "vehicle_type",
          "name": "Vehicle Type",
          "dataType": "ENUM",
          "uiComponent": "SELECT",
          "isRequired": true,
          "displayOrder": 20,
          "options": {
            "values": ["VAN", "BOX_TRUCK", "SEMI_TRAILER", "ELECTRIC_CARGO"]
          }
        },
        {
          "systemName": "max_payload_kg",
          "name": "Max Payload (kg)",
          "dataType": "NUMBER",
          "uiComponent": "NUMBER_INPUT",
          "isRequired": false,
          "displayOrder": 30
        }
      ]
    },
    {
      "systemName": "ent_dispatch_order",
      "name": "Dispatch Order",
      "description": "Logistics delivery ticket",
      "attributes": [
        {
          "systemName": "tracking_number",
          "name": "Tracking Number",
          "dataType": "STRING",
          "uiComponent": "TEXT_INPUT",
          "isRequired": true,
          "displayOrder": 10
        },
        {
          "systemName": "delivery_status",
          "name": "Delivery Status",
          "dataType": "ENUM",
          "uiComponent": "SELECT",
          "isRequired": true,
          "displayOrder": 20,
          "options": {
            "values": ["SCHEDULED", "IN_TRANSIT", "DELIVERED", "FAILED"]
          }
        }
      ]
    }
  ],
  "relationshipTypes": [
    {
      "systemName": "rel_vehicle_assigned_order",
      "name": "Assigned Vehicle",
      "sourceEntityType": "ent_dispatch_order",
      "targetEntityType": "ent_vehicle",
      "cardinality": "MANY_TO_ONE"
    }
  ]
}
```

---

## 3. Atomic Provisioning Pipeline (Spring Modulith Service)

The provisioning process runs inside a single `@Transactional` boundary. If any step fails, the entire tenant registration rolls back cleanly:

```java
package com.acc.tenant.service;

import com.acc.domain.metadata.*;
import com.acc.tenant.dto.CreateTenantRequest;
import com.acc.tenant.dto.TenantSummaryDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenantProvisioningService {

    private final TenantRepository tenantRepository;
    private final BlueprintLoaderService blueprintLoader;
    private final EntityTypeRepository entityTypeRepository;
    private final AttributeDefRepository attributeDefRepository;
    private final RelationshipTypeRepository relationshipTypeRepository;
    private final SchemaValidationService schemaValidationService;

    @Transactional
    public TenantSummaryDto provisionTenant(CreateTenantRequest request) {
        // 1. Create Core Tenant Record
        Tenant tenant = new Tenant();
        tenant.setTenantId(generateTenantId(request.getOrganizationSlug()));
        tenant.setName(request.getOrganizationName());
        tenant.setPlanTier(request.getPlanTier());
        tenantRepository.save(tenant);

        // 2. Load Selected Blueprint Template
        BlueprintManifest blueprint = blueprintLoader.loadBlueprint(request.getBlueprintId());

        // 3. Deep-Clone Entity Types & Attributes into Tenant Scope
        for (BlueprintEntityType bType : blueprint.getEntityTypes()) {
            EntityType entityType = new EntityType();
            entityType.setTenantId(tenant.getTenantId());
            entityType.setSystemName(bType.getSystemName());
            entityType.setName(bType.getName());
            entityType.setDescription(bType.getDescription());
            entityType.setSchemaVersion(1L);
            EntityType savedType = entityTypeRepository.save(entityType);

            // Clone Attributes
            for (BlueprintAttribute bAttr : bType.getAttributes()) {
                AttributeDefinition attr = new AttributeDefinition();
                attr.setTenantId(tenant.getTenantId());
                attr.setEntityTypeId(savedType.getId());
                attr.setSystemName(bAttr.getSystemName());
                attr.setName(bAttr.getName());
                attr.setDataType(bAttr.getDataType());
                attr.setUiComponent(bAttr.getUiComponent());
                attr.setIsRequired(bAttr.getIsRequired());
                attr.setDisplayOrder(bAttr.getDisplayOrder());
                attr.setOptions(bAttr.getOptions());
                attributeDefRepository.save(attr);
            }

            // 4. Pre-warm Distributed Cache (Compile Draft-07 JSON Schema)
            schemaValidationService.compileAndCacheSchema(tenant.getTenantId(), savedType.getSystemName(), 1L);
        }

        // 5. Clone Relationship Types (Pattern C Edges)
        for (BlueprintRelationship bRel : blueprint.getRelationshipTypes()) {
            RelationshipType rel = new RelationshipType();
            rel.setTenantId(tenant.getTenantId());
            rel.setSystemName(bRel.getSystemName());
            rel.setName(bRel.getName());
            rel.setCardinality(bRel.getCardinality());
            relationshipTypeRepository.save(rel);
        }

        return TenantSummaryDto.from(tenant);
    }
}
```

---

## 4. UI Onboarding Wizard Experience (`@acc/console`)

During first login or signup, the console presents the **Tenant Blueprint Selector**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Welcome to Unipost! Choose your workspace starter               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Select a domain blueprint to immediately initialize your dynamic schemas & forms:     │
│                                                                                        │
│ ┌───────────────────────────┐ ┌───────────────────────────┐ ┌────────────────────────┐ │
│ │ 🚛 Fleet Logistics        │ │ 💼 B2B CRM & Invoicing    │ │ ⚡ Blank Canvas         │ │
│ │ ───────────────────────── │ │ ───────────────────────── │ │ ────────────────────── │ │
│ │ • Vehicles & Telematics   │ │ • Customer Accounts       │ │ • Start from scratch   │ │
│ │ • Dispatch Delivery Notes │ │ • Invoices & Line Items   │ │ • Design custom schema │ │
│ │ • Pattern C Driver Edges  │ │ • Pattern B Contact Links │ │ • For custom platforms │ │
│ │                           │ │                           │ │                        │ │
│ │ [ Select & Provision ]   │ │ [ Select & Provision ]   │ │ [ Start Blank ]        │ │
│ └───────────────────────────┘ └───────────────────────────┘ └────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Blueprint Evolution & Schema Independence

A crucial multi-tenant invariant is **Decoupled Evolution**:
* Once a blueprint is cloned into Tenant `tnt_acme_corp`, **the blueprint link is severed**.
* Tenant `tnt_acme_corp` owns its entity models 100%. They can rename fields, add 20 custom attributes, or delete unnecessary models.
* Future platform updates to `logistics-fleet-blueprint.json` (e.g. adding a new optional attribute) do **not** forcefully overwrite existing tenants' customized schemas, preventing unexpected UI breakages or schema regression.

---

## 6. Summary of Provisioning Guarantees

| Metric / Requirement | Provisioning Pipeline SLA / Guarantee |
| :--- | :--- |
| **Provisioning Latency** | $< 250\text{ ms}$ complete atomic transaction (DB inserts + Hazelcast pre-warm). |
| **Schema Isolation** | All cloned rows stamped with `tenant_id = :newTenantId`. |
| **PostgreSQL RLS Safety** | Initial records and schemas immediately fall under RLS policies created in Part 2. |
| **Initial Time-to-Value** | Zero configuration needed; new user logs directly into functional Data Explorer. |
