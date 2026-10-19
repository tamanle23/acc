# Walkthrough 41: Backend Unified Sandbox Platform (Phase 1 Foundation & Decoupling)

## Overview
Phase 1 of Iteration 8 establishes the **Backend Unified Sandbox Platform** packaged as a **completely decoupled, independent Maven module** (`apps/backend/unipost-sandbox`). The platform mirrors the developer ergonomics and offline-first capabilities of `@unipost/console`'s Unified Sandbox, supporting both **Test Mode** (ephemeral, zero-latency, in-memory) and **Dev Mode** (persistent, realistic delays, pre-warmed), while strictly adhering to `ZERO-STUB-PROHIBITION` and production isolation.

---

## Key Deliverables & Changes

1. **Independent Maven Module (`apps/backend/unipost-sandbox`)**:
   - Packaged outside `unipost-fw` and `unipost-ms-aio` to guarantee zero test/sandbox bloat in production builds.
   - Configured in [apps/backend/pom.xml](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/pom.xml).
2. **Spring Auto-Configuration & Strict Decoupling**:
   - [SandboxAutoConfiguration.java](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-sandbox/src/main/java/com/unipost/sandbox/config/SandboxAutoConfiguration.java): Guarded by `@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")`.
   - When disabled or omitted (standard production default), zero sandbox beans or registries exist in the Spring application context.
3. **Pluggable Architecture & Design Patterns**:
   - **Strategy Pattern**: [ExternalServiceSimulator.java](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-sandbox/src/main/java/com/unipost/sandbox/spi/ExternalServiceSimulator.java) providing common `getId()`, `getName()`, `reset()`, and `getDiagnostics()` contracts.
   - **Registry Pattern**: [BackendSandboxRegistry.java](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-sandbox/src/main/java/com/unipost/sandbox/registry/BackendSandboxRegistry.java) auto-wires and manages all active simulators.
   - **PayOS VietQR Simulator**: [PayOsSimulator.java](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-sandbox/src/main/java/com/unipost/sandbox/simulators/PayOsSimulator.java) simulates payment orders and computes authentic HMAC-SHA256 signatures with mode-aware callbacks (instant in TEST, 2000ms in DEV).
   - **In-Memory Storage Simulator**: [InMemoryStorageSimulator.java](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-sandbox/src/main/java/com/unipost/sandbox/simulators/InMemoryStorageSimulator.java) eliminates external S3/MinIO dependencies.
   - **Mock Webhook Dispatcher**: [MockWebhookDispatcher.java](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-sandbox/src/main/java/com/unipost/sandbox/simulators/MockWebhookDispatcher.java) intercepts outbox events without network timeouts.
   - **Database Layer**: [PgLiteDatasourceConfiguration.java](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-sandbox/src/main/java/com/unipost/sandbox/db/PgLiteDatasourceConfiguration.java) supports embedded PGlite in-memory (`memory://`) and file-backed (`tmp/db/pglite-sandbox`).

---

## Verification Results

### 1. Sandbox Unit & Decoupling Tests
```powershell
mvn test -f apps/backend/unipost-sandbox/pom.xml -q
```
- `BackendSandboxRegistryTest`: Passed (3/3).
- `PayOsSimulatorTest`: Passed (3/3).
- `InMemoryStorageSimulatorTest`: Passed (2/2).
- `MockWebhookDispatcherTest`: Passed (3/3).
- `SandboxDecouplingIntegrationTest`: Passed (3/3) - confirms zero beans registered when disabled or omitted.

### 2. Full Backend Suite Regression Check
```powershell
mvn test -f apps/backend/pom.xml -q
```
- All modules compiled cleanly.
- Over 300 unit and integration tests passed across all backend modules with zero regressions.
- JaCoCo 90% hard gate satisfied.
