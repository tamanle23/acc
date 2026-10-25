# Architectural Brainstorm & Enhancement Analysis: Domain Blueprints Full-Stack Ecosystem

**Target Documents:**
- [`docs/multi-tenants/domain_blueprints_fullstack_guide.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/domain_blueprints_fullstack_guide.md)
- [`docs/multi-tenants/05_tenant_onboarding_and_template_provisioning.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/05_tenant_onboarding_and_template_provisioning.md)
- [`docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md)
- [`docs/multi-tenants/10_landing_page_and_onboarding_funnel.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/10_landing_page_and_onboarding_funnel.md)
- [`.agents/rules/02-unified-sandbox.md`](file:///c:/Users/Admin/workspace/git/acc/.agents/rules/02-unified-sandbox.md)
- [`.agents/rules/01-workspace-specific.md`](file:///c:/Users/Admin/workspace/git/acc/.agents/rules/01-workspace-specific.md)

---

## 1. Deep Iteration & Gap Identification

After conducting an exhaustive line-by-line audit across all specifications and existing codebase implementations, several critical cross-cutting requirements and edge conditions need explicit planning:

### Gap 1: Unified Sandbox Platform Integration Mandate
- **Rule Check**: `.agents/rules/02-unified-sandbox.md` strictly forbids isolated mocks and mandates that every mock endpoint must be registered in `apps/console/src/core/sandbox/`.
- **Finding**: Currently, `metadataSandboxAdapter.ts` handles `/entity-types`, `/relationship-types`, and `/records`, but has **no handlers** for `/api/v1/metadata/blueprints` or `/api/v1/metadata/tenants/provision`.
- **Enhancement Needed**: When developing or testing in dev mode (`pnpm dev:sandbox` or without live backend), the blueprint catalog and tenant provisioning must seamlessly simulate cloning into `mockMetadataStore` with instant cache reflection, and support stateful in-memory reset via `handleResetAllData`.

### Gap 2: SVG/Canvas Interactive Graph vs. Dependency Footprint
- **Rule Check**: `apps/console/package.json` does **not** have `@xyflow/react` or `reactflow` installed, and `.agents/rules/00-generic-common.md` strictly enforces **"Zero Unauthorized Installs: DO NOT introduce new external libraries, packages, or frameworks without explicit human authorization."**
- **Finding**: While the guide conceptually references "React Flow" for graph preview, Acc's design system already has SVG/Bento graph nodes and Lucide DAG representations in `RelationshipTypesManager`.
- **Enhancement Needed**: Implement a bespoke, zero-dependency **Liquid Glass SVG Graph Canvas** (`blueprint-graph-canvas.tsx`). It visualizes entity nodes, directional spline curves for relationship edges, cardinality tags (`1:N`, `N:N`), and hover tooltips without adding a 200KB bundle dependency!

### Gap 3: Pre-Login vs. Post-Login Security Permissions for Blueprints
- **Finding**: In `TenantProvisioningController.java`:
  ```java
  @GetMapping("/blueprints")
  @PreAuthorize("hasAuthority('METADATA_SCHEMA_READ') or hasAuthority('METADATA_SCHEMA_WRITE') or hasRole('ADMIN')")
  ```
  This endpoint is currently protected by JWT authorities! An unauthenticated visitor on the Public Landing Page (`/`) would receive HTTP 401/403 when trying to view the Blueprint Carousel.
- **Enhancement Needed**: Introduce a dedicated public catalog endpoint `GET /api/v1/public/blueprints` (or configure Spring Security to permit anonymous GET requests to `/api/v1/metadata/blueprints`), and add `GET /api/v1/public/blueprints/{id}` so visitors can inspect templates before registration.

### Gap 4: Seeded Demo Records & Data Explorer Cold Start
- **Finding**: When a user selects a template (e.g. Headless CMS) and lands in the workspace, having empty tables still feels slightly bare.
- **Enhancement Needed**: Add an optional `BlueprintManifest.sampleRecords` block to blueprint manifests (e.g., 2 sample articles: *"Welcome to Acc CMS"*, 2 categories: *"Engineering"*, *"Announcements"*). Provisioning can optionally seed these demo records so the user lands immediately on a fully populated, beautiful Bento Data Grid!

### Gap 5: Collision Avoidance & Idempotent Multi-Template Importing
- **Finding**: What if a tenant with existing models imports another blueprint (e.g., already has `Articles` and imports `Fleet Logistics`, or imports a template with a model named `users`)?
- **Enhancement Needed**: In `TenantProvisioningService`, check for system name collisions (`existingModelNames.contains(bType.systemName())`). If collision exists, suffix with `_imported` or skip cleanly without failing the entire transaction.

---

## 2. Master Implementation Plan Breakdown (Phases 1 to 4)

We now update and enrich `apps/console/doc/implementation_plan_62.md` with these architectural enhancements.
