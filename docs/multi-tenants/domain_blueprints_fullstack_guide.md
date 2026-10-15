# Comprehensive End-to-End Guide: Using Domain Blueprints (Backend & Frontend)

**Document Type:** Architecture & Implementation Integration Guide  
**Status:** Canonical Reference Document  
**Location:** `docs/multi-tenants/domain_blueprints_fullstack_guide.md`  

---

## 1. Overview & Architecture Blueprint

Domain Blueprints solve the "blank canvas problem" in multi-tenant metadata platforms by providing pre-modeled, production-ready schemas (e.g. Headless CMS, Fleet Logistics, B2B CRM) that can be seeded into a new tenant workspace in $< 250\text{ ms}$, with zero runtime coupling and pre-warmed schema caches.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                DOMAIN BLUEPRINTS FULL-STACK FLOW                                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   [FRONTEND] (Landing / Console)                        [BACKEND] (Spring Modulith + Cache)       │
│                                                                                                  │
│   1. Sign-Up Wizard / Org Settings                                                               │
│      └─ Fetch Catalog ────────────────────────► GET /api/v1/metadata/blueprints                  │
│                                                 └─ Returns: CMS, Logistics, CRM, Blank           │
│   2. User selects Blueprint card & submits                                                       │
│      └─ Provision Request ────────────────────► POST /api/v1/metadata/tenants/provision          │
│                                                 ├─ Deep-clone EntityTypes & Attributes           │
│                                                 ├─ Stamp tenant_id = :tid                        │
│                                                 ├─ Wire Relationship Edges                       │
│                                                 └─ Pre-warm Hazelcast & L1 Cache (<250ms)        │
│   3. Workspace Redirect                                                                          │
│      └─ Swaps Tenant Token & Navigation                                                          │
│         ├─ Left Sidebar auto-populates models                                                    │
│         ├─ Dynamic Grid & Forms ready                                                            │
│         └─ Operator vs Architect mode active                                                     │
│                                                                                                  │
│   4. Post-Provisioning Evolution (Zero Linkage)                                                  │
│      └─ Tenant adds custom fields / models without modifying global blueprint JSON files         │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Part 1: How Frontend Uses Domain Blueprints (`@unipost/console`)

There are **three primary frontend touchpoints** where domain blueprints provide high-value experiences:

### Touchpoint A: The Self-Service Onboarding Wizard (Public Landing / Sign-Up)
When a prospective customer signs up or creates their organization:
1. **Interactive Blueprint Carousel:**
   - The wizard queries `GET /api/v1/metadata/blueprints`.
   - Renders a multi-card **Liquid Glass** selector featuring:
     - 📰 **Headless CMS & Publishing** (`bp_cms_publishing_v1`): *3 models, 15 attributes, 2 graph edges*
     - 🚚 **Logistics & Fleet Dispatch** (`bp_logistics_v1`): *2 models, 7 attributes, 1 edge*
     - 💼 **B2B CRM & Commercial Billing** (`bp_crm_billing_v1`): *2 models, 8 attributes, 1 edge*
     - 📐 **Blank Canvas** (`bp_blank_v1`): *Start completely from scratch*
2. **Template Preview Modal:**
   - Clicking *"Preview Template"* pops up an interactive graph diagram (React Flow) and sample form cards showing the exact fields (e.g., `Delivery Status`, `Tracking Number`, `VAT Tax ID`) so the user knows what they are getting before provisioning.
3. **1-Click Workspace Setup:**
   - Once selected, the user clicks **"Initialize Workspace"**.
   - Frontend issues `POST /api/v1/metadata/tenants/provision` with `{ tenantId, tenantName, blueprintId }`.
   - Displays a sleek 0.25-second Liquid Glass spinner: *"Assembling schema models and warming validation caches..."*
   - Seamlessly redirects the user into their fresh workspace at `/_authenticated/data`.

### Touchpoint B: Multi-Workspace / Organization Switcher
The system enforces a clean **Tenant $\rightarrow$ Workspace** hierarchy:
- **Tenant (Organization or Individual representation):** Top-level billing account, PostgreSQL RLS tenant boundary (`tenant_id`), entity types owner, and subscription holder. One Tenant can have multiple Users.
- **Workspaces (Environments / Spaces / Branches):** Sub-divisions belonging to a parent Tenant (e.g., *Production Workspace*, *Staging Environment*, *Warehouse Hub North*). 1 Workspace $\ne$ 1 Organization; Workspaces are children of a Tenant.

Inside **Settings $\rightarrow$ Workspaces** & the Header **ProfileSwitcher**:
1. Workspaces are clearly grouped under their parent **Organization (Tenant)**.
2. In **"Tạo Workspace Mới"**:
   - The admin creates a workspace scoped under the currently active Tenant (or an explicit parent organization).
   - The admin selects a domain template to seed the initial schema models for that space.
