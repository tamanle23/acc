# Multi-Tenant Dynamic Metadata Architecture: Phased Implementation Plan

**Series:** Multi-Tenant Architecture Blueprint Series (Document 00 / Master Implementation Plan)  
**Target Systems:** `@acc/backend` (Spring Modulith / Java 21 / PostgreSQL 16+ / payOS), `@acc/console` (React 19 / Vite 8 / TanStack Router)  
**Based On:** Technical Specifications Parts 1 through 10 (`docs/multi-tenants/01-10`)  
**Status:** Canonical Implementation Roadmap & Execution Plan  

---

## 1. Executive Phasing Strategy & Critical Order Rationale

In accordance with user directives, the implementation plan prioritizes the **Public Landing Page, Subscriptions Showcase & payOS Onboarding Funnel (Phase 1)** as the first deliverable. This establishes the commercial front door, user discovery experience, and self-service registration before layering in deep database isolation, security filters, and metadata studio tooling.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION PHASING (FRONT-DOOR FIRST)                       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1 [FRONT DOOR]: Unipost Landing Page, Plans & payOS VietQR Onboarding (Part 10)  │
│ ↳ [MOVED TO BACKLOG] Documented in `docs/multi-tenants/domain_blueprints_fullstack_guide.md`│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2 [CRITICAL CORE - COMPLETED]: Database Isolation & RLS (Parts 2, 7)             │
│ ↳ Tenant + SYSTEM RLS read-inheritance, scoped unique indexes, FORCE RLS, session hook │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3 [SECURITY LIFECYCLE - COMPLETED]: JWT Claims & TenantContext Pipeline (Part 4) │
│ ↳ Zero client trust, JWT `tid`, TenantContextHolder, Async TaskDecorator               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 4 [INTEGRITY & CACHE - COMPLETED]: Composite Cache Fabric & Dual-Layer (Parts 1,7│
│ ↳ Effective Schema composition, composite keys `schema:{tid}:{type}:v{tVer}_s{sVer}`   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 5 [USER EXPERIENCE - COMPLETED]: Console Dual-Mode Context Switching (Parts 3, 7)│
│ ↳ Architect Mode vs. Operator Mode, System-Locked (🔒) vs Custom (✏️) UI badges        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 6 [OPERATIONAL SCALE - COMPLETED]: Tenant Onboarding & Blueprint Catalog (Part 5)│
│ ↳ System blueprint manifests, deep-clone provisioning, decoupled schema evolution      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 7 [RELIABILITY & STABILITY - CURRENT]: Noisy Neighbor Defense & Quotas (Part 6)  │
│ ↳ Redis Token Bucket rate limiting, JSON Schema ReDoS timeouts, storage quotas         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 8 [DATA COMPLIANCE]: Streaming Export & GDPR Hard-Purge Pipeline (Part 8)        │
│ ↳ Chunked NDJSON/ZIP streaming, micro-batch deletion loop, S3/Hazelcast cache shred    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 9 [COMMERCIAL BILLING]: payOS Webhook Sync & Dynamic Feature Entitlements(Part 9)│
│ ↳ payOS HMAC verification, dynamic feature keys (`FEATURE_*`), <FeatureGate /> guards  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Unipost Landing Page, Subscriptions & payOS Onboarding Funnel (MOVED TO BACKLOG)
> **Status:** ⏳ **BACKLOG (To be implemented later)**  
> **Transferred Location:** Fully documented in [`docs/multi-tenants/domain_blueprints_fullstack_guide.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/domain_blueprints_fullstack_guide.md#6-part-5-public-landing-page-subscriptions--payos-onboarding-funnel-backlog)  
> **Reference Documents:** [`docs/multi-tenants/10_landing_page_and_onboarding_funnel.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/10_landing_page_and_onboarding_funnel.md) & [`docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md)  
> **Goal:** Build the public marketing landing page (`/`), showcase the 3 subscription tiers, integrate the Blueprint Template Carousel into the registration flow, and provide instant payOS VietQR checkout.

*See [`docs/multi-tenants/domain_blueprints_fullstack_guide.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/domain_blueprints_fullstack_guide.md) for full task specifications, mockups, and verification criteria.*

---

## 3. Phase 2: Database Isolation, System vs. Tenant Schemas & Row-Level Security
> **Priority:** 🔴 P0 (Critical Core Backend)  
> **Reference Documents:** [`docs/multi-tenants/02_multi_tenant_database_and_rls_specification.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/02_multi_tenant_database_and_rls_specification.md) & [`docs/multi-tenants/07_common_system_schemas_vs_tenant_custom_schemas.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/07_common_system_schemas_vs_tenant_custom_schemas.md)  
> **Goal:** Guarantee that data records and metadata schemas are physically and logically quarantined at the PostgreSQL engine level, while allowing global read inheritance of Common System Schemas (`SYSTEM`).

### Tasks & Deliverables:
- [ ] **Task 2.1: Liquibase Migration (`changelog-000.000.00005.xml`)**:
  - Add `tenant_id VARCHAR(255) NOT NULL` to:
    - `UNIPOST_ENTITY_TYPES`
    - `UNIPOST_ATTRIBUTE_DEFINITIONS`
    - `UNIPOST_RELATIONSHIP_TYPES`
    - `UNIPOST_ENTITY_RELATIONSHIPS`
  - Backfill existing data with default tenant identifier (`default-tenant`).
- [ ] **Task 2.2: Tenant-Scoped Uniqueness Indexes**:
  - Drop global `uk_entity_type_sysname_active` and create `(tenant_id, system_name)` partial unique index `WHERE "deletedDate" IS NULL`.
  - Drop global `uk_attr_def_type_sysname_active` and create `(tenant_id, entity_type_id, system_name)` partial unique index `WHERE "deletedDate" IS NULL`.
  - Add composite index on `UNIPOST_ENTITIES (tenant_id, entity_type_id) WHERE "deletedDate" IS NULL`.
- [ ] **Task 2.3: PostgreSQL FORCE Row-Level Security Policies with System Read Inheritance**:
  - Execute `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` across all 5 metadata/record tables.
  - On Metadata Tables (`ENTITY_TYPES`, `ATTRIBUTE_DEFINITIONS`, `RELATIONSHIP_TYPES`):
    - `USING (tenant_id = current_setting('app.current_tenant_id') OR tenant_id = 'SYSTEM')`
    - `WITH CHECK (tenant_id = current_setting('app.current_tenant_id') AND tenant_id != 'SYSTEM')`
  - On Data Table (`UNIPOST_ENTITIES`):
    - `USING (tenant_id = current_setting('app.current_tenant_id'))`
    - `WITH CHECK (tenant_id = current_setting('app.current_tenant_id'))`
- [ ] **Task 2.4: Spring Modulith Transaction Interceptor**:
  - Implement `TenantSessionAspect` / HikariCP connection wrapper executing `SET LOCAL app.current_tenant_id = :tenantId` at the beginning of each transaction.

### Verification Gate:
- Write an autogenerated test attempting cross-tenant access with a raw repository query without a `WHERE tenant_id` clause. PostgreSQL RLS must return 0 rows or throw an isolation violation.

---

## 4. Phase 3: Cryptographic JWT Claims & TenantContext Lifecycle
> **Priority:** 🔴 P0 (Critical Security)  
> **Reference Document:** [`docs/multi-tenants/04_tenant_identity_jwt_and_context_lifecycle.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/04_tenant_identity_jwt_and_context_lifecycle.md)  
> **Goal:** Eliminate client parameter trust (IDOR prevention) and bind authenticated tenant identity to execution threads.

### Tasks & Deliverables:
- [ ] **Task 3.1: Header Sanitization**:
  - Implement `HeaderSanitizerFilter` in Spring Security filter chain to strip external `X-Tenant-Id` headers.
- [ ] **Task 3.2: JWT Verification & Custom Claims**:
  - Update `JwtAuthenticationTokenFilter` to parse custom claim `tid` (tenant ID) and `permissions`.
  - Instantiate `TenantAuthenticationToken` carrying the verified tenant principal.
- [ ] **Task 3.3: `TenantContextHolder` ThreadLocal Pipeline**:
  - Create `TenantContextHolder` with `setTenantId()`, `getRequiredTenantId()`, and `clear()`.
  - Enforce cleanups in `TenantContextBindingFilter.doFilterInternal()` inside a strict `try/finally` block.
- [ ] **Task 3.4: Asynchronous & Modulith Task Decorators**:
  - Implement `TenantAwareTaskDecorator` to propagate `tenantId`, `SecurityContext`, and SLF4J MDC to `@Async` thread pools and Spring Modulith asynchronous event handlers.
- [ ] **Task 3.5: Method Security Annotations**:
  - Annotate metadata controllers with `@PreAuthorize("hasAuthority('metadata:schema:write')")` and record controllers with `@PreAuthorize("hasAuthority('entity:record:write')")`.

### Verification Gate:
- Verify that sending an HTTP request with a mismatched `tenant_id` payload is ignored, and the record is stamped strictly with the JWT's `tid`. Verify context does not leak between concurrent threads.

---

## 5. Phase 4: Composite Cache Fabric & Dual-Layer Versioning
> **Priority:** 🟠 P1 (High Integrity)  
> **Reference Documents:** [`docs/multi-tenants/01_multi_tenant_architecture_specification.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/01_multi_tenant_architecture_specification.md) & [`docs/multi-tenants/07_common_system_schemas_vs_tenant_custom_schemas.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/07_common_system_schemas_vs_tenant_custom_schemas.md)  
> **Goal:** Isolate compiled Draft-07 JSON Schema caches so that tenant schema mutations never cause cross-tenant cache stampedes or thrashing.

### Tasks & Deliverables:
- [ ] **Task 4.1: Composite Cache Key Namespace**:
  - Update `SchemaValidationService` and Hazelcast/Redis cache configurations to use the composite key pattern:
    `schema:{tenant_id}:{system_name}:v{tenantVer}_s{systemVer}`
- [ ] **Task 4.2: Atomic Schema Version Increments**:
  - Ensure every attribute definition mutation (`create`, `update`, `reorder`, `archive`) increments `UNIPOST_ENTITY_TYPES.schema_version` in the same database transaction.
- [ ] **Task 4.3: Effective Schema Composition**:
  - Dynamically composite System base fields (`SYSTEM`) with Tenant custom overlay fields on cache misses.

### Verification Gate:
- Benchmark concurrent reads of Tenant B's schema while Tenant A continuously adds and reorders attributes. Tenant B's cache hit rate must remain 100% with zero cache invalidations.

---

## 6. Phase 5: Console UI Dual-Mode Context Switching
> **Priority:** 🟠 P1 (Front-End & Ergonomics)  
> **Reference Documents:** [`docs/multi-tenants/03_multi_tenant_console_context_switching.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/03_multi_tenant_console_context_switching.md) & [`docs/multi-tenants/07_common_system_schemas_vs_tenant_custom_schemas.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/07_common_system_schemas_vs_tenant_custom_schemas.md)  
> **Goal:** Provide seamless context switching between "Architect Studio" (schema modeling) and "Operator View" (business data entry) in `@acc/console`.

### Tasks & Deliverables:
- [ ] **Task 5.1: Store State Expansion (`use-metadata-ui-store.ts`)**:
  - Add `activeTenantId`, `currentUserRole`, `workspaceMode` (`architect` | `operator`), and selectors `canManageSchema()`.
  - Add `toggleWorkspaceMode()` with safe tab fallbacks (redirecting away from `schema` if mode changes to `operator`).
- [ ] **Task 5.2: Adaptive Navigation & Header Controls**:
  - In `MetadataFeature` header, render the Liquid Glass mode toggle pill for `TENANT_ADMIN` users (`🛠️ Architect Studio` vs. `👤 Operator View`).
  - Conditionally mount the `<TabsTrigger value="schema">` only when `canManageSchema()` is true.
- [ ] **Task 5.3: System Locked vs. Custom UI Badges**:
  - In `SchemaBuilder`, render 🔒 **System Core Field** badges on `SYSTEM` attributes with disabled delete/rename controls.
  - Render ✏️ **Custom Attribute** badges on tenant-created attributes with full editing actions.

### Verification Gate:
- Manual & automated UI test: An admin logs in, builds a custom attribute, flips the toggle to "Operator View", and fills out the newly generated Liquid Glass form without a page reload or auth reset.

---

## 7. Phase 6: Tenant Onboarding & Blueprint Catalog Seeding
> **Priority:** 🟡 P2 (Operational Scale)  
> **Reference Document:** [`docs/multi-tenants/05_tenant_onboarding_and_template_provisioning.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/05_tenant_onboarding_and_template_provisioning.md)  
> **Goal:** Eliminate the "blank canvas" problem by providing pre-packaged domain blueprints that seed into new tenant workspaces in $< 250\text{ ms}$.

### Tasks & Deliverables:
- [ ] **Task 6.1: Blueprint Manifest Definitions**:
  - Create declarative JSON templates in `apps/backend/acc-fw/src/main/resources/metadata/blueprints/`:
    - `logistics-fleet-blueprint.json` (Fleet Vehicle, Dispatch Order, Assigned Vehicle edge).
    - `b2b-crm-billing-blueprint.json` (Customer Account, Invoice, Line Items).
    - `blank-workspace-blueprint.json` (Empty canvas).
- [ ] **Task 6.2: Atomic Provisioning Service (`TenantProvisioningService`)**:
  - Create onboarding transaction creating tenant record, cloning blueprint entity types, cloning attribute definitions, and pre-warming initial JSON Schema cache entries.
- [ ] **Task 6.3: Decoupled Schema Evolution Invariant**:
  - Ensure cloned records are stamped with the new `tenant_id` and have zero runtime dependency on the original blueprint manifest.

### Verification Gate:
- Execute integration test: Provisioning a new tenant with the Logistics blueprint completes within 250ms, and immediate queries to `/api/v1/metadata/types` return the cloned schemas ready for record creation.

---

## 8. Phase 7: Noisy Neighbor Defense & Resource Protection
> **Priority:** 🟡 P2 (Platform Reliability)  
> **Reference Document:** [`docs/multi-tenants/06_multi_tenant_rate_limiting_and_noisy_neighbor.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/06_multi_tenant_rate_limiting_and_noisy_neighbor.md)  
> **Goal:** Safeguard shared database connections, CPU cycles, and memory buffers against runaway scripts, ReDoS attacks, or abusive queries.

### Tasks & Deliverables:
- [ ] **Task 7.1: Distributed Token-Bucket Rate Limiting**:
  - Implement Redis-backed `TenantRateLimitService` using Bucket4j, enforcing tier quotas.
  - Return HTTP 429 with `Retry-After` on quota exhaustion.
- [ ] **Task 7.2: ReDoS Protection & Schema Guardrails**:
  - Cap entity types per tenant (max 50) and attributes per entity (max 100).
  - Implement `SafeSchemaValidationService` wrapping JSON Schema validation in a timeout budget of 50ms to kill catastrophic regex backtracking.
- [ ] **Task 7.3: Database Circuit Breakers**:
  - Configure `SET LOCAL statement_timeout = '3000ms'` in the transaction aspect.
  - Enforce `depth < 10` and `LIMIT 250` on all recursive Pattern C graph queries.

### Verification Gate:
- Inject a ReDoS regex into an attribute definition and validate an input payload. Verify the validation engine aborts within 50ms without pegging the CPU. Flood the endpoint with requests and verify HTTP 429 triggers cleanly.

---

## 9. Phase 8: Streaming Export & GDPR Hard-Purge Pipeline
> **Priority:** 🟢 P3 (Compliance & Governance)  
> **Reference Document:** [`docs/multi-tenants/08_tenant_data_backup_export_and_gdpr_purge.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/08_tenant_data_backup_export_and_gdpr_purge.md)  
> **Goal:** Support GDPR Art. 20 data portability and execute complete, deadlock-free cryptographic data erasures (GDPR Art. 17).

### Tasks & Deliverables:
- [ ] **Task 8.1: Chunked Streaming Export Pipeline**:
  - Implement `TenantExportService` using Hibernate `fetchSize(1000)` cursor streaming directly to a zip multipart S3 upload stream.
- [ ] **Task 8.2: 5-Stage Micro-Batch Purge Engine**:
  - Implement stored procedure / batch worker deleting `UNIPOST_ENTITY_RELATIONSHIPS` and `UNIPOST_ENTITIES` in 5,000-row micro-transactions.
  - Wipe tenant custom attribute definitions and entity types while strictly preserving `SYSTEM` schemas.
- [ ] **Task 8.3: Cache Shredding & Certificate of Erasure**:
  - Broadcast Hazelcast cluster cache eviction for `schema:{targetTenant}:*`.
  - Issue S3 bucket prefix batch delete for `s3://.../tenants/{targetTenant}/*`.
  - Generate an immutable, anonymized `Certificate of Erasure` audit receipt.

### Verification Gate:
- Trigger export on a test tenant with 50,000 records; verify JVM memory heap remains flat (< 50MB increase). Trigger purge and verify 0 rows remain across all database tables with zero table-lock contention.

---

## 10. Phase 9: payOS Webhook Synchronization & Dynamic Feature Entitlements (Backlog)
> **Priority:** 🟢 P3 (Commercial Monetization) — ⏳ **MOVED TO BACKLOG**  
> **Consolidated Location:** [`docs/multi-tenants/domain_blueprints_fullstack_guide.md` (Part 5)](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/domain_blueprints_fullstack_guide.md#6-part-5-public-landing-page-subscriptions--payos-onboarding-funnel-backlog)  
> **Reference Document:** [`docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/09_tenant_billing_payos_and_feature_entitlements.md)  
> **Goal:** Wire real-time payOS payment confirmations to unlock dynamic feature keys.

### Tasks & Deliverables:
- [ ] **Task 9.1: Dynamic Entitlements Registry (`UNIPOST_TENANT_FEATURES`)**:
  - Create table modeling tenant dynamic capability keys (`FEATURE_SCHEMA_STUDIO`, `FEATURE_PATTERN_C_GRAPH`, `FEATURE_AI_AGENT_MCP`).
  - Implement `@RequireFeature` annotation and Spring Modulith aspect intercepting unentitled calls.
- [ ] **Task 9.2: payOS Webhook Integration (`PayOsWebhookController`)**:
  - Verify HMAC-SHA256 signatures on incoming payOS webhooks and dynamically activate tenant subscription entitlements upon transfer confirmation.
- [ ] **Task 9.3: Console UI In-App Feature Guards (`<FeatureGate />`)**:
  - Gated views render Liquid Glass upgrade prompts with 1-click VietQR payment link generation.

### Verification Gate:
- Attempt to invoke an unentitled feature endpoint; verify HTTP 403. Simulate a payOS VietQR webhook; verify the feature unlocks immediately in the UI and API without service reboot.

---

## 11. Master Milestone Summary Table

| Phase | Milestone Name | Primary Focus | Primary Tech Stack |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Landing Page & payOS Funnel** | Public showcase, 3 pricing tiers, login/register, VietQR modal | React 19, TanStack Router, Liquid Glass |
| **Phase 2** | **Physical DB Isolation & RLS** | Changesets, scoped unique indexes, FORCE RLS, session hook | PostgreSQL 16, Liquibase, Modulith |
| **Phase 3** | **Security Identity & JWT** | Cryptographic JWT `tid`, zero client trust, TaskDecorator | Spring Security 6, JJWT |
| **Phase 4** | **Composite Cache Fabric** | Isolated composite cache keys (`schema:{tid}:{type}:v{t}_s{s}`) | Hazelcast, Draft-07 JSON Schema |
| **Phase 5** | **Console Dual-Mode Studio** | Architect Studio vs. Operator View, locked vs custom badges | React 19, Zustand, Tailwind v4 |
| **Phase 6** | **Blueprint Onboarding** | Domain blueprint manifests, atomic cloning in $< 250\text{ ms}$ | Spring Modulith, JSON Blueprints |
| **Phase 7** | **Noisy Neighbor Defense** | Token Bucket rate limiting, 50ms regex kill, statement timeout | Redis, Bucket4j, Virtual Threads |
| **Phase 8** | **Streaming Export & Purge** | Non-blocking S3 ZIP streaming, 5,000-row micro-batch purge | Spring Batch, Hibernate Cursors, S3 |
| **Phase 9** | **payOS Webhooks & Entitlements**| HMAC verification, dynamic feature tokens, `<FeatureGate />` | payOS SDK, AspectJ, Webhooks |
