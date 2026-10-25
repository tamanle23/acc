# Walkthrough 116: Automated Testing Phase 1 Tooling, Coverage Instrumentation & Dual-Mode E2E

## Overview
Successfully implemented and verified **Phase 1** of the Enterprise Automated Testing Pipeline according to [docs/integration_master_plan_iteration7.md](../../../docs/integration_master_plan_iteration7.md).

## Completed Work

### 1. Backend JaCoCo Coverage & Hardened Validation
- Configured `jacoco-maven-plugin` (0.8.12) in `apps/backend/pom.xml` with `prepare-agent` (setting Surefire argLine) and `report` goals.
- Fixed 1MB payload hard-cap checking in `RecordMutationPipeline.java` and `SchemaValidationService.java` to prevent security and RedoS vulnerabilities when payloads exceed 1MB.
- Fixed `tasksSandboxRepo` and `tasksSandboxHandler` backward compatibility aliases in `packages/sandbox/src/handlers/workflow-handler.ts`.
- Verified all 207 unit and slice tests pass in `apps/backend/acc-fw` and confirmed JaCoCo binary (`jacoco.exec`) and HTML report (`target/site/jacoco/index.html`) generation.

### 2. Frontend Vitest Coverage Pipeline
- Installed `@vitest/coverage-v8` in `apps/console`.
- Configured `coverage` block with `v8` provider and `['text', 'json', 'html', 'lcov']` reporters in `apps/console/vitest.config.ts`.
- Added `"test:coverage": "vitest run --coverage"` and `"test:e2e:live": "cross-env E2E_MODE=live playwright test"` to `apps/console/package.json`.
- Fixed `SandboxDock` rendering in tests with `QueryClientProvider` wrapper.
- Verified 100% test pass rate across all 10 sandbox suites (65 tests) and 11 packages/sandbox tests.

### 3. Dual-Mode Playwright Framework & Pre-Flight Gating
- Updated `apps/console/playwright.config.ts` to support `E2E_MODE=live` vs `E2E_MODE=sandbox` (default).
- Implemented `apps/console/e2e/global-setup.ts` which runs pre-flight health checks against `http://localhost:8000/actuator/health` or `/api` in Live Mode, failing fast with actionable diagnostic guidance if backend services are offline.
- Created `apps/console/e2e/helpers/axe-helper.ts` enforcing the grilled WCAG 2.2 AA decision: hard assertion failures on Critical and Serious violations, while logging Moderate and Minor issues as advisories.
- Verified Playwright Mode 1 (Sandbox Autonomous) successfully passes on `composite-entities.spec.ts` in 5.5s with zero accessibility violations.

### 4. CI-First Scheduled Automation
- Created `.github/workflows/nightly-test-suite.yml` scheduled nightly at `02:00 UTC` with `workflow_dispatch` options.
- Configured 3-stage pipeline: Backend JaCoCo Coverage Matrix, Frontend Vitest Coverage Matrix, and Playwright 10-spec E2E Matrix with artifact uploads.

## Verification Results
| Component | Command | Result |
| :--- | :--- | :---: |
| Backend Tests + JaCoCo | `mvn test -f apps/backend/acc-fw/pom.xml -q` | 207 / 207 Passed ✅ |
| JaCoCo HTML Report | `mvn jacoco:report -f apps/backend/acc-fw/pom.xml -q` | Generated ✅ |
| Sandbox Core Suites | `vitest run src/core/sandbox/__tests__/` | 65 / 65 Passed ✅ |
| Playwright Mode 1 | `playwright test e2e/composite-entities.spec.ts` | Passed (5.5s) ✅ |
| Playwright Mode 2 Fail-Fast | `E2E_MODE=live playwright test` | Verified Fail-Fast ✅ |
| TypeScript Types | `tsc --noEmit` | Clean (0 errors) ✅ |
