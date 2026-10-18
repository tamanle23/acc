# Unipost Backend Unified Sandbox Platform

> **Authoritative Technical Specification & Developer Operations Guide**  
> *Module: `apps/backend/unipost-sandbox` | Target Monolith: `unipost-ms-aio`*

---

## 1. Executive Overview & Guiding Philosophy

The **Backend Unified Sandbox Platform** provides a completely offline, zero-dependency, local execution environment for the Unipost backend platform (`unipost-ms-aio`). It allows developers, automated integration suites, and end-to-end browser tests to execute authentic multi-tenant business flows with genuine security checks, SQL queries, and JSONB operators—**without requiring external cloud dependencies, live third-party APIs (PayOS, MinIO/S3), or external database servers**.

### Core Invariants

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE GUIDING INVARIANTS                         │
├────────────────────────────────────────────────────────────────────────┤
│ 1. ZERO-STUB MANDATE: Tests & dev runs MUST exercise authentic         │
│    production classes, filters, and engines. Synthetic mocks/stubs     │
│    for RLS, multi-tenancy, or cryptographic tokens are PROHIBITED.     │
│                                                                        │
│ 2. EMBEDDED POSTGRESQL ENGINE: Powered by `pglite-spring-boot-test`,    │
│    executing authentic PostgreSQL Row-Level Security (RLS) policies,   │
│    `SET LOCAL app.current_tenant_id` session settings, and Liquibase.  │
│                                                                        │
│ 3. ZERO-FOOTPRINT DECOUPLING: When `application.sandbox.enabled=false`  │
│    (production default), ZERO sandbox beans or aspects are registered. │
│                                                                        │
│ 4. DUAL OPERATING MODES: Seamlessly supports `DEV` mode (persistent   │
│    scratch database, realistic 2s payment delay) and `TEST` mode       │
│    (ephemeral in-memory database, instantaneous 0ms mock execution).   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture & Design Patterns

The sandbox module is packaged as an independent Maven submodule (`apps/backend/unipost-sandbox`), preserving strict separation of concerns from production business modules.

### Component & Data Flow Diagram

```
                               ┌────────────────────────────────┐
                               │     Client Applications        │
                               │  (Console, Mobile, TekGo, E2E) │
                               └───────────────┬────────────────┘
                                               │ HTTP / REST
                                               ▼
                               ┌────────────────────────────────┐
                               │  Spring Security & Filters     │
                               │  - HeaderSanitizerFilter       │
                               │  - TenantContextHolder         │
                               └───────────────┬────────────────┘
                                               │
               ┌───────────────────────────────┴───────────────────────────────┐
               ▼                                                               ▼
┌──────────────────────────────┐                              ┌──────────────────────────────┐
│     Production Business      │                              │      unipost-sandbox         │
│     Services & Modules       │                              │     (Conditional Beans)      │
│  - MetadataService           │                              │  - SandboxTokenAspect        │
│  - PayOsBillingService       │◀────────(Aspect / AOP)───────│  - PayOsCheckoutInterceptor  │
│  - StorageConnector          │◀──────(@Primary Substitute)──│  - InMemoryStorageConnector  │
│  - WebhookDeliveryService    │◀──────(@Primary Substitute)──│  - MockWebhookDeliveryService│
└──────────────┬───────────────┘                              └──────────────┬───────────────┘
               │                                                             │
               │ SQL Queries / Liquibase                                     │ Seed & Pre-Warm
               ▼                                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                       Embedded PostgreSQL Engine (PGlite)                                  │
│     - True PostgreSQL Engine Running In-Process                                            │
│     - Real Row-Level Security (RLS) Policies Enforced on UNIPOST_ENTITIES                  │
│     - DEV Mode: `jdbc:pglite:file:tmp/db/pglite-sandbox` (Persistent)                      │
│     - TEST Mode: `jdbc:pglite:memory://` (Ephemeral In-Memory)                             │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Applied Architectural Patterns

1. **Strategy Pattern (`ExternalServiceSimulator<T>`)**:
   - Universal SPI contract providing `getId()`, `getName()`, `reset()`, and `getStatus()` methods.
   - Implemented by `PayOsSimulator`, `InMemoryStorageSimulator`, and `MockWebhookDispatcher`.
