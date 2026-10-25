# Master Plan: Backend Unified Sandbox Platform & Architecture Integration (Iteration 8)

## 1. Goal & Architecture Overview
Establish an enterprise-grade, clean-architecture **Backend Unified Sandbox Platform** packaged as a **separate, decoupled Maven module** (`apps/backend/acc-sandbox`) that seamlessly supports **both Test Mode and Dev Mode**, while remaining completely decoupled when running in real production live mode.

### Dual Operating Modes (Test Mode vs Dev Mode)

```
                                  ┌──────────────────────────────┐
                                  │   acc-sandbox Module     │
                                  └──────────────┬───────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
               [Mode 1: Test Mode]                              [Mode 2: Dev Mode]
          Maven / JUnit / CI / Vitest                      Local Dev Server / E2E Live
        `mvn test` / `@SpringBootTest`                 `mvn spring-boot:run` / Docker
      Spring Profile: `test` + `sandbox`             Spring Profile: `local` + `sandbox`
  ─────────────────────────────────────────────    ─────────────────────────────────────────────
  • Database: Ephemeral PGlite (in-memory)         • Database: Persistent PGlite file or Local PG
  • Lifecycle: In-memory rollback per test slice   • Lifecycle: Persistent demo state (Acme Corp)
  • External Simulators: Deterministic, no delay   • External Simulators: Realistic jitter (2s)
  • Port: Random ephemeral test ports              • Port: Standard fixed port (8000 / 8080)
  • Webhook Dispatch: Synchronous or immediate     • Webhook Dispatch: Async scheduled worker
```

---

## 2. Core Guiding Principles

1. **Decoupled Packaging**: Packaged as an independent Maven artifact (`acc-sandbox`) inside `apps/backend/pom.xml`. Production builds can completely omit this dependency, ensuring **zero footprint and zero runtime overhead in production**.
2. **Dual-Mode Profiles (`dev` & `test`)**:
   - **Dev Mode (`application-sandbox.yml`)**:
     - Boots Spring Boot on port 8000 for local developer testing and Playwright live E2E runs (`pnpm test:e2e:live`).
     - Uses PGlite in persistent local path (`tmp/db/pglite-sandbox`) or connects to local PostgreSQL.
     - Simulates realistic payment delays (e.g. 2000ms) with background scheduled task execution.
     - Automatically pre-warms demo datasets (Acme Corp, schemas, products, orders).
   - **Test Mode (`application-test-sandbox.yml`)**:
     - Activated during `mvn test` or `@SpringBootTest`.
     - Uses in-memory ephemeral PGlite (`memory://`) with fast rollback per test method.
     - Simulates zero latency / instantaneous deterministic webhook execution for maximum test suite velocity.
3. **Zero New Endpoints**: **Do NOT introduce any artificial sandbox endpoints**. The sandbox operates transparently by intercepting existing production boundaries (e.g., standard PayOS webhook URLs, existing storage APIs, existing authentication flows). Switching between Sandbox and Live mode requires zero code or URL changes on client applications.
4. **Embedded PostgreSQL Simulation with `pglite-spring-boot-test`**:
   - Runs a genuine PostgreSQL engine in-process, enabling **100% authentic PostgreSQL RLS (Row-Level Security) policies**, `SET LOCAL app.current_tenant_id` session variables, Liquibase migrations, JSONB operators, and dynamic LATERAL queries **without requiring external Docker containers or a pre-installed PostgreSQL server**.
   - Strictly satisfies **`ZERO-STUB-PROHIBITION`** because real SQL queries, filters, and RLS checks execute against a real PostgreSQL engine.
5. **Pluggable Design Patterns**:
   - **Strategy Pattern (`ExternalServiceSimulator<T>`)**: Universal contract for simulating external boundary adapters.
   - **Registry Pattern (`BackendSandboxRegistry`)**: Central catalog discovering and coordinating active simulators via Spring auto-configuration.
   - **Decorator / Transparent Proxy (`@Primary` + `@ConditionalOnProperty`)**: Wraps or substitutes third-party client beans (PayOS, MinIO/S3, Outbox Webhooks) without modifying any production business services.
   - **Memento Pattern**: Captures initial in-memory state and re-warms demonstration datasets upon transactional reset triggers.

---

## 3. Four-Phase Implementation Plan

### Phase 1: Module Creation, Auto-Configuration & Embedded PGlite Setup
1. **Maven Module Setup**:
   - Create `apps/backend/acc-sandbox` with `pom.xml`.
   - Register `<module>./acc-sandbox</module>` in `apps/backend/pom.xml`.
   - Dependency hierarchy: `acc-sandbox` depends on `acc-fw` (provided/compile), keeping `acc-fw` free of sandbox dependencies.
2. **Embedded PGlite Database Auto-Configuration**:
   - Add `io.github.jakvbs:pglite-spring-boot-test` dependency.
   - Configure conditional Datasource override:
     - In **Test Mode**: `jdbc:pglite:memory://` (ephemeral).
     - In **Dev Mode**: `jdbc:pglite:file:../../tmp/db/pglite-sandbox` (persistent).
   - Run Liquibase master changelogs against embedded PGlite to instantiate complete schema and RLS policies.
