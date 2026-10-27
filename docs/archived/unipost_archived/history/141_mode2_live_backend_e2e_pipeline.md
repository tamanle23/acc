# History Entry 141: Mode 2 Live Backend E2E Testing Pipeline Hardening

## Problem Statement
Iteration 10 Phase 2 required operationalizing **Mode 2: Live Backend E2E Pipeline Hardening (`test:e2e:live`)**.
Previous E2E runs were executed under Mode 1 (Autonomous Unified Sandbox mock engines). To validate true full-stack invariants across real network calls, PostgreSQL RLS tenant partitioning, and live Spring Boot services:
1. Playwright needed automated pre-flight health polling and seamless server lifecycle management for both backend and frontend.
2. The Spring Boot backend required resolution of bean creation and dependency injection issues under the sandbox profile (specifically, reflection instantiation of `RecordMutationPipeline` and MapStruct file mapping dependencies).
3. The 15 Golden Flow Playwright specs had to run identically in both Mode 1 (`pnpm test:e2e`) and Mode 2 (`pnpm test:e2e:live`), maintaining 0 critical/serious WCAG 2.2 AA accessibility violations and robust element locators.

## Implementation Details

### 1. Backend Auto-Configuration & Constructor Injection Fixes
- Added `@org.springframework.beans.factory.annotation.Autowired` to the primary 9-argument constructor of `com.acc.service.RecordMutationPipeline`.
- Replaced ambiguous reflection auto-detection so that Spring Boot's dependency injection container correctly resolves all JPA repositories, audit logs, and `SchemaValidationService`.
- Executed clean multi-module Maven compilation and packaging of `acc-fw` and `acc-ms-aio`.

### 2. Playwright Mode 2 Configuration & Global Setup
- Updated `apps/console/playwright.config.ts`:
  - Configured `webServer` for `isLiveMode` to execute the pre-packaged Spring Boot sandbox jar with DEV pristine flags on port 8000 and the Vite frontend on port 5173.
  - Enabled `reuseExistingServer: true` so development and CI environments can utilize running servers or auto-spawned instances.
- Enhanced `apps/console/e2e/global-setup.ts` with a resilient 15-second polling retry loop checking `http://localhost:8000/actuator/health` to confirm backend readiness before launching browser workers.

### 3. Strict Mode Locator Hardening in Golden Flow Specs
- Updated `apps/console/e2e/08-finops-vietqr-billing.spec.ts`:
  - Disambiguated the payment success confirmation text locator using `.first()` to prevent Playwright strict mode violations when multiple status badges and toast notices contain "thành công".

## Verification & Results
1. **Live Backend Startup & Actuator Health**:
   - Actuator health check at `http://localhost:8000/actuator/health` returned HTTP 200 `{"groups":["liveness","readiness"],"status":"UP"}`.
   - PGlite embedded database initialized with DEV pristine scratch directory wiping and RLS tenant enforcement.
2. **Mode 2 Live E2E Matrix Execution (`pnpm test:e2e:live`)**:
   - All 15 Golden Flow specs passed against the live Spring Boot server in 34.4s:
     - `01-auth-and-personas.spec.ts`: Persona switching & tenant boundary invariants.
     - `02-metadata-schema-studio.spec.ts`: Schema studio navigation & field inspection.
     - `03-composite-entities-explorer.spec.ts`: Customer 360 view & child collections.
     - `04-record-crud-lifecycle.spec.ts`: Data grid & OCC version tags.
     - `05-visual-dag-workflows.spec.ts`: DAG studio designer & execution replay.
     - `06-sovereign-dlq-operations.spec.ts`: Poison task DLQ inspection sheet.
     - `07-worker-fleet-telemetry.spec.ts`: Telemetry polling & worker drain action.
     - `08-finops-vietqr-billing.spec.ts`: VietQR payment modal & simulated webhook confirmation.
     - `09-multi-workspace-isolation.spec.ts`: Workspace management & profile switching.
     - `10-faceted-search-and-export.spec.ts`: Faceted search & JSON export trigger.
     - `composite-entities.spec.ts`: Composite entity filters & sub-tabs.
     - `console-e2e.spec.ts` (4 specs): Landing gallery, multi-tenant studio, payOS pricing, and GDPR privacy controls.
3. **Mode 1 Offline E2E Matrix Regression (`pnpm test:e2e`)**:
   - All 15 specs passed cleanly offline against client mock engines in 33.5s.
4. **Console Unit Test Suite (`pnpm test`)**:
   - 62 test files passed, 298/298 tests green in 10.01s.
5. **Accessibility Invariants**:
   - 0 critical or serious WCAG 2.2 AA violations detected by AxeBuilder across all 15 journeys.
