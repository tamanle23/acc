# Implementation Plan: Backend Unified Sandbox Platform (Spring Boot / Modulith)

## Goal Description
Establish a decoupled, production-immune **Backend Unified Sandbox Platform** packaged as a **separate Maven module** (`apps/backend/acc-sandbox`) that seamlessly supports **both Test Mode and Dev Mode**.

### Key Decisions Aligned
1. **Separate Maven Module (`acc-sandbox`)**: Placed in `apps/backend/acc-sandbox`, keeping core production modules (`acc-fw`, `acc-ms-aio`) completely free of test/mock harness code.
2. **Dual-Mode Profiles (`dev` & `test`)**:
   - **Test Mode (`application-test-sandbox.yml`)**:
     - Fast, deterministic in-memory execution.
     - Ephemeral in-memory PGlite database (`memory://`) with rollback per test.
     - Immediate/synchronous simulated webhook callbacks for rapid test velocity.
   - **Dev Mode (`application-sandbox.yml`)**:
     - Runs on standard port 8000 alongside Console frontend.
     - Persistent local PGlite database (`tmp/db/pglite-sandbox`) preserving user changes across server restarts.
     - Realistic async delays (e.g. 2000ms) simulating real third-party network calls.
     - Pre-warmed demonstration datasets (Acme Corp, schemas, products, orders).
3. **Zero New Endpoints**: No synthetic `/api/v1/sandbox/*` routes. The sandbox transparently simulates third-party external boundaries (e.g., PayOS, MinIO, Outbox Webhooks) while client applications use the exact same production endpoints and URLs.
4. **Database Layer Simulation via `pglite-spring-boot-test`**:
   - Uses embedded in-memory PostgreSQL (`io.github.jakvbs:pglite-spring-boot-test`) running via WASM in-process.
   - Executes real PostgreSQL RLS (`SET LOCAL app.current_tenant_id`), JSONB operators, LATERAL joins, and Liquibase migrations without needing Docker or a local PostgreSQL installation.
   - Strictly satisfies the `ZERO-STUB-PROHIBITION` rule.

---

## Architecture & Design Patterns

```mermaid
graph TD
    subgraph Client / Apps
        UI[Console / Mobile / E2E Runner] -->|Standard APIs /api/auth/token, /api/v1/billing/*| Core[acc-fw Presentation Layer]
    end

    subgraph Security & Tenancy
        Core --> Sec[JwtAuthenticationTokenFilter]
        Sec --> RLS[PostgreSQL RLS / TenantContextHolder]
    end

    subgraph Business Service Layer
        RLS --> Billing[PayOsBillingService]
        RLS --> Storage[FileStorageService]
        RLS --> Outbox[OutboxEventPublisher]
    end

    subgraph Database Layer Simulation (Dual Mode)
        RLS --> PGLiteTest[Test Mode: In-Memory PGlite memory://]
        RLS --> PGLiteDev[Dev Mode: Persistent File PGlite tmp/db/pglite-sandbox]
        PGLiteTest --> Liquibase[Real Liquibase Changelogs & RLS Policies]
        PGLiteDev --> Liquibase
    end

    subgraph acc-sandbox Boundary Simulators
        Billing -.->|@Primary / Transparent Proxy| SimPayOS[PayOsSimulator]
        Storage -.->|@Primary / Transparent Proxy| SimS3[InMemoryStorageSimulator]
        Outbox -.->|@Primary / Transparent Proxy| SimWebhook[MockWebhookDispatcher]

        SimPayOS --> Registry[BackendSandboxRegistry]
        SimS3 --> Registry
        SimWebhook --> Registry
    end
```

---

## Proposed Changes

### Module 1: Parent Configuration
#### [MODIFY] `apps/backend/pom.xml`
- Register `<module>./acc-sandbox</module>`.
- Add dependency management for `acc-sandbox` and `io.github.jakvbs:pglite-spring-boot-test:0.4.0`.

---

### Module 2: `apps/backend/acc-sandbox` (New Maven Module)

#### [NEW] `apps/backend/acc-sandbox/pom.xml`
- Standard Spring Boot starter dependency inheriting from parent.
- Dependencies: `acc-fw`, `io.github.jakvbs:pglite-spring-boot-test`, Spring Boot starter web, test starter.

#### [NEW] `com.acc.sandbox.config.SandboxAutoConfiguration`
- Conditional auto-configuration class:
  ```java
  @AutoConfiguration
  @ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
  @EnableConfigurationProperties(SandboxProperties.class)
  public class SandboxAutoConfiguration { ... }
  ```

#### [NEW] `com.acc.sandbox.config.SandboxProperties`
- Properties:
  - `enabled` (boolean, default: false)
  - `mode` (`TEST` | `DEV`, default: `DEV`)
  - `database.embedded-pglite` (default: true)
  - `database.storage-path` (default: `tmp/db/pglite-sandbox` for DEV, `memory://` for TEST)
  - `payos.auto-confirm-delay-ms` (default: 2000 for DEV, 0 for TEST)
  - `payos.auto-confirm-enabled` (default: true)

#### [NEW] `com.acc.sandbox.db.PgLiteDatasourceConfiguration`
- Auto-configures embedded PGlite datasource based on active mode (`TEST` in-memory vs `DEV` file-backed).
- Triggers Liquibase changelogs automatically on the embedded instance.

#### [NEW] `com.acc.sandbox.spi.ExternalServiceSimulator`
- Strategy interface (`getId()`, `getName()`, `reset()`).

#### [NEW] `com.acc.sandbox.registry.BackendSandboxRegistry`
- Thread-safe registry holding all active simulator beans.

#### [NEW] `com.acc.sandbox.simulators.PayOsSimulator`
- Simulates PayOS checkout and fires asynchronous callbacks to the standard webhook handler with authentic HMAC-SHA256 checksums (instant in TEST, 2000ms delay in DEV).

#### [NEW] `com.acc.sandbox.simulators.InMemoryStorageSimulator`
- Implements S3/MinIO operations using an in-memory byte map (or dev file cache).

#### [NEW] `com.acc.sandbox.simulators.MockWebhookDispatcher`
- Consumes outbox events and records payloads in memory without failing network connections.

---

## Verification Plan

### Automated Tests
1. **PGlite & RLS Policy Verification (Test Mode)**:
   - `PgLiteRlsIntegrationTest`: Boots embedded in-memory PGlite, executes `TenantSessionAspect`, and asserts that PostgreSQL RLS policies correctly isolate records by `tenant_id` in-memory with zero disk footprint.
2. **Dev Mode Persistence Verification**:
   - `PgLiteDevModePersistenceTest`: Boots file-backed PGlite, inserts records, restarts context, and asserts that data persists across restarts.
3. **Boundary Simulator Unit Tests**:
   - `PayOsSimulatorTest`: Asserts HMAC checksum generation and scheduled callback execution across both modes.
   - `InMemoryStorageSimulatorTest`: Asserts stream storage and retrieval.
4. **Decoupling Integration Test**:
   - `SandboxDecouplingIntegrationTest`: Verifies that when `application.sandbox.enabled=false`, zero sandbox beans or embedded databases are instantiated in the Spring context.
5. **Full Suite & JaCoCo Gating**:
   - Run `mvn clean test -q` across `apps/backend/pom.xml` and ensure JaCoCo $\ge 90\%$ test coverage remains satisfied.