2. **Registry Pattern (`BackendSandboxRegistry`)**:
   - Central thread-safe catalog discovering all active simulators in the Spring context.
   - Provides unified state introspection and reset hooks (`resetAll()`).
3. **Transparent Decorator / Proxy (`@Primary` + `@ConditionalOnProperty`)**:
   - Replaces external infrastructure beans without modifying any caller code:
     - `InMemoryStorageConnector` replaces AWS S3 / MinIO storage.
     - `MockWebhookDeliveryService` replaces real HTTP outbox webhooks.
4. **Aspect-Oriented Interception (AOP)**:
   - `PayOsCheckoutInterceptorAspect`: Automatically intercepts payment link generation and triggers background webhook confirmation.
   - `SandboxTokenAspect`: Intercepts `TokenService.getToken(...)` to mint cryptographic JWTs for personas on the fly.
5. **Batch Memento & Seed Generator (`CmsDataScaffoldingGenerator`)**:
   - High-throughput chunked JDBC batch insertion (`INSERT INTO UNIPOST_ENTITIES ...`) generating thousands of records in ~1 second.

---

## 3. Dual Operating Modes: DEV vs TEST

| Feature / Behavior | Mode 1: TEST Mode | Mode 2: DEV Mode |
| :--- | :--- | :--- |
| **Activation Property** | `application.sandbox.mode=TEST` | `application.sandbox.mode=DEV` |
| **Primary Use Case** | Unit tests, CI builds, `mvn test` | Local offline dev, Live E2E browser tests |
| **Database Datasource** | In-memory ephemeral (`memory://`) | Local persistent file (`tmp/db/pglite-sandbox`) |
| **State Retention** | Discarded on context termination | Preserved across server restarts |
| **Pristine Reset Toggle** | Always pristine per test method | Configurable via `application.sandbox.dev.pristine=true` |
| **Payment Webhook Latency** | Instantaneous (0ms) deterministic | Realistic jitter delay (default 2,000ms via thread pool) |
| **Demonstration Seed Data** | Skipped (clean baseline per test slice) | Automatically pre-warms Acme Corp CRM & CMS (1,000+ items) |
| **Port Binding** | Random ephemeral port | Fixed port `8000` |

---

## 4. Developer Run Commands & CLI Recipes

All commands can be invoked directly from the monorepo root or scoped to `@unipost/backend`.

### Monorepo Root Shortcuts (Recommended)

```powershell
# 1. Full-Stack Concurrent Sandbox (Backend on 8000 + Console Vite on 5173)
pnpm dev:sandbox

# 2. Launch Backend Sandbox independently (DEV Mode on port 8000)
pnpm dev:backend:sandbox

# 3. Launch Console Frontend in Offline Sandbox Mode
pnpm dev:console:sandbox

# 4. Run Mode 1 Autonomous Playwright E2E Tests (Mock Client)
pnpm test:e2e

# 5. Run Mode 2 Live Backend Playwright E2E Tests (Against Real Spring Boot)
pnpm test:e2e:live

# 6. Execute Backend Sandbox Unit & Integration Tests (33 tests)
pnpm test:backend:sandbox
```

### Backend Package Scripts (`apps/backend/package.json`)

```powershell
# Run backend in standard persistent DEV sandbox
pnpm --filter @unipost/backend dev:sandbox

# Explicit alias for persistent sandbox
pnpm --filter @unipost/backend dev:sandbox:persistent

# Run backend in pristine DEV sandbox (wipes tmp/db/pglite-sandbox on startup)
pnpm --filter @unipost/backend dev:sandbox:pristine

# Run backend in ephemeral in-memory TEST sandbox
pnpm --filter @unipost/backend dev:sandbox:test

# Run sandbox module test suite
pnpm --filter @unipost/backend test:sandbox

# Run Spring Modulith architectural boundary tests
pnpm --filter @unipost/backend test:modulith
```

### Direct Maven Invocation (CLI / CI)

