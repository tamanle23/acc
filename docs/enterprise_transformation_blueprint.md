# Transforming Functioning Applications into an Enterprise-Grade Quality System
**Architectural Blueprint & Transformation Strategy for `@acc` Monorepo**

---

## 1. Design Strategy

Moving from a **working prototype or functioning software** to an **enterprise-grade quality system** requires shifting focus from feature delivery to operational excellence, multi-tenant database isolation, zero-downtime resilience, deterministic security, high observability, and strict architectural governance.

In the context of the **`@acc` monorepo**—comprising Java 21 / Spring Modulith backends (`@acc/backend`), React 19 / Vite web apps (`@acc/console`), Next.js portals (`tekgo-ui`), Expo mobile apps (`mobile-ui`), Electrobun desktop apps (`@acc/desktop`), and shared Liquid Glass UI packages (`@acc/ui`)—the design strategy rests on six core pillars:

### Pillar I: Zero-Trust & Defensive System Boundaries
* **Strict Decoupling via Facades & Mediators**: Frontends must never directly tie UI components to network APIs or raw state stores. All data access must pass through typed Facades (custom TanStack Query hooks) and Zustand Mediators.
* **Unified Sandbox & Offline First Simulation**: Synthetic data and sandbox mocks (`apps/console/src/core/sandbox/`) mirror real backend behavior with zero network leakage in DEV/TEST environments.
* **Contract-First API Architecture**: OpenAPI schemas and JSON Schema (Draft-07) define immutable contracts between client and server, backed by strict client-side (`ajv`) and server-side (`json-schema-validator`) validation.

### Pillar II: Multi-Tenant Isolation & Zero Data Leakage
* **PostgreSQL Row-Level Security (RLS)**: Enforce strict tenant isolation directly at the database layer using `app.current_tenant_id` session variables and RLS policies on all dynamic entities and relationships (`tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`).
* **TenantContext Lifecycle & MDC Propagation**: Sanitize `X-Tenant-ID` headers to prevent header spoofing (`HeaderSanitizerFilter`), extract tenant claims from JWTs, and propagate context through Spring's `TenantContextHolder` and SLF4J MDC logging across sync/async boundaries (`AsyncContextTaskDecorator`).
* **System Immutability Guards**: Guard common system-level schemas (`tenant_id IS NULL` or `SYSTEM` scope) with read-only badges and modification protection across API endpoints and UI controllers.

### Pillar III: Resilient Modulith & Dynamic Metadata Engine
* **Spring Modulith Boundaries**: Enforce strict package boundaries in `@acc/backend` (`ApplicationModules.verify()`) to eliminate cyclic cross-module dependencies.
* **Dual-Layer Composite Cache Fabric**: Maintain dual-layered schema caching with composite version keys (`schema:{tid}:{type}:v{tVer}_s{sVer}`) combining L1 in-memory `ConcurrentHashMap` with L2 Redis caching and Spring Modulith event invalidation.
* **Hybrid Dynamic Metadata Invariants**: Partial unique indexes conditioned on `WHERE "deletedDate" IS NULL` ensure sub-millisecond dynamic attribute lookups without soft-delete collisions.

### Pillar IV: Noisy Neighbor Defense & Regulatory Compliance
* **3-Tier Resource Protection**:
  - *Tier 1 (API Ingress)*: Bucket4j / Redis token-bucket rate limiting (100 req/min free, 1000 req/min pro).
  - *Tier 2 (Schema Execution)*: ReDoS defense with 50ms regex timeout bounds (`TimeoutCharSequence`) and schema complexity caps (max 50 attributes, max 5 nesting depth).
  - *Tier 3 (Database)*: PostgreSQL 3000ms `statement_timeout` per tenant session.
