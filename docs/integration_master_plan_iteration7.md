# Master Plan: Enterprise Full-Stack Automated Testing & >=90% Coverage Pipeline (Iteration 7)

## 1. Goal & Architecture Overview
Establish an enterprise-grade automated testing ecosystem that achieves **>=90% line and branch test coverage** across the core monorepo production stack (`@unipost/backend`, `@unipost/console`, and `packages/sandbox`), enforced by hard-gated CI checks, progressive coverage ratcheting, and comprehensive browser automation.

### Test Pyramid Distribution (Balanced Pragmatic Model)
- **40% Unit Tests**: Fast, deterministic unit tests for AST dynamic query compilers, state machines, zustand stores, pure utility functions, validation decorators, and algorithmic models.
- **40% Integration Tests**: Spring Modulith slice tests, JPA transactions, MockMvc REST controller boundaries, and React component trees integrated with TanStack Query and Unified Sandbox mock engines.
- **20% Playwright E2E Browser Automation**: Comprehensive browser user journeys in headless Chromium simulating all critical workflows with automated WCAG 2.2 AA accessibility audits.

### Dual-Mode E2E Execution Architecture
```
                  ┌──────────────────────────────────────────────┐
                  │          Playwright E2E Runner               │
                  └──────────────┬───────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       [Mode 1: Default / Fast]         [Mode 2: Live Backend]
       `pnpm test:e2e`                  `pnpm test:e2e:live`
       VITE_ENABLE_SANDBOX=true         VITE_ENABLE_SANDBOX=false
       Unified Sandbox Platform         Live Spring Boot (Port 8000)
       Zero Backend Dependency          PostgreSQL 16 + RLS Policies
       Deterministic (~45s run)         Real Hazelcast & Spring Modulith
                                        Health-Checked Pre-warmed Fail-Fast
```

---

## 2. Key Architectural Decisions (Resolved in Grilling)

> [!IMPORTANT]
> **Decision 1: Progressive Ratchet Coverage Enforcement**
> - **Phase 1**: Enable coverage tooling (JaCoCo and `@vitest/coverage-v8`) with HTML/lcov reporting without failing builds immediately.
> - **Phase 2**: Activate strict 90% hard gate in JaCoCo (`check` goal with `0.90` instruction & branch coverage ratio on `apps/backend/unipost-fw`) once backend test sprints land.
> - **Phase 3**: Activate strict 90% hard gate in Vitest (`90%` thresholds across lines, branches, functions, and statements on `apps/console` and `packages/sandbox`) once frontend test sprints land.
> - Any subsequent PR or build dropping below 90% fails fast with a non-zero exit code.

> [!NOTE]
> **Decision 2: Full 10-Spec Playwright Matrix**
> - All 10 end-to-end browser journeys are maintained in `apps/console/e2e/` and executed as first-class citizens in Playwright on every E2E run.

> [!TIP]
> **Decision 3: Pre-Warmed Mode 2 with Health-Check Fail-Fast**
> - Mode 2 (`pnpm test:e2e:live`) assumes pre-warmed backend and database services (port 8000 & 5432).
> - Playwright's `globalSetup` performs an automated HTTP health check (`http://localhost:8000/actuator/health` or `/api`) before running tests; if unreachable, it aborts fast with actionable diagnostic guidance.

> [!IMPORTANT]
> **Decision 4: WCAG 2.2 AA Accessibility Enforcement**
> - Automated Axe accessibility scans run in every E2E test.
> - **Critical & Serious** violations trigger immediate test assertion failures.
> - **Moderate & Minor** findings are logged and aggregated into test reports without breaking builds.

> [!NOTE]
> **Decision 5: CI-First Scheduled Automation via GitHub Actions**
> - Dedicated scheduled nightly workflow: `.github/workflows/nightly-test-suite.yml`.
> - Runs the full test suite (Backend JaCoCo, Vitest V8, and Playwright 10-spec E2E matrix), archives reports as artifacts, and gates PR builds.

---

## 3. Four-Phase Progressive Rollout Roadmap

### Phase 1: Tooling, Coverage Instrumentation & Dual-Mode Playwright Configuration
1. **Backend JaCoCo Configuration**:
   - Add `jacoco-maven-plugin` (version 0.8.12) to `apps/backend/pom.xml` and `apps/backend/unipost-fw/pom.xml`.
   - Configure execution goals `prepare-agent` (for test argLine) and `report` in the `verify` lifecycle phase (reporting active; threshold check staged for Phase 2).
   - Configure exclusions for auto-generated DTOs, JPA metamodels, and configuration classes without business logic.