3. **Core Registry & Strategy**:
   - `ExternalServiceSimulator`: SPI contract (`getId()`, `getName()`, `reset()`, `getStatus()`).
   - `BackendSandboxRegistry`: Thread-safe registry aggregating all simulators.

---

### Phase 2: Boundary Simulators (Transparent Drop-in)
1. **PayOS VietQR Simulator (`PayOsSimulator`)**:
   - Automatically handles payment order creation without connecting to live PayOS internet servers.
   - Generates authentic HMAC-SHA256 signatures matching the production algorithm in `PayOsBillingService`.
   - **Mode-Aware Callback Strategy**:
     - **In Dev Mode**: Realistic asynchronous callback via an internal scheduled executor (configurable delay, default 2000ms), simulating a real bank mobile transfer.
     - **In Test Mode**: Instantaneous or on-demand callback execution for fast unit/integration test suites.
2. **In-Memory Storage Simulator (`InMemoryStorageSimulator`)**:
   - Drop-in implementation for S3/MinIO file storage.
   - Stores file bytes in a concurrent memory map (or local scratch folder in dev mode), generating valid MD5/ETag headers and stream downloads.
3. **Mock Outbox Webhook Dispatcher (`MockWebhookDispatcher`)**:
   - Transparently consumes events from the outbox pipeline and records outgoing payloads in memory, eliminating connection timeouts to external webhook consumers during development and testing.

---

### Phase 3: Seamless Persona & Tenancy Transparency
1. **Zero-Endpoint Persona Authentication**:
   - Standard `/api/auth/token` endpoint respects sandbox personas when sandbox mode is enabled, issuing genuine cryptographic JWTs for:
     - `system-custodian` (Sovereign Custody, `SYSTEM` tenant, `ROLE_SYSTEM_CUSTODIAN`)
     - `tenant-admin` (`tenant-acme`, `ROLE_ADMIN`)
     - `tenant-creator` (`tenant-acme`, `ROLE_CREATOR`)
     - `tenant-user` (`tenant-acme`, `ROLE_USER`)
   - Fully compatible with `HeaderSanitizerFilter`, `TenantContextHolder`, and embedded PGlite PostgreSQL RLS.
2. **Pre-warmed Seed Data**:
   - In **Dev Mode**: Auto-provisions Acme Corp tenant with sample metadata models, records, and default workspace.
   - In **Test Mode**: Clean baseline per test slice.

---

### Phase 4: Verification, Decoupling & Regression-Free Gating
1. **Decoupling Assertion Test**:
   - `SandboxDecouplingIntegrationTest`: Boots Spring context with `application.sandbox.enabled=false` and asserts that:
     - Zero sandbox beans exist in `ApplicationContext`.
     - Standard production beans and datasource are wired cleanly.
2. **PGlite Embedded Database Verification**:
   - `PgLiteRlsIntegrationTest`: Executes queries against embedded PGlite with `TenantSessionAspect` setting `app.current_tenant_id` and verifies strict RLS tenant isolation in-memory.
3. **Dev Mode vs Test Mode Verification**:
   - Test mode: fast suite passes with zero latency.
   - Dev mode: verify offline server startup on port 8000 with pre-warmed state.
4. **JaCoCo Coverage & Hard-Gate Validation**:
   - Ensure backend build passes `mvn test -q` and `mvn verify -q` with $\ge 90\%$ test coverage.

---

## 4. Verification Plan

### Automated Commands
```powershell
# 1. Build and Test the new acc-sandbox module in Test Mode
& "C:\Users\Admin\.m2\wrapper\dists\apache-maven-3.9.9-bin\6gbr3tfuiv8aocduf5pro8ephc\apache-maven-3.9.9\bin\mvn.cmd" clean test -f apps/backend/acc-sandbox/pom.xml -q

# 2. Run full backend suite with JaCoCo check
& "C:\Users\Admin\.m2\wrapper\dists\apache-maven-3.9.9-bin\6gbr3tfuiv8aocduf5pro8ephc\apache-maven-3.9.9\bin\mvn.cmd" test -f apps/backend/pom.xml -q

# 3. Verify Decoupling (sandbox disabled by default in production)
& "C:\Users\Admin\.m2\wrapper\dists\apache-maven-3.9.9-bin\6gbr3tfuiv8aocduf5pro8ephc\apache-maven-3.9.9\bin\mvn.cmd" test -Dtest=SandboxDecouplingIntegrationTest -f apps/backend/pom.xml -q

# 4. Verify Dev Mode (Boot backend with sandbox profile)
& "C:\Users\Admin\.m2\wrapper\dists\apache-maven-3.9.9-bin\6gbr3tfuiv8aocduf5pro8ephc\apache-maven-3.9.9\bin\mvn.cmd" spring-boot:run -f apps/backend/acc-ms-aio/pom.xml -Dspring-boot.run.profiles=local,sandbox
```
