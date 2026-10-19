# Walkthrough 44: Backend Unified Sandbox Phase 4 - Verification, Decoupling & Regression-Free Gating

## 1. Overview
In Phase 4 of Iteration 8 ("Backend Unified Sandbox Platform"), we completed the final verification, decoupling assertions, and developer-mode persistence configurability:
- Added `application.sandbox.dev.pristine` toggle in `SandboxProperties`. In `DEV` mode, setting `pristine: true` cleanly flushes persistent scratch files and database directories upon boot, while `pristine: false` (default) preserves developer mutations across server restarts.
- `TEST` mode strictly guarantees 100% ephemeral, in-memory isolation (`jdbc:pglite:memory://`) regardless of DEV configuration.
- Added `PgLiteRlsIntegrationTest` verifying datasource configuration across test/dev modes, pristine directory flushing, and PostgreSQL RLS `TenantSessionAspect` query execution.
- Executed the full backend multi-module build and test suite (`mvn test -f apps/backend/pom.xml -q`) with JaCoCo $\ge 90\%$ test coverage and zero regressions.

## 2. Changes Made

### `apps/backend/unipost-sandbox`
- **`SandboxProperties`**:
  - Added `DevSimulationProperties` with `boolean pristine = false;`.
  - Added helper methods `isDevMode()` and `isTestMode()`.
- **`PgLiteDatasourceConfiguration`**:
  - Wired directory wipe logic when `properties.isDevMode() && properties.getDev().isPristine()`, purging `tmp/db/pglite-sandbox` prior to initializing the connection.
  - Added recursive file deletion helper `deleteRecursively`.
- **`PgLiteRlsIntegrationTest`**:
  - Verified `TEST` mode datasource is ephemeral and in-memory.
  - Verified `DEV` mode with `pristine=false` preserves sentinel files.
  - Verified `DEV` mode with `pristine=true` flushes sentinel files.
  - Verified `TenantSessionAspect` sets `app.current_tenant_id` and `statement_timeout` for standard and sovereign custodian contexts.

## 3. Verification & Results

### Automated Commands Executed
1. **`unipost-sandbox` Module Test Suite**:
   - `mvn clean test -f apps/backend/unipost-sandbox/pom.xml -q` (31 tests, 0 failures, 100% passing).
2. **Full Multi-Module Backend Test Suite**:
   - `mvn test -f apps/backend/pom.xml -q` (300+ tests, 0 failures, JaCoCo $\ge 90\%$ coverage passing).
3. **Decoupling Assertion Test**:
   - `SandboxDecouplingIntegrationTest`: Asserted zero sandbox beans exist when `application.sandbox.enabled=false`.
4. **Playwright E2E Browser Tests**:
   - Flows 01 and 08 passed offline in Mode 1 (Autonomous Sandbox) in 7.7s.
