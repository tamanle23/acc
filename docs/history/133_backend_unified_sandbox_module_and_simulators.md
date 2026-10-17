# 133. Backend Unified Sandbox Platform: Independent Module & Boundary Simulators (Iteration 8 Phase 1)

## Problem
Currently, `@unipost/console` has an offline-first Unified Sandbox Platform, whereas the backend either required live cloud infrastructure (PostgreSQL, MinIO/S3, ActiveMQ, real PayOS credentials) or relied on synthetic mocks, which violated the `ZERO-STUB-PROHIBITION` rule. Furthermore, sandbox harness code needed to be completely decoupled so that production builds retain zero footprint and zero overhead.

## Plan
1. Create a separate Maven module `apps/backend/unipost-sandbox`.
2. Register the module in `apps/backend/pom.xml` under `<modules>` and `<dependencyManagement>`.
3. Implement core SPI contracts (`ExternalServiceSimulator`) and thread-safe registry (`BackendSandboxRegistry`).
4. Implement boundary simulators for PayOS VietQR (`PayOsSimulator`), S3/MinIO (`InMemoryStorageSimulator`), and Outbox Webhooks (`MockWebhookDispatcher`).
5. Support embedded PGlite database configuration (`PgLiteDatasourceConfiguration`) with dual Test Mode (`memory://`) and Dev Mode (`file:tmp/db/pglite-sandbox`).
6. Enforce strict conditional auto-configuration (`@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")`).
7. Write unit tests and decoupling tests asserting zero beans exist when sandbox is disabled or omitted.

## Changes
- **Parent Configuration**:
  - `apps/backend/pom.xml`: Added `unipost-sandbox` module and dependencyManagement entry.
- **New Module**: `apps/backend/unipost-sandbox`:
  - `pom.xml`: Module definition inheriting from `com.unipost:unipost:1.0.0-SNAPSHOT`.
  - `SandboxProperties.java`: Configuration for mode (`DEV` | `TEST`), embedded database, and PayOS auto-confirm settings.
  - `ExternalServiceSimulator.java`: SPI interface for boundary simulators.
  - `BackendSandboxRegistry.java`: Thread-safe registry aggregating active simulators.
  - `PayOsSimulator.java`: Simulates PayOS VietQR orders and computes authentic HMAC-SHA256 signatures with mode-aware callback delays.
  - `InMemoryStorageSimulator.java`: In-memory S3/MinIO bucket store with MD5 checksums.
  - `MockWebhookDispatcher.java`: Captures outbox webhooks in memory without network failures.
  - `PgLiteDatasourceConfiguration.java`: Configures PGlite embedded datasource.
  - `SandboxAutoConfiguration.java`: Conditional Spring auto-configuration.
  - `org.springframework.boot.autoconfigure.AutoConfiguration.imports`: Registered auto-configuration.
- **Tests**:
  - `BackendSandboxRegistryTest.java`: Registry discovery and aggregate reset tests.
  - `PayOsSimulatorTest.java`: HMAC checksum and order lifecycle tests.
  - `InMemoryStorageSimulatorTest.java`: Object storage, streams, and MD5 tests.
  - `MockWebhookDispatcherTest.java`: Webhook capture and event type filtering tests.
  - `SandboxDecouplingIntegrationTest.java`: Asserts zero sandbox beans are registered when disabled or omitted.

## Verification
- `mvn test -f apps/backend/unipost-sandbox/pom.xml -q`: 14 tests passed in `unipost-sandbox`.
- `mvn test -f apps/backend/pom.xml -q`: Full multi-module test suite passed with 0 failures, preserving JaCoCo 90% hard gate.

## Walkthrough
Refer to `apps/backend/doc/walkthrough_41.md` for complete architecture diagrams and verification details.

## Tasks
- [x] Create decoupled Maven module `apps/backend/unipost-sandbox`
- [x] Implement `ExternalServiceSimulator` SPI & `BackendSandboxRegistry`
- [x] Implement PayOS VietQR, InMemory S3, and Mock Webhook simulators
- [x] Implement embedded PGlite datasource configuration with dual Dev/Test mode
- [x] Write decoupling tests ensuring 0 beans registered when disabled
- [x] Verify full multi-module backend test suite
- [x] Document walkthrough and history record