2. **Frontend `@vitest/coverage-v8` Setup**:
   - Install `@vitest/coverage-v8` in `apps/console` and `packages/sandbox`.
   - Update `apps/console/vitest.config.ts` and `packages/sandbox/vitest.config.ts` with `v8` provider and `['text', 'json', 'html', 'lcov']` reporters.
   - Add `"test:coverage": "vitest run --coverage"` scripts to `apps/console/package.json` and `packages/sandbox/package.json`.
3. **Dual-Mode Playwright Configuration**:
   - Update `apps/console/playwright.config.ts` to support `E2E_MODE=live` vs `E2E_MODE=sandbox` (default).
   - Implement health-check verification in `globalSetup` when `E2E_MODE=live`.
   - In Sandbox mode: webServer runs `pnpm --filter @unipost/console dev:sandbox --port 5173`.
   - In Live mode: webServer verifies Spring Boot backend at `http://localhost:8000/api` and Vite console at `http://localhost:5173`.
   - Add scripts `"test:e2e"` (sandbox) and `"test:e2e:live"` to `apps/console/package.json`.
4. **CI-First Scheduled Automation**:
   - Create `.github/workflows/nightly-test-suite.yml` configuring nightly cron execution, unit/integration runs, Playwright E2E execution, and HTML coverage artifact uploads.

---

### Phase 2: Backend >=90% Coverage Sprint (Unit + Spring Modulith Integration)
1. **Unit Testing Expansion (`apps/backend/unipost-fw/src/test/java/`)**:
   - `DynamicQueryCompilerTest`: 100% branch coverage across all join patterns (Pattern A Embedded, Pattern B FK, Pattern C Association), companion rollups (SUM, COUNT, AVG, MIN, MAX), child slice pagination, parameterized sorting, and fuzzing vectors.
   - `RecordMutationPipelineTest`: OCC validation, ETag generation, optimistic locking conflicts, 3-way auto-merging, and delete cascades.
   - `CompositeRecordServiceTest`: Cache miss/hit resolution, Hazelcast serialization, and fallback to DataLoaderBatchResolver.
   - `NoisyNeighborTokenBucketLimiterTest`: Multi-tenant rate limiting, tier quotas, and token bucket refills.
   - `DlqServiceTest`: Poison task extraction, retry counts, expiration, and DLQ re-drive transactions.
2. **Spring Modulith / MockMvc Integration Testing**:
   - `CompositeRecordControllerIntegrationTest`: Full HTTP request lifecycle with bracket notation query params, JSON responses, and error payloads.
   - `DlqControllerIntegrationTest`: Sovereign custodian role authorization (`ROLE_SYSTEM_CUSTODIAN`), 403 Forbidden enforcement on regular tenants.
   - `TenantOnboardingControllerIntegrationTest`: Atomic provisioning, domain blueprint cloning, and schema pre-warming.
   - `BillingPayOsControllerIntegrationTest`: Webhook HMAC-SHA256 signature verification, idempotent transaction processing, and feature entitlement activation.
3. **JaCoCo 90% Hard Gate Activation**:
   - Activate JaCoCo `check` execution with `<minimum>0.90</minimum>` in `apps/backend/unipost-fw/pom.xml`.
   - Run `mvn verify` and verify that the build passes with instruction and branch coverage >= 90%.

---

### Phase 3: Console & Sandbox >=90% Coverage Sprint (Unit + React Integration)
1. **`@unipost/sandbox` 100% Handler & Store Coverage**:
   - Unit tests for all domain handlers in `packages/sandbox/src/handlers/`:
     - `auth-sandbox-handler.test.ts`: Login, token refresh, logout, persona decoding.
     - `metadata-sandbox-adapter.test.ts`: Schema CRUD, composite record resolution, rollups calculation, child filtering.
     - `workflow-handler.test.ts`: DAG executions, node state transitions.
     - `billing-sandbox-handler.test.ts`: QR generation, subscription upgrades.
     - `dlq-sandbox-handler.test.ts`: Poison task injection, re-drive, discard.
   - State tests for `SandboxStoreManager` and simulation decorators.
2. **`@unipost/console` Unit & Store Coverage**:
   - `use-metadata-ui-store.test.ts`: Model selection, grid pagination state, filter clauses, tab sync.
   - `use-spring-auth-store.test.ts`: Token decoding, session persistence, token expiration.
   - `workflow-ir-converter.test.ts`: Canvas nodes to execution units conversion.
3. **`@unipost/console` Component Integration Testing**:
   - `entity-data-grid.test.tsx`: Search filtering, sorting, column visibility, pagination, backfill dialog.
   - `schema-builder.test.tsx`: Attribute creation, type selection, validation constraints, display reordering.
   - `record-editor-dialog.test.tsx`: Dynamic form fields, schema validation, save mutations.
   - `composite-rollup-builder.test.tsx`: Adding rollups, function selection, alias generation.
   - `payos-qr-modal.test.tsx`: VietQR rendering, countdown timer, simulated webhook trigger.
   - `dlq-management-table.test.tsx`: Poison task list, error inspection drawer, bulk re-drive.
