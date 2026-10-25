# [128] Automated Testing Phase 1 Tooling, Instrumentation & Dual-Mode E2E

## Problem
To achieve >=90% test coverage across the core monorepo production stack (`@acc/backend`, `@acc/console`, and `packages/sandbox`), the project lacked unified coverage instrumentation (JaCoCo in Maven, `@vitest/coverage-v8` in Vite/Vitest), dual-mode Playwright execution (offline Sandbox autonomous mode vs pre-warmed Live Spring Boot mode), automated WCAG 2.2 AA accessibility gating, and a scheduled nightly CI testing workflow.

## Plan
1. Configure `jacoco-maven-plugin` (0.8.12) in backend with `prepare-agent` and `report` goals.
2. Install and configure `@vitest/coverage-v8` in `apps/console`, updating scripts and adding HTML/lcov reporting.
3. Update Playwright configuration for dual-mode execution with health-check fail-fast for live backend mode and WCAG 2.2 AA accessibility helper.
4. Set up scheduled GitHub Actions automation workflow (`.github/workflows/nightly-test-suite.yml`).
5. Ensure 100% test pass rate across backend and frontend suites.

## Changes
- **Backend Build & Instrumentation**:
  - [`apps/backend/pom.xml`](apps/backend/pom.xml): Added `jacoco-maven-plugin` (version 0.8.12) with agent preparation and report lifecycle execution.
  - [`apps/backend/acc-fw/src/main/java/com/acc/service/RecordMutationPipeline.java`](apps/backend/acc-fw/src/main/java/com/acc/service/RecordMutationPipeline.java): Injected `ObjectMapper` and implemented 1MB payload size hard-cap enforcement throwing `MetadataConflictException`.
  - [`apps/backend/acc-fw/src/main/java/com/acc/service/SchemaValidationService.java`](apps/backend/acc-fw/src/main/java/com/acc/service/SchemaValidationService.java): Overloaded `validatePayload` and `validatePayloadDryRun` to accept explicit `tenantId`.
  - [`apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java`](apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java): Added `ObjectMapper` import and wired into pipeline initialization.
- **Frontend Coverage & Testing**:
  - [`apps/console/package.json`](apps/console/package.json): Added `@vitest/coverage-v8` devDependency, `"test:coverage"` and `"test:e2e:live"` scripts.
  - [`apps/console/vitest.config.ts`](apps/console/vitest.config.ts): Added `coverage` block with `v8` provider and HTML/JSON/lcov reporters.
  - [`apps/console/src/core/sandbox/__tests__/sandbox-dock.test.tsx`](apps/console/src/core/sandbox/__tests__/sandbox-dock.test.tsx): Wrapped rendering in `QueryClientProvider`.
  - [`packages/sandbox/src/handlers/workflow-handler.ts`](packages/sandbox/src/handlers/workflow-handler.ts): Added backward-compatibility aliases `tasksSandboxRepo` and `tasksSandboxHandler`.
- **Playwright Dual-Mode Framework**:
  - [`apps/console/playwright.config.ts`](apps/console/playwright.config.ts): Added dual-mode webServer selection, HTML reporting, and `globalSetup`.
  - [`apps/console/e2e/global-setup.ts`](apps/console/e2e/global-setup.ts): Pre-flight health check verifying Spring Boot on port 8000 when `E2E_MODE=live`, with clear fail-fast instructions.
  - [`apps/console/e2e/helpers/axe-helper.ts`](apps/console/e2e/helpers/axe-helper.ts): WCAG 2.2 AA accessibility helper failing on Critical/Serious violations and logging Moderate/Minor advisories.
- **Scheduled CI Automation**:
  - [`.github/workflows/nightly-test-suite.yml`](.github/workflows/nightly-test-suite.yml): GitHub Actions workflow scheduled nightly at 02:00 UTC running backend JaCoCo, frontend Vitest, and Playwright 10-spec browser matrix.
  - [`.gitignore`](.gitignore): Added test and coverage output artifacts (`coverage`, `playwright-report`, `test-results`, `*.exec`).

## Verification
- `mvn test -f apps/backend/acc-fw/pom.xml -q`: 207 / 207 tests passed (0 failures).
- `mvn jacoco:report -f apps/backend/acc-fw/pom.xml -q`: HTML coverage report generated in `target/site/jacoco/index.html`.
- `vitest run src/core/sandbox/__tests__/`: 10 test files, 65 tests passed.
- `vitest run` on `packages/sandbox`: 11 tests passed.
- `playwright test apps/console/e2e/composite-entities.spec.ts`: Passed in 5.5s (Mode 1 Sandbox Autonomous).
- `E2E_MODE=live playwright test`: Verified fast 1s fail-fast with diagnostic instructions.
- `tsc --noEmit`: Clean typechecking.

## Walkthrough
Refer to [`apps/console/doc/walkthrough_116.md`](../../apps/console/doc/walkthrough_116.md).

## Tasks
- [x] Configure backend `jacoco-maven-plugin`
- [x] Configure frontend `@vitest/coverage-v8`
- [x] Update Playwright for dual-mode execution with health check
- [x] Implement WCAG 2.2 AA accessibility gating helper
- [x] Configure nightly scheduled GitHub Actions workflow
- [x] Fix backward compatibility aliases and test wrappers

## Enhancement
Ready to proceed with Phase 2: Backend >=90% Coverage Sprint (adding targeted tests for DynamicQueryCompiler, RecordMutationPipeline, CompositeRecordService, and Spring Modulith slice tests, then ratcheting JaCoCo check to 0.90).
