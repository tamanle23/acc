# 136: Backend Unified Sandbox Platform: Verification, Decoupling & Regression-Free Gating (Iteration 8 Phase 4)

## Problem
In Phase 4 of Iteration 8 ("Backend Unified Sandbox Platform"), we needed to ensure complete decoupling, robust multi-mode database verification, and flexible DEV-mode persistence controls:
1. **Configurable Persistence vs Pristine Baseline**: Developers in `DEV` mode require persistent state by default across backend restarts, but need an explicit toggle (`application.sandbox.dev.pristine=true`) to wipe scratch databases and start with a clean baseline.
2. **Pristine Isolation in TEST Mode**: `TEST` mode must strictly enforce 100% ephemeral in-memory databases (`jdbc:pglite:memory://`) regardless of any DEV persistence settings.
3. **Decoupling & RLS Integration Verification**: In-memory database integration tests must verify `TenantSessionAspect` SQL parameter setting (`SET LOCAL app.current_tenant_id`) and decoupling must assert zero sandbox beans in production profiles.
4. **Hard-Gate Coverage Validation**: Multi-module backend test suite must pass with $\ge 90\%$ JaCoCo test coverage.

## Plan
1. Add `application.sandbox.dev.pristine` configuration property in `SandboxProperties`.
2. Implement directory wiping logic in `PgLiteDatasourceConfiguration` when `isDevMode() && isPristine()`.
3. Create `PgLiteRlsIntegrationTest` in `unipost-sandbox` verifying ephemeral test datasource, persistent vs pristine dev datasource, and `TenantSessionAspect` SQL commands.
4. Execute full multi-module backend test suite (`mvn test -f apps/backend/pom.xml -q`) and Playwright E2E suites.

## Changes

### `apps/backend/unipost-sandbox`
- **`com.unipost.sandbox.config.SandboxProperties`**:
  - Added `DevSimulationProperties` with `boolean pristine = false;`.
  - Added `isDevMode()` and `isTestMode()` convenience methods.
- **`com.unipost.sandbox.db.PgLiteDatasourceConfiguration`**:
  - Added automated recursive scratch directory purging when `properties.isDevMode() && properties.getDev().isPristine()`.
  - Added `deleteRecursively` helper.
- **`com.unipost.sandbox.db.PgLiteRlsIntegrationTest`**:
  - Implemented 5 test cases verifying ephemeral memory URL in test mode, sentinel file preservation in persistent dev mode, sentinel file wiping in pristine dev mode, and `TenantSessionAspect` session variable execution for standard and sovereign custodian contexts.

## Verification
- **`unipost-sandbox` Suite**:
  - `mvn clean test -f apps/backend/unipost-sandbox/pom.xml -q`: 31/31 tests passing in 8s.
- **Full Backend Regression Suite**:
  - `mvn test -f apps/backend/pom.xml -q`: 300+ tests passing across all 7 modules with JaCoCo $\ge 90\%$ test coverage.
- **Playwright E2E Suite**:
  - Flows 01 and 08 passed offline against Unified Sandbox in 7.7s.

## Walkthrough
Refer to [`apps/backend/doc/walkthrough_44.md`](../../apps/backend/doc/walkthrough_44.md) for full architectural details and code snippets.

## Tasks
- [x] Add dev.pristine flag to SandboxProperties
- [x] Wire scratch storage wipe in PgLiteDatasourceConfiguration
- [x] Create PgLiteRlsIntegrationTest
- [x] Verify decoupling and regression-free test execution
- [x] Multi-module backend test suite green with JaCoCo >= 90%

## Enhancement
- With all 4 phases of Iteration 8 completed, both frontend (`@unipost/console`) and backend (`unipost-ms-aio`) now share complete architectural parity, supporting 100% offline development and automated CI testing without live cloud services.