4. **Vitest V8 90% Hard Gate Activation**:
   - Configure `thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 }` in `vitest.config.ts`.
   - Run `pnpm --filter @unipost/console test:coverage` and assert >= 90% across all metrics.

---

### Phase 4: Core Playwright E2E Golden Journey Matrix (20% Focus) & Scheduled Automation
Implement the complete 10-spec suite of Golden E2E Browser Journeys (`apps/console/e2e/`) with AxeBuilder WCAG 2.2 AA audits (failing on critical/serious):

| Spec File | Flow Name | Key Invariants & Actions | Accessibility Scan |
| :--- | :--- | :--- | :---: |
| `01-auth-and-personas.spec.ts` | Persona Switching & Tenant Boundary | Sign-in page, Sandbox bypass dropdown, switching from Admin to Sovereign Custodian, verifying tenant badge in top bar. | WCAG 2.2 AA (Critical/Serious) ✅ |
| `02-metadata-schema-studio.spec.ts` | Schema Builder & Dynamic Fields | Navigate to `/metadata`, switch to Architect Mode, create a new custom model, add STRING & NUMBER attributes, verify schema version increment. | WCAG 2.2 AA (Critical/Serious) ✅ |
| `03-composite-entities-explorer.spec.ts` | Composite 360 & Master-Detail | Select Customer 360 View, verify computed rollups bar, expand child collections, switch child tabs, filter child rows by keyword. | WCAG 2.2 AA (Critical/Serious) ✅ |
| `04-record-crud-lifecycle.spec.ts` | Base Entity CRUD & OCC Audit | Create entity record, update attributes, verify optimistic lock version, open Audit History Drawer, inspect diff viewer. | WCAG 2.2 AA (Critical/Serious) ✅ |
| `05-visual-dag-workflows.spec.ts` | Visual DAG Studio & Execution Replay | Open Visual DAG Studio, drag and connect tasks, trigger execution, observe live telemetry and time-travel replay slider. | WCAG 2.2 AA (Critical/Serious) ✅ |
| `06-sovereign-dlq-operations.spec.ts` | Sovereign DLQ & Fleet Management | Sovereign Custodian visits `/system/dlq`, inspects poisoned task stack trace, clicks "Re-drive to Queue", verifies task removed from DLQ. | WCAG 2.2 AA (Critical/Serious) ✅ |
| `07-worker-fleet-telemetry.spec.ts` | Worker Fleet & Drain Lifecycle | Visit `/system/workers`, inspect active workers, trigger graceful drain on idle worker, verify state transitions. | WCAG 2.2 AA (Critical/Serious) ✅ |
| `08-finops-vietqr-billing.spec.ts` | PayOS VietQR Subscription Upgrade | Visit `/settings?tab=billing`, select Pro plan, verify VietQR modal displays dynamic QR code, simulate payment, verify instant tier upgrade. | WCAG 2.2 AA (Critical/Serious) ✅ |
| `09-multi-workspace-isolation.spec.ts` | Workspace Switcher & RLS Isolation | Switch between Production and Staging workspaces, verify distinct entity schemas and records with zero cross-tenant bleed. | WCAG 2.2 AA (Critical/Serious) ✅ |
| `10-faceted-search-and-export.spec.ts` | Faceted Search & Streaming Export | Open Faceted Search sidebar, filter by multiple facets, click "Export Records", verify non-blocking streaming download. | WCAG 2.2 AA (Critical/Serious) ✅ |

---

## 4. Verification Plan

### Automated Commands
```powershell
# 1. Backend Verification & JaCoCo Coverage Check
& "C:\Users\Admin\.m2\wrapper\dists\apache-maven-3.9.9-bin\6gbr3tfuiv8aocduf5pro8ephc\apache-maven-3.9.9\bin\mvn.cmd" clean verify -f apps/backend/pom.xml -q

# 2. Console & Sandbox Vitest Coverage Verification
pnpm --filter @unipost/sandbox test:coverage
pnpm --filter @unipost/console test:coverage

# 3. Playwright E2E Matrix (Mode 1: Unified Sandbox Autonomous)
pnpm --filter @unipost/console exec playwright test

# 4. Playwright E2E Matrix (Mode 2: Live Backend)
$env:E2E_MODE="live"; pnpm --filter @unipost/console exec playwright test

# 5. Full Monorepo Typecheck & Build
pnpm check-types
pnpm --filter @unipost/console build
```