3. The UI synchronizes both `setActiveTenant(tenantId, tenantName)` and `setActiveWorkspace(workspaceId, workspaceName)` without clobbering organizational boundaries.

### Touchpoint C: Dynamic Navigation & UI Hydration
Once a blueprint is provisioned, the frontend requires **zero manual configuration or hardcoding**:
1. **Sidebar Navigation Auto-Discovery:**
   - When the user lands on the workspace, `useQuery(['entity-types'])` fetches `/api/v1/metadata/entity-types`.
   - The sidebar immediately populates the cloned models (e.g., for CMS: `Articles`, `Categories`, `Media Assets`).
2. **Instant Dynamic Forms & Data Grids:**
   - Clicking `Articles` renders the dynamic Bento Grid.
   - Clicking `+ New Article` automatically generates the form layout matching the blueprint’s attributes:
     - `title` $\rightarrow$ text input
     - `body_content` $\rightarrow$ rich markdown/textarea
     - `status` $\rightarrow$ select dropdown with `DRAFT`, `IN_REVIEW`, `PUBLISHED`
     - `featured_flag` $\rightarrow$ switch toggle
3. **Decoupled "Architect Studio" Customization:**
   - The tenant administrator switches the header toggle pill to **Architect Mode**.
   - They can immediately:
     - Add new custom fields (e.g., `reading_time_minutes`, `co_author`).
     - Change field labels or validation rules.
     - Delete models they don't need.
   - **Crucial Rule:** Because of *Decoupled Schema Evolution*, none of these modifications alter the global blueprint JSON or impact other tenants.

---

## 3. Part 2: How Backend Uses Domain Blueprints (`@unipost/backend`)

The backend acts as the authoritative engine enforcing isolation, pre-warming, and immutability.

