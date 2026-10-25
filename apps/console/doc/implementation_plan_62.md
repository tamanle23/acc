# Comprehensive Phased Implementation Plan 62: Domain Blueprints Full-Stack Ecosystem

**Document Path:** `apps/console/doc/implementation_plan_62.md`  
**Target Systems:** `@acc/backend` (Spring Modulith / Java 21 / payOS Vietnam SDK / PostgreSQL), `@acc/console` (React 19 / Vite 8 / TanStack Router / Liquid Glass Design System)  
**Reference Document:** [`docs/multi-tenants/domain_blueprints_fullstack_guide.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/domain_blueprints_fullstack_guide.md)  
**Supporting Specifications:**
- Part 5: [`docs/multi-tenants/05_tenant_onboarding_and_template_provisioning.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/05_tenant_onboarding_and_template_provisioning.md)
- Part 9: [`docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md)
- Part 10: [`docs/multi-tenants/10_landing_page_and_onboarding_funnel.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/10_landing_page_and_onboarding_funnel.md)
- Sandbox Standard: [`.agents/rules/02-unified-sandbox.md`](file:///c:/Users/Admin/workspace/git/acc/.agents/rules/02-unified-sandbox.md)
- Enhancements & Brainstorm: [`apps/console/doc/blueprint_ecosystem_enhancement_brainstorm.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/blueprint_ecosystem_enhancement_brainstorm.md)

---

## 1. Architectural Strategy & Phased Breakdown

The **Domain Blueprints Full-Stack Ecosystem** connects the backend provisioning engine (`@acc/backend`) with the client experience (`@acc/console`) across all touchpoints:
- **Internal Architect & Operator Flow:** Discovering, previewing, and importing blueprints directly from inside the `/metadata` workspace.
- **Public Self-Service Acquisition Flow:** Public landing page (`/`), pricing tiers, blueprint carousel selection, registration, and 1-click workspace initialization.
- **Multi-Workspace Switcher Flow:** Provisioning isolated sub-workspaces/subsidiaries from Settings.
- **Commercialization & Entitlements Flow:** payOS VietQR automated checkout, HMAC webhooks, dynamic capability registry (`UNIPOST_TENANT_FEATURES`), and `<FeatureGate />` guards.

To guarantee zero regressions, strict compliance with the **Unified Sandbox Platform**, zero unauthorized dependencies, and seamless developer ergonomics, the plan is structured into **4 sequential, highly cohesive phases**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             DOMAIN BLUEPRINTS FULL-STACK PHASES                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  [PHASE 1: In-App Blueprint Gallery, Template Preview Modal & Console Seeding]                  │
│  • Backend: GET /api/v1/metadata/blueprints/{id} full manifest endpoint                          │
│  • Backend: Permit anonymous access to catalog discovery (/api/v1/metadata/blueprints)           │
│  • Frontend: TanStack hooks (`useBlueprintCatalog`, `useBlueprintDetails`, `useImportBlueprint`)  │
│  • Frontend: Zero-dependency SVG Liquid Glass Relationship Graph Visualizer                      │
│  • Frontend: Template Preview Modal (Model schema table + SVG DAG graph + live dynamic form)    │
│  • Frontend: Blueprint Gallery Dialog with search & category filters                             │
│  • Frontend: Sidebar trigger button & zero-model workspace empty state callout                   │
│  • Sandbox: Unified Sandbox Adapter handler for blueprint catalog & tenant provisioning          │
│                                                                                                  │
│  [PHASE 2: Public Landing Page & Self-Service Onboarding Funnel]                                │
│  • Frontend: Root `/` route with auth bypass redirection                                         │
│  • UI: Liquid Glass Hero, dynamic product preview, and Bento feature showcase                   │
│  • UI: Transparent Pricing Section (Basic Free, Pro 199k, Pro Max 499k) + Cadence toggle         │
│  • UI: 2-Step Onboarding Modal with interactive Blueprint Carousel & 1-Click Setup (<250ms)     │
│                                                                                                  │
│  [PHASE 3: Multi-Workspace Switcher & Organization Provisioning]                                 │
│  • Backend: Sub-tenant / workspace creation endpoint with blueprint seeding                     │
│  • Frontend: Settings -> Workspaces -> "+ Create Workspace" modal with Blueprint selector        │
│  • UI: Instant organization switching & token re-hydration                                      │
│                                                                                                  │
│  [PHASE 4: payOS VietQR Checkout & Dynamic Feature Entitlements Engine]                          │
│  • Backend: UNIPOST_TENANT_BILLING & UNIPOST_TENANT_FEATURES tables + Liquibase migration         │
│  • Backend: payOS SDK integration, payment link generator, and HMAC-SHA256 webhook handler      │
│  • Backend: Spring Modulith @RequireFeature aspect & cache invalidation                          │
│  • Frontend: In-app <FeatureGate /> component with frosted teaser scrim & PayOsQrModal           │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: In-App Blueprint Gallery, Template Preview Modal & Console Seeding

### 2.1 Backend Deliverables (`@acc/backend`)
- [ ] **Task 1.1: Blueprint Manifest Detail Endpoint (`GET /api/v1/metadata/blueprints/{id}`)**
  - **Class:** [`TenantProvisioningController.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/TenantProvisioningController.java)
  - Method: `getBlueprintDetails(@PathVariable String blueprintId)` returning `ResponseWrapper<ContextHeader, BlueprintManifest>`.
  - Calls `blueprintCatalogService.getBlueprint(blueprintId)`.
  - Returns HTTP 404 if blueprint ID does not exist in catalog.
- [ ] **Task 1.2: Catalog Public Access Configuration**
  - Configure Spring Security to permit anonymous read-only access to `/api/v1/metadata/blueprints` and `/api/v1/metadata/blueprints/*` so public visitors on the landing page can discover blueprints without forcing login.
- [ ] **Task 1.3: Blueprint Provisioning Collision Safety & Sample Records**
  - In `TenantProvisioningService.java`:
    - Check if entity model system name already exists in target tenant.
    - If collision exists, safely suffix `_imported` or skip duplicate attributes, preventing transaction abort.
    - Optionally seed `sampleRecords` if specified in manifest.

### 2.2 Frontend Deliverables (`@acc/console`)
- [ ] **Task 1.4: Unified Sandbox Platform Integration (`metadata-sandbox-adapter.ts`)**
  - Adhere strictly to `.agents/rules/02-unified-sandbox.md`.
  - Add matcher & handler for:
    - `GET /api/v1/metadata/blueprints`: returns catalog summaries from mock data.
    - `GET /api/v1/metadata/blueprints/:id`: returns full blueprint manifest.
    - `POST /api/v1/metadata/tenants/provision`: clones blueprint entity types and attributes into `mockMetadataStore` for the active tenant, enabling full frontend testing in dev sandbox mode.
- [ ] **Task 1.5: TanStack Query Hooks & DTOs (`apps/console/src/features/metadata/api/use-blueprints.ts`)**
  - Define interfaces: `BlueprintSummaryDto`, `BlueprintManifest`, `BlueprintEntityType`, `BlueprintAttribute`, `BlueprintRelationship`.
  - `useBlueprintCatalog()`: queries `/api/v1/metadata/blueprints` (stale time: 30 mins).
  - `useBlueprintDetails(blueprintId: string | null)`: queries `/api/v1/metadata/blueprints/{blueprintId}` when ID is active.
  - `useImportBlueprint()`: mutation calling `POST /api/v1/metadata/tenants/provision` with `{ tenantId, tenantName, blueprintId }`.
    - Handles query invalidation of `['entity-types']` and surfaces success toast with entity count.
- [ ] **Task 1.6: Zero-Dependency SVG Liquid Glass Relationship Graph Visualizer (`blueprint-graph-canvas.tsx`)**
  - Path: `apps/console/src/features/metadata/components/blueprint-gallery/blueprint-graph-canvas.tsx`
  - Zero external package footprint (strictly uses native SVG, Tailwind CSS, and Lucide icons).
  - Computes dynamic node coordinates and bezier spline connector curves between source and target models.
  - Renders cardinality badges (`1:1`, `1:N`, `N:N`) on the edge curves, model headers with icons, and specular glass highlights.
- [ ] **Task 1.7: Template Preview Modal (`template-preview-modal.tsx`)**
  - Path: `apps/console/src/features/metadata/components/blueprint-gallery/template-preview-modal.tsx`
  - High-elevation Liquid Glass modal (`backdrop-blur-2xl bg-white/85 dark:bg-slate-900/90 border border-white/20`).
  - **Tabs / Sub-views**:
    - **Models & Attributes Explorer**: Left model selector; right attribute table displaying system names, data types, UI widgets, and validation constraints.
    - **Relationship Architecture Graph**: Embeds the SVG DAG graph visualizer from Task 1.6.
    - **Sample Record Dynamic Form Preview**: Renders the exact dynamic form layout generated for the primary model.
  - Action footer: "Import This Blueprint" button displaying model & edge summary counts with loading spinner during provisioning.
- [ ] **Task 1.8: Liquid Glass Blueprint Gallery Dialog (`blueprint-gallery-dialog.tsx`)**
  - Path: `apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery-dialog.tsx`
  - Controlled dialog wired to `useMetadataUiStore.isBlueprintGalleryOpen`.
  - Search filter input + Category pills (*All*, *Publishing*, *Logistics & Fleet*, *Commerce & CRM*).
  - Bento Grid of `BlueprintCard` components featuring animated specular borders, Lucide icon maps, and dual actions: `[ Preview Template ]` and `[ 1-Click Import ]`.
- [ ] **Task 1.9: Workspace Integration & Zero-Model Empty State**
  - **Sidebar Action**: Add `<BookTemplate size={15} /> Import Blueprint` in [`entity-type-sidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx) header.
  - **Zero-Model Empty State**: In [`metadata-feature.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/metadata-feature.tsx), when `entityTypes.length === 0`, render an interactive glass callout:
    - *"Your workspace has no models yet. Start from scratch or jump-start with a Domain Blueprint."*
    - Actions: `[ ➕ Create Custom Model ]` and `[ 📚 Browse Blueprint Catalog ]`.

### 2.3 Phase 1 Verification Criteria
- `mvn clean compile` passes on backend with new endpoints and tests.
- `pnpm --filter @acc/console exec tsc --noEmit` passes with 0 errors.
- Vitest unit tests for `use-blueprints.ts`, `blueprint-gallery-dialog.tsx`, and `blueprint-graph-canvas.tsx`.
- In Console `/metadata`: Click "Import Blueprint" -> Open "Headless CMS" preview -> Inspect SVG graph, attributes, and form -> Click "Import" -> Models populate in $< 250\text{ ms}$.

---

## 3. Phase 2: Public Landing Page & Self-Service Onboarding Funnel

### 3.1 Architecture & Flow Specifications
Reference: [`docs/multi-tenants/10_landing_page_and_onboarding_funnel.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/10_landing_page_and_onboarding_funnel.md).

```
Step 1: Public Discovery (/) -> Step 2: Plan Selection -> Step 3: Register Modal & Blueprint Carousel -> Step 4: 1-Click Workspace Setup (<250ms) -> Step 5: Redirect to /_authenticated/data
```

### 3.2 Frontend Deliverables (`@acc/console`)
- [ ] **Task 2.1: Public Landing Route Setup (`apps/console/src/routes/index.tsx`)**
  - Implement public index route (`/`) using TanStack Router.
  - Auth Session Check: If user already has an active access token and tenant ID in local storage/cookies, auto-redirect to `/_authenticated/data`. If unauthenticated, render the public `LandingPage`.
  - Update `apps/console/ROUTE.md`.
- [ ] **Task 2.2: Liquid Glass Marketing Header & Hero Section**
  - Navigation bar: Brand Logo, links (*Tính năng*, *Giải pháp*, *Bảng giá*, *Tài liệu*), Dark mode toggle, `[ Đăng nhập ]` button.
  - Hero Section: Headline *"Nền Tảng Quản Trị Dữ Liệu Động & Metadata Đa Khách Hàng"*, subheader, and dual CTAs: `[ 🚀 Bắt đầu miễn phí ]` and `[ 🎥 Xem demo trực tiếp ]`.
- [ ] **Task 2.3: Interactive Product Preview & Bento Grid**
  - Interactive Preview Component: Mock Studio showing dynamic model switching (`Articles` -> `Shipments` -> `Invoices`) and instant dynamic form rendering.
  - Bento Grid cards: Zero-downtime schema evolution, Pattern C graph relationships, Hard multi-tenant RLS isolation, Enterprise compliance (GDPR Art. 17 & Streaming Export).
- [ ] **Task 2.4: Subscription & Pricing Section**
  - Monthly vs. Yearly cadence toggle switch with "-20% / 2 Months Free" badge on annual plan.
  - 3 Transparent Pricing Cards:
    - **🆓 Basic (Cơ bản)**: Free | 1 User | Unlimited Records | Standard Support.
    - **⚡ Pro (Pro)**: 199,000 VND / month (1,990,000 VND / year) | Up to 5 Users | Unlimited Records.
    - **👑 Pro Max (Pro Max)**: 499,000 VND / month (4,990,000 VND / year) | Unlimited Users | AI Agent MCP Server.
- [ ] **Task 2.5: Integrated Onboarding Modal with Interactive Blueprint Carousel**
  - Modal triggered by plan CTA buttons.
  - **Step 1: Account & Organization Info**:
    - Full Name, Email, Password, Workspace Name (auto-generates slug `tenant_id`).
  - **Step 2: Interactive Blueprint Carousel**:
    - Carousel showing: *Headless CMS*, *Fleet Logistics*, *B2B CRM*, and *Blank Canvas*.
    - Includes "Preview Template" trigger opening the `TemplatePreviewModal` from Phase 1.
- [ ] **Task 2.6: 1-Click Workspace Setup & Spinner Transition**
  - When clicking "Initialize Workspace":
    - Calls registration & provisioning endpoint.
    - Renders sleek 0.25-second Liquid Glass spinner: *"Assembling schema models and warming validation caches..."*
    - Stashes JWT tokens, hydrates tenant context, and smoothly navigates user into `/_authenticated/data` with pre-warmed models already rendered in the left rail.

### 3.3 Phase 2 Verification Criteria
- Unauthenticated user visits `http://localhost:5173/`: renders hero, pricing, and bento grid.
- Authenticated user visits `/`: immediately forwarded to `/_authenticated/data`.
- Complete onboarding walkthrough: Choose Free tier -> Fill info -> Select "Logistics & Fleet" -> Submit -> Redirects to workspace with `Shipments` and `FleetVehicles` ready.

---

## 4. Phase 3: Multi-Workspace Switcher & Organization Provisioning

### 4.1 Architecture Specifications
Reference: `Touchpoint B: Multi-Workspace / Organization Switcher` from [`domain_blueprints_fullstack_guide.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/domain_blueprints_fullstack_guide.md).

### 4.2 Backend & Frontend Deliverables
- [ ] **Task 3.1: Backend Multi-Tenant Provisioning Scope**
  - Ensure `POST /api/v1/metadata/tenants/provision` can accept an existing user identity and link the newly provisioned tenant to the user's authorized tenant list.
- [ ] **Task 3.2: Console Workspace Switcher & Creation Dialog**
  - Location: Header Organization Dropdown & `apps/console/src/features/settings/` (Workspaces tab).
  - Add `+ Create New Workspace` option:
    - Opens modal requesting Workspace Name and Blueprint selection.
    - Invokes `provisionTenant` mutation.
    - On success: updates local workspace list, switches active `tenant_id`, invalidates query caches, and immediately rehydrates the UI without full page refresh.

### 4.3 Phase 3 Verification Criteria
- User creates a second workspace with "B2B CRM" while active workspace is "Headless CMS".
- Switching between workspaces in the header dropdown swaps sidebar models and data grids instantly with strict tenant isolation.

---

## 5. Phase 4: payOS VietQR Integration & Dynamic Feature Entitlements Engine

### 5.1 Architecture Specifications
Reference: [`docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md).

### 5.2 Backend Deliverables (`@acc/backend`)
- [ ] **Task 4.1: Liquibase Migration & Entity Models**
  - Create `UNIPOST_TENANT_BILLING`:
    - Columns: `tenant_id` (PK, UUID), `payos_customer_id`, `current_order_code` (BIGINT), `plan_tier` (VARCHAR), `billing_cadence` (VARCHAR), `expires_at` (TIMESTAMP), `status` (VARCHAR).
  - Create `UNIPOST_TENANT_FEATURES`:
    - Columns: `id` (PK, UUID), `tenant_id` (FK, UUID), `feature_key` (VARCHAR), `is_enabled` (BOOLEAN), `expires_at` (TIMESTAMP).
    - Unique partial index: `UNIQUE (tenant_id, feature_key)`.
  - Spring JPA Entities: `TenantBillingEntity`, `TenantFeatureEntity`.
- [ ] **Task 4.2: payOS SDK Client & Checkout Service**
  - Integrate payOS Java library or HTTP client.
  - `PayOsBillingService`:
    - `createPaymentLink(tenantId, planTier, cadence)`: generates dynamic VietQR code, orderCode, and return URL.
    - `verifyAndProcessWebhook(payload, signature)`: verifies HMAC-SHA256 checksum. If payment is `PAID`, updates billing entity, inserts/updates active feature tokens in `UNIPOST_TENANT_FEATURES`, and shreds cached entitlements.
- [ ] **Task 4.3: Distributed Entitlements Cache & Security Aspect (`@RequireFeature`)**
  - Caching: store active feature keys in Hazelcast under `entitlements:{tenantId}`.
  - Create annotation `@RequireFeature(String featureKey)`.
  - Create Spring Modulith Aspect `FeatureEntitlementAspect`:
    - Intercepts annotated methods, checks active tenant's entitlement set.
    - If unentitled, throws `FeatureNotEntitledException` -> returns HTTP 403 Forbidden with payload `{ "error": "FEATURE_LOCKED", "feature": "FEATURE_AI_AGENT_MCP" }`.

### 5.3 Frontend Deliverables (`@acc/console`)
- [ ] **Task 4.4: In-App Feature Gate Component (`<FeatureGate />`)**
  - Path: `apps/console/src/core/auth/feature-gate.tsx`
  - Renders children when entitled.
  - When unentitled: renders a Liquid Glass frosted scrim over the gated UI (e.g. Graph Edges Tab, Schema Studio, AI Assistant), displaying a lock badge, feature benefits, and an "Upgrade via VietQR" button.
- [ ] **Task 4.5: Dynamic payOS VietQR Checkout Modal (`payos-qr-modal.tsx`)**
  - Path: `apps/console/src/features/billing/components/payos-qr-modal.tsx`
  - Fetches payment link from backend; renders dynamic VietQR code with Napas247 / bank details and order reference.
  - Connects to SSE or polling endpoint for instant confirmation.
  - Upon successful transfer: triggers celebration animation, invalidates tenant feature cache, unlocks gated feature live without page reload.

### 5.4 Phase 4 Verification Criteria
- Automated Spring Boot tests: HMAC-SHA256 signature verification with valid and forged payloads.
- `@RequireFeature` aspect tests: unentitled tenant receives HTTP 403; entitled tenant proceeds with HTTP 200.
- Frontend test: `<FeatureGate />` renders fallback scrim for unentitled users; unlocks upon receiving payment SSE.

---

## 6. Execution Roadmap & Milestones

| Milestone | Scope & Deliverables | Primary Apps | Verification Gates |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Blueprint Detail API, Public Access config, Sandbox Adapter, Zero-dep SVG Graph, `TemplatePreviewModal`, `BlueprintGalleryDialog`, Sidebar trigger & Zero-model callout | `apps/backend`, `apps/console` | Unit tests pass, live blueprint import in console in $<250\text{ ms}$ |
| **Phase 2** | Root `/` Landing Route, Liquid Glass Hero & Bento, Pricing Section, 2-Step Onboarding with Blueprint Carousel & 1-Click Setup | `apps/console` | Public routing verified, new tenant onboarded with selected blueprint |
| **Phase 3** | Sub-tenant creation API, Settings Workspaces UI with Blueprint picker, Instant tenant context switching | `apps/backend`, `apps/console` | Multi-workspace creation and live context switching verified |
| **Phase 4** | `UNIPOST_TENANT_FEATURES`, payOS VietQR webhooks, `@RequireFeature` aspect, `<FeatureGate />` UI & `PayOsQrModal` | `apps/backend`, `apps/console` | HMAC webhook test passes, VietQR scan simulation unlocks feature live |

---

## 7. History & Archival Protocol
In accordance with `.agents/rules/00-generic-common.md`:
- Each phase produces a paired `apps/console/doc/walkthrough_<NN>.md` (or `apps/backend/doc/walkthrough_<NN>.md`).
- Each phase logs a sequential entry in `docs/history/XXX_<task>.md` and updates `docs/history/README.md`.
- All verified changes auto-committed with Conventional Commits (`feat(...)`, `test(...)`).