```powershell
# Boot unipost-ms-aio with sandbox flags via Maven wrapper
node apps/backend/mvnw.cjs -pl unipost-ms-aio spring-boot:run `
  -Dspring-boot.run.profiles=local `
  "-Dspring-boot.run.arguments=--application.sandbox.enabled=true --application.sandbox.mode=DEV --application.sandbox.dev.pristine=false" `
  "-Dspring-boot.run.jvmArguments=-Djava.net.preferIPv4Stack=true"
```

---

## 5. Boundary Simulators Reference

### 5.1 PayOS VietQR Simulator (`PayOsSimulator`)
Handles commercial billing checkouts, QR code generation, and payment settlement without communicating with external PayOS gateway servers.
- **HMAC-SHA256 Signatures**: Generates authentic cryptographic signatures verified by production `PayOsBillingService` logic.
- **Mode-Aware Callback Strategy**:
  - In `DEV` mode: Dispatches an asynchronous webhook to the local backend after `autoConfirmDelayMs` (default 2,000ms), perfectly simulating customer mobile banking transfers.
  - In `TEST` mode: Instantaneous execution for rapid assertion in test suites.

### 5.2 In-Memory Storage Simulator (`InMemoryStorageSimulator`)
Drop-in `@Primary` substitute for S3/MinIO bucket storage (`InMemoryStorageConnector`).
- **File Management**: In-memory byte array storage partitioned by bucket name and object key.
- **Checksums**: Automatically calculates authentic MD5 hashes and ETag headers.
- **Streams**: Provides genuine `InputStream` byte transfers for file downloads and attachments.

### 5.3 Mock Outbox Webhook Dispatcher (`MockWebhookDispatcher`)
Drop-in `@Primary` substitute for `WebhookDeliveryService` in `unipost-ms-worker` (`MockWebhookDeliveryService`).
- **Interception**: Captures outgoing events (e.g. `EDGE_REVALIDATION`, entity changes).
- **Inspection Ledger**: Records all dispatched payloads in memory for test assertions (`getDispatchedWebhooks()`).
- **Zero Timeouts**: Eliminates connection timeouts when downstream consumer endpoints (like Edge CDN) are offline.

---

## 6. Authentication & Authorization Cheatsheet

The backend sandbox supports **two distinct authentication layers**: zero-database persona JWT minting (Path A) and Liquibase database-seeded credentials (Path B).

### Path A: Zero-Database Sandbox Personas (`SandboxTokenAspect`)

When `application.sandbox.enabled=true`, any request to `/api/auth/token` with a recognized persona username will immediately return an authentic, cryptographically signed JWT **without querying the database**:

| Persona ID | Username / Aliases | Password | Tenant ID (`tid`) | Roles & Granted Authorities | Description & Access Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`admin`** | `admin`<br>`admin@unipost.io`<br>`tenant-admin`<br>`admin_bypass` | *Any password* (e.g. `admin123`) | `tenant-acme` | `ROLE_ADMIN`, `ROLE_USER`, `METADATA_SCHEMA_READ`, `METADATA_SCHEMA_WRITE`, `METADATA_RECORD_READ`, `METADATA_RECORD_WRITE`, `USER_MANAGEMENT`, `WORKSPACE_MANAGEMENT` | Tenant Administrator with complete read/write access over Acme Corporation schemas, records, and users. |
| **`system`** | `system`<br>`system-custodian`<br>`custodian@system`<br>`custodian_root` | *Any password* (e.g. `admin123`) | `SYSTEM` (Root) | `ROLE_SYSTEM_CUSTODIAN`, `ROLE_ADMIN`, `ROLE_USER`, `platform:dlq:manage`, `METADATA_SCHEMA_READ`, `METADATA_SCHEMA_WRITE` | Sovereign Platform Custodian with cross-tenant bypass, DLQ poison pill management, and fleet operations. |
| **`creator`** | `creator`<br>`creator@unipost.io`<br>`tenant-creator`<br>`creator_bypass` | *Any password* (e.g. `creator123`) | `tenant-acme` | `ROLE_CREATOR`, `ROLE_USER`, `METADATA_SCHEMA_READ`, `METADATA_RECORD_READ`, `METADATA_RECORD_WRITE` | Content author persona with record authoring and CMS editorial access; forbidden from schema mutations. |
| **`user`** | `user`<br>`user@unipost.io`<br>`tenant-user`<br>`user_bypass` | *Any password* (e.g. `user123`) | `tenant-acme` | `ROLE_USER`, `METADATA_RECORD_READ` | Standard end-user with read-only record access; used for testing least-privilege constraints. |

> [!TIP]
> **Universal Bypass Password**:
> Supplying password `"bypass"` with any username will automatically resolve to the `admin` persona for `tenant-acme`.

### Path B: Database-Seeded Users (`UNIPOST_USER`)

Seeded via Liquibase (`changelog-master_data.xml` and `changelog-mock_data.xml`):

| Username | Plaintext Password | Primary Role | Seed Changelog Source |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | `admin` | `db/identity/changelog-master_data.xml` |
| `anonymous` | `admin123` | `ANONYMOUS` | `db/identity/changelog-master_data.xml` |
| `user_1` to `user_7` | `admin123` | `role_1` to `role_7` | `db/identity/changelog-mock_data.xml` |

---

## 7. Interactive API Testing Recipes (cURL)

### 7.1 Login and Obtain a Persona Token

```bash
# Obtain Admin JWT for tenant-acme
curl -s -X POST http://localhost:8000/api/auth/token \
  -H "Content-Type: application/json" \
  -H "clientType: web" \
  -d '{
    "header": { "clientType": "web" },
    "body": {
      "userName": "tenant-admin",
      "password": "any-password"
    }
  }'