* **GDPR Compliance Pipelines**:
  - *Art. 20 (Streaming Export)*: Non-blocking JSON/CSV ZIP streaming pipeline bypassing memory accumulation.
  - *Art. 17 (Hard Purge)*: 5-stage micro-batch hard-purge pipeline (Soft-delete -> Dependency Cascade -> RLS Wipe -> Cache Shredding -> Certificate of Erasure Generation).

### Pillar V: Unified Visual, Micro-UX & WCAG 2.2 AA Standards
* **Liquid Glass Design System Governance**: Centralize UI design tokens in `packages/ui` (`GlassCard`, `GlassButton`, frosted blurs, specular sheen) and maintain strict synchronization with `DESIGN.md` and `ROUTE.md` across all clients.
* **Universal Accessibility & i18n Synchronization**: Enforce WCAG 2.2 AA contrast rules (>= 4.5:1 text, >= 3:1 glass borders), scroll-padding for sticky headers, 24px target touch sizes (SC 2.5.8), and mandatory locale key synchronization across `en` and `vi` in `packages/i18n`.

### Pillar VI: Continuous Governance & Rule SOP
* **Rule Standard Operating Procedure (SOP)**: Multi-tiered rule management with `docs/master_rules_reference.md` as the authoritative source of truth, distilled into active constraints (`.agents/rules/`).
* **App-Specific Artifact Tracking**: Paired implementation plans and walkthroughs (`apps/<app>/doc/implementation_plan_NN.md` and `walkthrough_NN.md`) maintain full traceability across iterations.

---

## 2. Architecture

The target enterprise architecture organizes the system into multi-layered, highly decoupled tiers with strict multi-tenant boundaries:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     ENTERPRISE CLIENT LAYER                                      │
├──────────────────────────┬─────────────────────────┬───────────────────┬─────────────────────────┤
│    @acc/console      │        tekgo-ui         │     mobile-ui     │    @acc/desktop     │
│ (React 19 / Vite 8 Web)  │  (Next.js 15 App Router)│  (Expo SDK 57)    │  (Electrobun Desktop)   │
├──────────────────────────┴─────────────────────────┴───────────────────┴─────────────────────────┤
│                                  SHARED DESIGN & I18N FABRIC                                    │
│   ┌──────────────────────────────────────────────┐ ┌─────────────────────────────────────────┐   │
│   │  @acc/ui (Liquid Glass & WCAG 2.2 AA)    │ │  @acc/i18n (Sync Locales: EN / VI)  │   │
│   └──────────────────────────────────────────────┘ └─────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                UNIFIED CLIENT MEDIATOR & SANDBOX                                 │
│   ┌──────────────────────────────────────────────┐ ┌─────────────────────────────────────────┐   │
│   │  Zustand UI Stores & Facade Hooks            │ │  Unified Sandbox (Axios/Fetch Interceptor)│   │
│   └──────────────────────────────────────────────┘ └─────────────────────────────────────────┘   │
└──────────────────────────────┬───────────────────────────────────────────────────┘
                                               │ HTTPS / REST (X-Tenant-ID, Bearer JWT)
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ENTERPRISE BACKEND GATEWAY                                    │
│   ┌──────────────────────────────────────────────┐ ┌─────────────────────────────────────────┐   │
│   │ HeaderSanitizerFilter (Strip Unverified Headers)│ │ Tier 1 Rate Limiter (Bucket4j/Redis)  │   │
│   └──────────────────────────────────────────────┘ └─────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                 SPRING MODULITH BACKEND ENGINE                                   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌──────────────────────────────────┐  │
│  │  Tenant Context Holder  │  │ Dynamic Metadata Engine │  │ Blueprint & Provisioning Engine  │  │
│  │  (JWT Claims & MDC)     │  │ (Hybrid JSONB + Draft-07)│  │ (Domain Blueprints & Catalog)    │  │
│  └─────────────────────────┘  └─────────────────────────┘  └──────────────────────────────────┘  │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ Tier 2 ReDoS Guard      │  │ GDPR Export & Purge     │  │ PayOS Billing & Entitlements     │  │
│  │ (50ms Timeout Regex)    │  │ (Streaming ZIP & Purge) │  │ (Subscription Tier Guards)       │  │
│  └─────────────────────────┘  └─────────────────────────┘  └──────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Event Bus & Async Sagas (@TransactionalEventListener + ApplicationEventPublisher)          │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                   PERSISTENCE & CACHING LAYER                                    │
│  ┌──────────────────────────────────────────────┐ ┌──────────────────────────────────────────┐  │
│  │ PostgreSQL 16 + RLS (app.current_tenant_id)  │ │ Composite Cache Fabric (L1/L2 Redis)     │  │
│  │ Partial Indexing (WHERE "deletedDate" IS NULL)│ │ Key: schema:{tid}:{type}:v{tVer}_s{sVer} │  │
│  └──────────────────────────────────────────────┘ └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Key Patterns & Invariants

