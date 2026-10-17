# Implementation Plan 44: Backend Unified Sandbox Phase 4 - Verification, Decoupling & Regression-Free Gating

## 1. Problem Statement
Phase 4 of the Unified Sandbox Platform requires rigorous verification, decoupling protection, and developer-mode persistence configurability:
1. **DEV Mode Persistence vs Pristine Configuration**:
   - `TEST` mode must strictly guarantee 100% ephemeral, in-memory, pristine isolation without any persistent disk state.
   - `DEV` mode must default to persistent storage across server restarts, but provide a configurable toggle `application.sandbox.dev.pristine=true` allowing developers to wipe existing scratch storage and start with a clean baseline on boot.
2. **PostgreSQL RLS & Tenant Boundary Verification**:
   - `PgLiteRlsIntegrationTest` must assert authentic multi-tenant query isolation under `TenantSessionAspect` setting `app.current_tenant_id` and statement timeouts.
3. **Decoupling Gating**:
   - Verify that with `application.sandbox.enabled=false`, zero sandbox beans exist in the `ApplicationContext`.
4. **Hard-Gate Test & Coverage Verification**:
   - Multi-module backend test suite must pass with $\ge 90\%$ test coverage.

## 2. Proposed Architecture & Design

### Components & Changes
1. **`SandboxProperties`**:
   - Add nested configuration class `DevSimulationProperties`:
     ```java
     private DevSimulationProperties dev = new DevSimulationProperties();

     @Getter
     @Setter
     public static class DevSimulationProperties {
         private boolean pristine = false;
     }
     ```
2. **Pristine Cleanup in `PgLiteDatasourceConfiguration` & `InMemoryStorageSimulator`**:
   - In `PgLiteDatasourceConfiguration`, if `properties.getMode() == SandboxMode.DEV && properties.getDev().isPristine()`:
     - Clear the directory `tmp/db/pglite-sandbox` prior to initializing the database connection.
   - In `InMemoryStorageSimulator`, support clearing memory/disk files when pristine flag is set.
3. **`PgLiteRlsIntegrationTest`**:
   - Located in `com.unipost.sandbox.db`.
   - Validates that `PgLiteDatasourceConfiguration` configures the correct JDBC URL for both `TEST` (`jdbc:pglite:memory://`) and `DEV` (`jdbc:pglite:file:...`) modes.
   - Verifies `dev.pristine=true` properly flushes persistent scratch paths.
   - Asserts that `TenantSessionAspect` SQL commands execute properly against DataSource connections.
4. **Verification & Hard Gates**:
   - Execute `mvn clean test -f apps/backend/unipost-sandbox/pom.xml -q`.
   - Execute `mvn test -f apps/backend/pom.xml -q` with JaCoCo verification.
   - Execute Playwright E2E suites.

## 3. Tasks
- [ ] Add `dev.pristine` property to `SandboxProperties`
- [ ] Implement directory cleanup logic in `PgLiteDatasourceConfiguration`
- [ ] Create `PgLiteRlsIntegrationTest` in `unipost-sandbox`
- [ ] Verify test and dev mode switches in `unipost-sandbox`
- [ ] Run full backend test suite with JaCoCo $\ge 90\%$ gate
- [ ] Run Playwright E2E browser tests
- [ ] Create `walkthrough_44.md`, `docs/history/136_*.md`, update index, and commit