```

**Response Payload**:
```json
{
  "code": 200,
  "message": "Success",
  "body": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "expiresIn": 86400
  }
}
```

### 7.2 Query Multi-Tenant Metadata Schemas

```bash
# Query active entity types for tenant-acme
export TOKEN="<PASTE_ACCESS_TOKEN_HERE>"

curl -s -X GET "http://localhost:8000/api/v1/metadata/entity-types?page=1&size=10" \
  -H "Authorization: Bearer $TOKEN"
```

### 7.3 Simulate VietQR Payment Checkout

```bash
# Initiate subscription upgrade for tenant-acme
curl -s -X POST http://localhost:8000/api/v1/billing/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planTier": "ENTERPRISE",
    "billingCadence": "YEARLY",
    "amount": 5000000
  }'
```

*In DEV mode, `PayOsSimulator` logs confirmation within 2 seconds:*
```text
2026-10-18 12:00:02 INFO  c.u.s.simulators.PayOsSimulator : [PayOS Simulator] Order 123456 auto-confirmed for tenant-acme (2000ms delay)
```

---

## 8. High-Volume CMS Scaffolding Engine

When `unipost-ms-aio` starts in DEV mode, [`SandboxDataPreWarmer`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-sandbox/src/main/java/com/unipost/sandbox/seed/SandboxDataPreWarmer.java) and [`CmsDataScaffoldingGenerator`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-sandbox/src/main/java/com/unipost/sandbox/seed/CmsDataScaffoldingGenerator.java) provision demonstration schemas and seed records:

1. **Dual Blueprint Provisioning**:
   - `bp_crm_billing_v1`: B2B CRM & Customer Accounts.
   - `bp_cms_publishing_v1`: Headless CMS, Editorial Articles, Taxonomy Categories, and Media Assets.
2. **Chunked JDBC Batch Insertion**:
   - Seeds **1,000+ Articles**, **50 Categories**, and **200 Media Assets** with full Markdown content.
   - Connects articles to categories and media assets via `UNIPOST_ENTITY_RELATIONSHIPS` graph edges.
3. **PostgreSQL RLS Invariant Enforcement**:
   - Executes `SET LOCAL app.current_tenant_id = 'tenant-acme'` in the transaction to guarantee that all rows pass database Row-Level Security checks.

---

## 9. Datasource Configuration: Embedded PGlite vs External PostgreSQL

### Default: Zero-Dependency Embedded PGlite
By default, the sandbox runs an in-process PostgreSQL engine saving to disk at `tmp/db/pglite-sandbox`. Zero setup or Docker required.

### Pointing DEV Sandbox to External PostgreSQL
If you wish to run the sandbox with an external PostgreSQL database (e.g. `docker compose up -d postgres`) while keeping all mock simulators (PayOS, MinIO, personas) active:

```powershell
node apps/backend/mvnw.cjs -pl unipost-ms-aio spring-boot:run `
  -Dspring-boot.run.profiles=local `
  "-Dspring-boot.run.arguments=--application.sandbox.enabled=true --application.sandbox.database.embedded-pglite=false --spring.datasource.url=jdbc:postgresql://localhost:5432/unipost --spring.datasource.username=postgres --spring.datasource.password=postgres"