1. **Multi-Tenant Row-Level Security (RLS)**:
   - Every tenant transaction sets `SET LOCAL app.current_tenant_id = '<tenant_uuid>'` via Spring `@Transactional` aspect (`TenantSecurityAspect`).
   - PostgreSQL RLS policies enforce isolation transparently: `CREATE POLICY tenant_isolation_policy ON acc_entities USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);`.
2. **Facade & Mediator Pattern (Frontend)**:
   - React components interact with typed query/mutation hooks (`useEntityQuery`, `useEntityMutation`) and Zustand stores using granular selectors to prevent unnecessary re-renders.
3. **Spring Modulith & ResolvableType Dynamic Dispatch**:
   - Internal module boundaries verified via `ApplicationModules.verify()`.
   - CQRS command handles resolve generic dynamic types using `org.springframework.core.ResolvableType` to maintain CGLIB proxy compatibility over `@Transactional` beans.
4. **Composite Cache Fabric & Version Dual-Keys**:
   - Cache keys incorporate tenant ID, entity type, tenant schema version, and system schema version: `schema:{tid}:{type}:v{tVer}_s{sVer}`.
   - Spring Modulith event listeners handle cross-instance cache eviction upon attribute or schema definition updates.
5. **Noisy Neighbor & ReDoS Defense**:
   - Regex validation during record insertion executes within a 50ms CPU timeout using `TimeoutCharSequence` wrappers to neutralize ReDoS attacks.
   - Database queries carry session-level `statement_timeout = 3000` to prevent unindexed JSONB queries from stalling shared connection pools.

---

## 3. Implementation Blueprint & Phase Roadmap

The enterprise transformation strategy is structured into nine completed and evolving tactical execution phases:

### Phase 1: Core Quality Infrastructure, Rule SOP & WCAG 2.2 AA Compliance
* **Status**: Completed
* **Objectives**: Establish automated Turborepo pipelines, Rule SOP governance, and WCAG 2.2 AA visual compliance.
* **Key Deliverables**:
  1. Turborepo pipeline optimization (`turbo.json`) with caching for `build`, `test`, `lint`, and `check-types`.
  2. Rule SOP implementation (`docs/master_rules_reference.md` & `.agents/rules/`).
  3. Pre-commit check standardization (`pre_commit_instructions`).
  4. WCAG 2.2 AA compliance: Contrast ratio adjustments (>= 4.5:1 text, >= 3:1 borders), global `scroll-padding-top`, and 24px minimum touch targets (SC 2.5.8).

### Phase 2: Multi-Tenant Database Isolation & Row-Level Security (RLS)
* **Status**: Completed
* **Objectives**: Implement row-level multi-tenant database isolation with zero cross-tenant leakage.
* **Key Deliverables**:
  1. Denormalization of `tenant_id` across dynamic entities, attributes, and relationship mapping tables.
  2. PostgreSQL Row-Level Security (RLS) policies using `app.current_tenant_id`.
  3. Spring `TenantSecurityAspect` executing `SET LOCAL app.current_tenant_id` at transaction boundaries.
  4. Soft-delete partial unique indexes (`WHERE "deletedDate" IS NULL`) preventing duplicate key constraints on soft-deleted metadata.

