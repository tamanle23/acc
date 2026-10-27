# Master Plan: Comprehensive Backend Unified Sandbox Guide (Iteration 9)

## 1. Goal & Architecture Overview
Author an authoritative, comprehensive 360° technical and developer guide in `apps/backend/acc-sandbox/README.md` explaining how to configure, run, and develop against the **Backend Unified Sandbox Platform**, covering both zero-database persona JWT authentication and database-seeded user credentials.

---

## 2. Core Guiding Principles & Invariants

1. **Zero-Stub Mandate**:
   - Strictly enforces that offline dev and automated tests run against genuine production classes and an authentic embedded PostgreSQL engine (`pglite-spring-boot-test`).
   - Zero synthetic stubs or deterministic pass-throughs for multi-tenancy, Row-Level Security (RLS), and JSONB schema evolution.
2. **Dual Operating Modes**:
   - **Mode 1: Test Mode**: Ephemeral in-memory database (`jdbc:pglite:memory://`), instantaneous mock execution, zero latency jitter, clean test rollback per slice.
   - **Mode 2: Dev Mode**: Persistent local scratch database (`tmp/db/pglite-sandbox`), realistic payment jitter (2000ms), pre-warmed demonstration datasets (Acme Corp CRM + CMS Publishing with 1,000+ records).
3. **Decoupled Packaging**:
   - Completely packaged within `acc-sandbox` module. When `application.sandbox.enabled=false`, zero sandbox beans or interceptors are registered in Spring's `ApplicationContext`.
4. **Zero-Endpoint Persona Authentication**:
   - `SandboxTokenAspect` issues cryptographically valid JWTs matching production security invariants without touching database user tables.

---

## 3. Outline of the Comprehensive Guide (`apps/backend/acc-sandbox/README.md`)

1. **Executive Overview & Philosophy**:
   - Zero-stub mandate: Why fake mocks and synthetic pass-throughs are prohibited.
   - Genuine embedded PostgreSQL engine with real Row-Level Security (RLS) enforcement.
   - Dual operating modes (`DEV` vs `TEST`).
   - Non-invasive decoupling (`application.sandbox.enabled=false` guarantees zero production footprint).

2. **System Architecture & Design Patterns**:
   - Mermaid sequence & component diagrams showing the interaction between `acc-ms-aio`, `acc-sandbox`, embedded PGlite, and client applications.
   - Pattern breakdown:
     - **Strategy Pattern**: `ExternalServiceSimulator<T>` SPI.
     - **Registry Pattern**: `BackendSandboxRegistry`.
     - **Transparent Decorator / Proxy (`@Primary`)**: `InMemoryStorageConnector` & `MockWebhookDeliveryService`.
     - **AOP Interception**: `PayOsCheckoutInterceptorAspect` & `SandboxTokenAspect`.
     - **Batch Memento & Seed Generator**: `SandboxDataPreWarmer` & `CmsDataScaffoldingGenerator`.

3. **Dual Operating Modes Matrix**:
   - Comparison table: `DEV Mode` vs `TEST Mode` (Datasource persistence, port binding, latency jitter, scheduled dispatchers, seed execution).
   - Scratch storage mechanics: `tmp/db/pglite-sandbox` vs `jdbc:pglite:memory://`.
   - Pristine reset switch: `application.sandbox.dev.pristine=true`.

4. **Developer Run Commands & CLI Recipes**:
   - Monorepo root shortcuts: `pnpm dev:sandbox`, `pnpm dev:backend:sandbox`, `pnpm dev:console:sandbox`, `pnpm test:e2e:live`.
   - Backend package scripts: `pnpm --filter @acc/backend dev:sandbox`, `dev:sandbox:persistent`, `dev:sandbox:pristine`, `dev:sandbox:test`, `test:sandbox`.
   - Maven CLI direct invocation commands with JVM arguments (`-Djava.net.preferIPv4Stack=true`).

5. **Boundary Simulators Reference**:
   - **PayOS VietQR Simulator (`PayOsSimulator`)**: HMAC-SHA256 signature generation, auto-confirm scheduled callbacks (2000ms delay in DEV, 0ms in TEST).
   - **In-Memory Storage Simulator (`InMemoryStorageSimulator`)**: S3/MinIO bucket & object storage, MD5 calculation, byte stream retrieval.
   - **Mock Outbox Webhook Dispatcher (`MockWebhookDispatcher`)**: Outgoing webhook interception, edge revalidation payload recording, inspection APIs.

6. **Authentication & Authorization Cheatsheet**:
   - **Path A: Zero-Database Sandbox Personas** (`SandboxTokenAspect` issuing genuine cryptographic JWTs):
     - Sovereign Custodian (`system-custodian` / `admin123` -> `SYSTEM` tenant, `ROLE_SYSTEM_CUSTODIAN`)
     - Tenant Admin (`tenant-admin` / `admin123` -> `tenant-acme`, `ROLE_ADMIN`)
     - Creator (`tenant-creator` / `creator123` -> `tenant-acme`, `ROLE_CREATOR`)
     - Standard User (`tenant-user` / `user123` -> `tenant-acme`, `ROLE_USER`)
     - Universal bypass fallback: password `"bypass"` resolves to `admin`.
   - **Path B: Database-Seeded Users** (Liquibase seeded users in `UNIPOST_USER`):
     - `admin` (password: `admin123`, role: `admin`)
     - `anonymous` (password: `admin123`, role: `ANONYMOUS`)
     - `user_1` to `user_7` (password: `admin123`, roles: `role_1` to `role_7`)
   - **Interactive Testing Recipes**:
     - `curl` commands for logging in via `/api/auth/token`.
     - `curl` queries testing multi-tenant metadata endpoints (`/api/v1/metadata/entity-types`) and RLS isolation.
     - `curl` requests triggering simulated VietQR billing checkout and verifying auto-confirmed webhook delivery.

7. **Demonstration Dataset & High-Volume CMS Scaffolding**:
   - Pre-warmed schemas: `bp_crm_billing_v1` (Customer Accounts) + `bp_cms_publishing_v1` (Articles, Categories, Media Assets).
   - High-volume CMS generator: 1,000+ Articles, 50 Categories, 200 Media Assets with relational graph edges.
   - PostgreSQL RLS session context (`SET LOCAL app.current_tenant_id = 'tenant-acme'`).

8. **Datasource Configuration (Embedded PGlite vs External PostgreSQL)**:
   - Default zero-dependency local embedded mode (`tmp/db/pglite-sandbox`).
   - Recipe for pointing DEV sandbox to external PostgreSQL (e.g., Docker container) via standard Spring datasource properties while preserving external service simulators.

9. **Extending the Sandbox (Custom Simulator SPI Guide)**:
   - Tutorial on implementing `ExternalServiceSimulator<T>` SPI for new boundaries (e.g., `MockSmsSimulator`, `MockOidcSimulator`).
   - Registering simulator in Spring context and `BackendSandboxRegistry`.
   - Writing tests and exposing reset hooks.

10. **Configuration Properties Reference Table**:
    - Exhaustive table of all `application.sandbox.*` configuration keys, types, defaults, and descriptions.

11. **Troubleshooting & FAQ**:
    - What happens if port 8000 is occupied?
    - How to wipe corrupted persistent PGlite state?
    - How to verify that real production builds exclude sandbox dependencies?

---

## 4. Verification Plan

1. Verify Markdown lint and link integrity.
2. Cross-reference all properties with `SandboxProperties.java` and all commands with `package.json`.
3. Create history record and git commit following Rule 6.