```

---

## 10. Extending the Sandbox (Custom Simulator SPI Guide)

To add a new boundary simulator (e.g., `MockSmsSimulator` or `MockOidcSimulator`):

### Step 1: Implement `ExternalServiceSimulator<T>`

```java
package com.unipost.sandbox.simulators;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class MockSmsSimulator implements ExternalServiceSimulator<MockSmsSimulator> {

    @Override
    public String getId() {
        return "sms-simulator";
    }

    @Override
    public String getName() {
        return "Mock SMS Gateway";
    }

    @Override
    public void reset() {
        // Clear in-memory SMS message buffer
    }

    @Override
    public Object getStatus() {
        return Map.of("status", "ACTIVE", "messagesSent", 42);
    }
}
```

### Step 2: Register & Intercept
Spring Boot will automatically detect your bean and register it in `BackendSandboxRegistry`. Use `@Primary` on your service bean or an AOP `@Aspect` to intercept production boundaries transparently.

---

## 11. Configuration Properties Reference

| Property Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `application.sandbox.enabled` | `boolean` | `false` | Master toggle. Must be `true` to register any sandbox bean. |
| `application.sandbox.mode` | `enum` | `DEV` | `DEV` (persistent PGlite, 2s jitter) or `TEST` (in-memory, 0ms). |
| `application.sandbox.dev.pristine` | `boolean` | `false` | When `true` in DEV mode, scratch database is wiped on boot. |
| `application.sandbox.database.embedded-pglite` | `boolean` | `true` | When `true`, uses embedded PGlite. When `false`, uses standard datasource. |
| `application.sandbox.database.dev-storage-path` | `string` | `tmp/db/pglite-sandbox` | File storage path for persistent PGlite DEV database. |
| `application.sandbox.payos.auto-confirm-enabled` | `boolean` | `true` | When `true`, VietQR orders are automatically confirmed via simulated callback. |
| `application.sandbox.payos.auto-confirm-delay-ms`| `long` | `2000` | Delay before payment confirmation callback in DEV mode. |
| `application.sandbox.seed.enabled` | `boolean` | `true` | When `true` in DEV mode, seeds demonstration CMS and CRM data. |
| `application.sandbox.seed.articles-count` | `int` | `1000` | Number of CMS article records generated for `tenant-acme`. |
| `application.sandbox.seed.categories-count` | `int` | `50` | Number of taxonomy categories generated for `tenant-acme`. |
| `application.sandbox.seed.media-assets-count` | `int` | `200` | Number of media assets generated for `tenant-acme`. |
| `application.sandbox.seed.tenant-id` | `string` | `tenant-acme` | Target tenant identifier for pre-warmed demonstration data. |

---

## 12. Troubleshooting & FAQ

#### Q: Port 8000 is already in use when running `pnpm dev:sandbox`.
**A**: Another instance of the backend or Docker container is running. Terminate the existing process or override the port via `--server.port=8080`.

#### Q: How do I completely wipe the local DEV sandbox database to start fresh?
**A**: Run `pnpm dev:sandbox:pristine` once, or manually delete the `tmp/db/pglite-sandbox` folder.

#### Q: How do I verify that production builds have zero sandbox code?
**A**: Check that `application.sandbox.enabled` is `false` (default) and execute `SandboxDecouplingIntegrationTest`:
```powershell
node apps/backend/mvnw.cjs -pl unipost-sandbox test -Dtest=SandboxDecouplingIntegrationTest
```
This test asserts that zero sandbox beans exist in Spring's `ApplicationContext`.