### Phase 3: Tenant Identity, JWT Claims & MDC Context Lifecycle
* **Status**: Completed
* **Objectives**: Secure ingress HTTP requests, extract tenant claims, and propagate context.
* **Key Deliverables**:
  1. `HeaderSanitizerFilter` stripping unverified `X-Tenant-ID` headers from untrusted external requests.
  2. Spring Security JWT claim extraction (`tid`, tenant permissions, role scopes).
  3. `TenantContextHolder` storing thread-local tenant identity with guaranteed lifecycle cleanup in `finally` blocks.
  4. MDC logging integration (`tenant_id`, `user_id`, `trace_id`) and `AsyncContextTaskDecorator` for `@Async` thread pool context propagation.

### Phase 4: Dual-Layer Composite Cache Fabric & Schema Versioning
* **Status**: Completed
* **Objectives**: High-throughput dynamic schema resolution with zero-downtime invalidation.
* **Key Deliverables**:
  1. Dual-layer caching: L1 parsed schema `ConcurrentHashMap` + L2 Redis JSON cache.
  2. Versioned composite cache keys: `schema:{tid}:{type}:v{tVer}_s{sVer}`.
  3. System-level schema immutability protection preventing modification of common schemas (`tenant_id IS NULL`).
  4. Spring Modulith `@TransactionalEventListener` clearing L1/L2 caches upon schema updates.

### Phase 5: Console UI Dual-Mode Context Switching
* **Status**: Completed
* **Objectives**: Deliver distinct operational perspectives for platform administrators and business operators.
* **Key Deliverables**:
  1. Dual-Mode UI toggle in `@acc/console`: **Architect Studio** (schema modeling) vs. **Operator View** (data execution).
  2. Permission-based UI element visibility (`SYSTEM_ADMIN`, `TENANT_ADMIN`, `OPERATOR`).
  3. `SYSTEM` immutability badges on common platform schemas.
  4. Real-time form schema inspection and Draft-07 JSON Schema validation debugging tools.

### Phase 6: Domain Blueprint Catalog Seeding & Atomic Tenant Provisioning Engine
* **Status**: Completed
* **Objectives**: Automated tenant onboarding and industry-specific domain blueprint provisioning.
* **Key Deliverables**:
  1. Domain Blueprint manifests (`classpath:metadata/blueprints/*.json`) covering Headless CMS, E-Commerce, Logistics, and CRM domains.
  2. `BlueprintCatalogService` parsing, validating, and serving catalog templates.
  3. `TenantProvisioningService` executing atomic tenant workspace provisioning, attribute seeding, and schema pre-warming within a single database transaction.

### Phase 7: Noisy Neighbor Defense, Resource Quotas & ReDoS Protection
* **Status**: Completed
* **Objectives**: Shield multi-tenant infrastructure against tenant resource starvation, expensive queries, and regular expression DoS attacks.
* **Key Deliverables**:
  1. *Tier 1*: Bucket4j / Redis token-bucket rate limiter returning `HTTP 429 Too Many Requests` with `Retry-After` headers.
  2. *Tier 2*: ReDoS regex execution defense using 50ms `TimeoutCharSequence` wrappers and schema complexity limits (max 50 attributes, max 5 nesting depth).
  3. *Tier 3*: PostgreSQL 3000ms `statement_timeout` per tenant session.
  4. Console UI indicators highlighting resource usage and pre-flight ReDoS validation warnings.