### 1. Dynamic Catalog Discovery (Classpath Scanning)
- **Service:** [`BlueprintCatalogService.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/tenant/blueprint/BlueprintCatalogService.java)
- **Behavior:**
  - On Spring Boot startup, `PathMatchingResourcePatternResolver` scans `classpath:metadata/blueprints/*.json`.
  - JSON manifests are parsed into memory records (`BlueprintManifest`).
  - **Why this matters:** Adding a new industry blueprint (e.g., *Hospital Clinic*, *E-Commerce Store*) requires **only dropping a JSON file into resources**. No database migrations, no Java code changes, and zero schema locks.

### 2. Transactional Deep-Cloning Pipeline
- **Service:** [`TenantProvisioningService.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/tenant/service/TenantProvisioningService.java)
- **Pipeline Execution:**
  ```java
  // Step 1: Bind Security Context
  TenantContextHolder.setTenantId(targetTenantId);

  // Step 2: Deep-clone Entity Types
  for (BlueprintEntityType bType : manifest.entityTypes()) {
      EntityType et = new EntityType();
      et.setTenantId(targetTenantId); // Stamped!
      et.setName(bType.name());
      et.setSystemName(bType.systemName());
      et.setSchemaVersion(1L);
      entityTypeRepository.save(et);
      
      // Step 3: Deep-clone Attributes
      for (BlueprintAttribute bAttr : bType.attributes()) {
          AttributeDefinition attr = new AttributeDefinition();
          attr.setTenantId(targetTenantId); // Stamped!
          attr.setEntityType(et);
          ...
          attributeDefinitionRepository.save(attr);
      }
      
      // Step 4: Pre-warm Distributed Cache Fabric
      schemaValidationService.getOrCompileJsonSchema(targetTenantId, et.getId(), 1L);
  }

  // Step 5: Wire Graph Edges (Relationship Types)
  for (BlueprintRelationship bRel : manifest.relationshipTypes()) {
      RelationshipType rel = new RelationshipType();
      rel.setTenantId(targetTenantId);
      rel.setSourceEntityType(createdEntities.get(bRel.sourceEntityType()));
      rel.setTargetEntityType(createdEntities.get(bRel.targetEntityType()));
      relationshipTypeRepository.save(rel);
  }
  ```

### 3. Distributed Cache Fabric Pre-Warming
- Rather than waiting for the tenant's first write request to trigger schema compilation:
  - The Draft-07 JSON Schema is compiled synchronously during provisioning.
  - It is stored directly in Hazelcast under the composite key:
    $$\text{schema}:\{\text{tenantId}\}:\{\text{entityTypeId}\}:\text{v}1\_\text{s}1$$
  - Also cached in local L1 in-memory maps.
- **Latency Result:** The tenant’s very first record creation validates in $< 2\text{ ms}$ instead of incurring a $300\text{ ms}$ cold start.

### 4. Tenant Row-Level Security (RLS) Enforcement
- Because every cloned record is stamped with `tenant_id = :targetTenantId`, PostgreSQL RLS policies (`FORCE ROW LEVEL SECURITY`) immediately protect the seeded data.
- Tenant A cannot view or tamper with Tenant B's cloned models, even though both originated from the same `bp_cms_publishing_v1` blueprint.

---

## 4. Part 3: Frontend Code Patterns & Components

### 1. TanStack Query Hook (`use-blueprint-catalog.ts`)
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export interface BlueprintSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  entityTypesCount: number;
  relationshipsCount: number;
}

export function useBlueprintCatalog() {
  return useQuery<BlueprintSummary[]>({
    queryKey: ['blueprints-catalog'],
    queryFn: async () => {
      const res = await axios.get('/api/v1/metadata/blueprints');
      return res.data.data;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes cache
  });
}

export function useProvisionTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { tenantId: string; tenantName: string; blueprintId: string }) => {
      const res = await axios.post('/api/v1/metadata/tenants/provision', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-types'] });
    },
  });
}
```

### 2. Liquid Glass Blueprint Picker Card (`blueprint-card.tsx`)
```tsx
import { LucideIcon, Truck, Newspaper, Briefcase, Layers } from 'lucide-react';

const iconMap: Record<string, any> = {
  Truck,
  Newspaper,
  Briefcase,
  Layers,
};

export function BlueprintCard({ blueprint, isSelected, onSelect }: BlueprintCardProps) {
  const IconComponent = iconMap[blueprint.icon] || Layers;

  return (
    <div
      onClick={() => onSelect(blueprint.id)}
      className={`relative p-5 rounded-2xl cursor-pointer transition-all duration-300
        backdrop-blur-xl border 
        ${isSelected 
          ? 'bg-blue-500/15 border-blue-500/60 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/30' 
          : 'bg-white/60 dark:bg-slate-900/60 border-white/30 dark:border-white/10 hover:border-white/60 hover:bg-white/80'}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-600 dark:text-blue-400">
          <IconComponent className="w-6 h-6" />
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300">
          {blueprint.entityTypesCount} Models
        </span>
      </div>

      <h3 className="mt-4 font-semibold text-slate-900 dark:text-white text-base">
        {blueprint.name}
      </h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
        {blueprint.description}
      </p>

      <div className="mt-4 pt-3 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center justify-between text-xs text-slate-500">
        <span>{blueprint.relationshipsCount} Graph Edges</span>
        <span className="font-medium text-blue-600 dark:text-blue-400">Select Template →</span>
      </div>
    </div>
  );
}
```

---

## 5. Part 4: Practical Usage Scenarios

| Scenario | What Backend Does | What Frontend Does |
| :--- | :--- | :--- |
| **New User Signup via Landing Page** | Waits for registration call; on submit, `TenantProvisioningService` deep-clones chosen blueprint and pre-warms cache in $< 250\text{ ms}$. | Renders Hero $\rightarrow$ Pricing $\rightarrow$ **Blueprint Carousel** $\rightarrow$ Form checkout $\rightarrow$ Redirects to data view. |
| **Add New Business Domain to Platform** | Developer drops `<new-domain>-blueprint.json` into classpath resources. Restart server. Done. | Automatically displays the new card with its icon, model counts, and descriptions. Zero code changes required! |
| **Tenant Customizes a Provisioned Model** | Receives `POST /api/v1/metadata/attribute-definitions` with `tenant_id`. Mutates tenant schema version $1 \rightarrow 2$. | In **Architect Mode**, clicks `+ Add Custom Field`. Renders ✏️ `Custom` badge. Doesn't touch original blueprint. |
| **Cross-Tenant Data Privacy** | Enforces PostgreSQL RLS on `UNIPOST_ENTITY_TYPES` and `UNIPOST_ENTITIES`. | Token carries `tid`. Frontend only ever sees models belonging to active organization. |

---

## 6. Part 5: Public Landing Page, Subscriptions & payOS Onboarding Funnel (Backlog)

> **Status:** ⏳ **BACKLOG (To be implemented later)**  
> **Source:** Phase 1 (Landing & Funnel), Phase 6 UI Wiring (Blueprint Gallery in Console), and Phase 9 (payOS & Feature Entitlements) from Master Multi-Tenant Implementation Plan  
> **Reference Documents:**
> - [`docs/multi-tenants/10_landing_page_and_onboarding_funnel.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/multi-tenants/10_landing_page_and_onboarding_funnel.md)
> - [`docs/multi-tenants/05_tenant_onboarding_and_template_provisioning.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/multi-tenants/05_tenant_onboarding_and_template_provisioning.md)
> - [`docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md)  
> **Goal:** Complete the full-stack commercialization and UI wiring: public marketing landing page (`/`), 3 subscription tiers, integrated payOS VietQR checkout, in-app `<FeatureGate />` component, and Console UI Blueprint Catalog Gallery Dialog.

---

### Backlog Component 1: Public Landing Page & payOS Checkout Funnel (Phase 1)
- [ ] **Task B1.1: Public Landing Route Setup (`apps/console/src/routes/index.tsx`)**:
  - Implement public index route (`/`) using TanStack Router with auth guard redirection (authenticated users auto-redirected to `/_authenticated`).
- [ ] **Task B1.2: Liquid Glass Hero & Interactive Showcase (`@unipost/console`)**:
  - Build `HeroSection` with dynamic animated value propositions ("Nền tảng Quản trị Dữ liệu Động & Metadata Đa Khách Hàng").
  - Create interactive preview mockup showcasing dynamic form generation, blueprint templates, and graph edge connections.
- [ ] **Task B1.3: Subscription & Pricing Section**:
  - Build `PricingSection` with Monthly / Yearly billing toggle (with 2 months free badge on annual).
  - Implement 3 transparent plan cards:
    - **🆓 Basic (Cơ bản)**: Miễn phí (Free) | 1 User duy nhất | Unlimited Records.
    - **⚡ Pro (Pro)**: 199,000 VND / tháng | Lên đến 5 Users | Unlimited Records.
    - **👑 Pro Max (Pro Max)**: 499,000 VND / tháng | Không giới hạn Users | Unlimited Records.
- [ ] **Task B1.4: Integrated Register / Login Modal Flow with Blueprint Selection**:
  - Implement modal allowing direct user and workspace registration from plan CTA buttons.
  - Step 1: Account credentials (email, password, tenant name).
  - Step 2: **Blueprint Selection Carousel** (CMS, Logistics, CRM, Blank).
  - Basic tier provisions chosen blueprint and redirects directly into the workspace upon registration.
- [ ] **Task B1.5: payOS VietQR Checkout Modal**:
  - When clicking upgrade to Pro or Pro Max, open `PayOsQrModal` rendering a dynamic VietQR code for 1-click mobile banking transfer.
  - Setup frontend status polling / SSE confirmation to immediately redirect upon payment receipt.

---

### Backlog Component 2: Console UI Blueprint Catalog Wiring (Phase 6 UI)
- [ ] **Task B2.1: TanStack Query Blueprint Hooks**:
  - Implement `useBlueprintCatalog()` fetching `GET /api/v1/metadata/blueprints` with 30-minute stale time.
  - Implement `useProvisionTenant()` submitting `POST /api/v1/metadata/tenants/provision` and invalidating `['entity-types']` cache.
- [ ] **Task B2.2: Liquid Glass Blueprint Gallery Dialog (`blueprint-gallery-dialog.tsx`)**:
  - Modal opened via **"Import Blueprint"** button located on `EntityTypeSidebar` header and on blank workspace empty states.
  - Renders category tabs (*All*, *Operations*, *Publishing*, *Commerce*) and responsive Bento grid of blueprint cards.
  - Shows preview drawer: entity models list, field counts, and graph relationships schema diagram.
  - Confirmation triggers atomic cloning stamped with target `tenant_id` without page reload.

---

### Backlog Component 3: payOS Webhooks & Dynamic Feature Entitlements (Phase 9)
- [ ] **Task B3.1: Backend Dynamic Entitlements Registry (`UNIPOST_TENANT_FEATURES`)**:
  - Create table modeling tenant dynamic capability keys (`FEATURE_SCHEMA_STUDIO`, `FEATURE_PATTERN_C_GRAPH`, `FEATURE_AI_AGENT_MCP`, `FEATURE_DATA_EXPORT`).
  - Implement `@RequireFeature` annotation and Spring Modulith aspect intercepting unentitled calls with HTTP 403 Forbidden.
- [ ] **Task B3.2: payOS Webhook Integration (`PayOsWebhookController`)**:
  - Verify HMAC-SHA256 signatures on incoming payOS webhooks.
  - Dynamically activate tenant subscription tier entitlements upon transfer confirmation (`PAID`).
- [ ] **Task B3.3: Console UI In-App Feature Guards (`<FeatureGate />`)**:
  - Reusable React component wrapping premium features (e.g. Graph Relationships Tab, Schema Studio, AI Assistant).
  - Unentitled tenants see a frosted Liquid Glass teaser banner with 1-click upgrade button opening the payOS VietQR modal.

---

### Verification Gate (When Implemented):
- Load `http://localhost:5173/` in incognito: landing page renders with pricing tiers.
- Select a Blueprint from the carousel, complete sign-up, and verify workspace seeds immediately.
- In Console `/metadata`, open Blueprint Gallery Dialog, import a template, and verify new models appear in `< 250ms`.
- Simulate payOS VietQR webhook; verify premium feature unlocks immediately without service reboot.