### Phase 8: Streaming Data Export (GDPR Art. 20) & Micro-Batch Hard-Purge Pipeline (GDPR Art. 17)
* **Status**: Completed
* **Objectives**: Fully automated data portability and "Right to be Forgotten" regulatory compliance pipelines.
* **Key Deliverables**:
  1. Non-blocking streaming ZIP export pipeline generating JSON/CSV payloads for GDPR Art. 20 compliance.
  2. 5-stage micro-batch hard-purge pipeline (GDPR Art. 17): Soft-Delete Flagging -> Dependency Graph Cascade -> RLS-Isolated Table Wipe -> L1/L2 Cache Shredding -> Cryptographic Certificate of Erasure Receipt Generation.
  3. Console UI GDPR modal with step-by-step progress tracking and Certificate of Erasure download.

### Phase 9: PayOS Billing Integration, Subscription Tier Entitlements & Scale-Out
* **Status**: Active / In Progress
* **Objectives**: Commercial monetization, payment gateway webhooks, subscription tier feature gating, and multi-region scale-out.
* **Key Deliverables**:
  1. PayOS payment gateway integration for automated subscription billing and tier upgrades (`FREE`, `PRO`, `ENTERPRISE`).
  2. Dynamic feature entitlement enforcement based on tenant subscription tier.
  3. Automated tenant usage telemetry and billing webhook reconciliation.

---

## 4. Extensibility (OCP - Open/Closed Principle)

To ensure the system is **open for extension but closed for modification**, the architecture incorporates explicit open-extension points across all layers:

### 1. Domain Blueprint Catalog Extension
* **Extension Mechanism**: Introducing new industry domain blueprints requires only adding a JSON manifest file under `apps/backend/acc-fw/src/main/resources/metadata/blueprints/`.
* **OCP Compliance**: The `BlueprintCatalogService` automatically discovers, validates, and registers new blueprints at startup without altering core provisioning or backend logic.

### 2. Dynamic Attribute & Widget Registry Engine
* **Extension Mechanism**: The dynamic metadata engine allows defining new entity attributes, UI widgets (`ui_schema`), and validation rules without touching Java code or redeploying microservices.
* **OCP Compliance**:
  ```tsx
  // packages/ui/src/dynamic-form/widget-registry.ts
  export interface WidgetProps {
    value: unknown;
    onChange: (val: unknown) => void;
    schema: AttributeSchema;
  }

  // Registering a new custom widget without modifying the form engine
  export const WidgetRegistry = new Map<string, React.ComponentType<WidgetProps>>();
  export function registerWidget(type: string, component: React.ComponentType<WidgetProps>) {
    WidgetRegistry.set(type, component);
  }
  ```

### 3. Plug-and-Play AI Agent MCP Tools
* **Extension Mechanism**: The AI Agent bridge inspects active entity definitions at runtime and translates their compiled Draft-07 JSON Schemas into Model Context Protocol (MCP) tool specifications.
* **OCP Compliance**: Creating a new dynamic entity type automatically exposes corresponding query, create, update, and graph tools to AI agents without altering tool invocation routines.

---

## 5. Summary & Enterprise Quality Metrics

Transforming `@acc` into an enterprise-grade quality platform equips the system to deliver sub-second multi-tenant dynamic queries, zero cross-tenant data leakage, strict WCAG 2.2 AA accessibility, automated GDPR compliance, and resilient multi-tier protection.

### Target Enterprise Quality KPIs
* **Tenant Isolation Leakage**: `0` cross-tenant data access breaches (verified by PostgreSQL RLS integration tests).
* **Schema Resolution Throughput**: `< 1ms` L1 in-memory cache hit, `< 10ms` L2 Redis resolution.
* **Noisy Neighbor Defense Response**: `< 50ms` ReDoS regex abort, `HTTP 429` with `Retry-After` on rate limit breach.
* **Accessibility Compliance**: `100%` WCAG 2.2 AA pass rate across all console and portal screens.
* **GDPR Compliance Pipelines**: Streaming data export capable of generating multi-gigabyte ZIP archives without memory starvation; 5-stage hard-purge producing verified Certificate of Erasure receipts.
