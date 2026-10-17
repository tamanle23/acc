# Implementation Plan 115: Phase 45 - Enterprise Resilience, Performance Benchmarking & Chaos Verification

## 1. Executive Summary & Architectural Overview
Phase 45 concludes Iteration 6 of the Unipost metadata engine by conducting rigorous **Enterprise Resilience, Performance Benchmarking & Chaos Verification** across the newly delivered Composite Entity engine (Phases 41–44).

In accordance with architectural grilling decisions and the `/automated-testing` skill directives:
1. **Multi-Threaded Benchmark Harness**:
   - `CompositeQueryPerformanceBenchmarkTest.java`: Multi-threaded test harness driving 1,000 concurrent composite queries via virtual/fixed thread pools (`ExecutorService`), measuring p50, p95, p99 latencies and throughput (req/sec).
   - Generates persistent Markdown benchmark report at `docs/benchmarks/phase_45_benchmark_report.md`.
2. **Quad-Chaos Engineering Matrix**:
   - `CompositeChaosResilienceTest.java` validates 4 critical failure modes:
     1. **Statement Timeout Failover**: Simulates PostgreSQL statement timeout (`1500ms`), asserting graceful fallback to `DataLoaderBatchResolver` without request failure (`X-Composite-Engine: dataloader-batch-resolver`).
     2. **Adversarial Recursion & Graph Cycle Guard**: Injects circular joins ($A \to B \to A$) and depth > 4 trees, asserting immediate rejection (`400 Bad Request` / `IllegalArgumentException`).
     3. **Cross-Tenant Data Isolation Storm**: Concurrent multi-tenant query blast asserting 0 cross-tenant data leakage.
     4. **SQLi & Parameter Fuzzing**: Fuzz testing of `childQueries` parameter with SQL injection payloads, malformed JSON, and oversized limits, asserting parameterized safety and bounded limit ceilings.
3. **Full-Spectrum Frontend Verification**:
   - Comprehensive Vitest suite `composite-data-explorer.test.tsx` verifying end-to-end user interactions: sidebar rail filter toggle $\to$ auto-select $\to$ tab auto-transition $\to$ row auto-expand $\to$ rollup KPI chips $\to$ child tab search/sort/paginate.
4. **Playwright E2E Browser Automation**:
   - `apps/console/e2e/composite-entities.spec.ts` executing headless browser interactions against `@unipost/console` to verify visual rendering and accessibility in real DOM.
5. **Monorepo Integrity & Quality Gate**:
   - Turborepo typechecks (`pnpm check-types`), full test suites, and production build verification.

---

## 2. Proposed Changes

### A. Backend Benchmark & Chaos Test Suites (`apps/backend/unipost-fw`)
- Create `apps/backend/unipost-fw/src/test/java/com/unipost/service/CompositeQueryPerformanceBenchmarkTest.java`:
  - 1,000 concurrent queries over single-record lookups, root pagination, child slice pagination, dynamic child filters, and companion lateral rollups.
  - Generates `docs/benchmarks/phase_45_benchmark_report.md`.
  - Asserts p95 latency ceiling and 100% request success rate.
- Create `apps/backend/unipost-fw/src/test/java/com/unipost/service/CompositeChaosResilienceTest.java`:
  - Quad-chaos test methods: `testStatementTimeoutFallback()`, `testAdversarialRecursionAndCycleRejection()`, `testCrossTenantIsolationStorm()`, `testChildQueryFuzzingAndSqlInjectionSafety()`.

### B. Frontend Vitest Integration Suite (`apps/console`)
- Create `apps/console/src/features/metadata/components/data-explorer/composite-data-explorer.test.tsx`:
  - Integrates `EntityTypeSidebar`, `MetadataFeature`, and `EntityDataGrid`.
  - Asserts composite toggle filtering, auto-transition, row auto-expansion, rollup chips, and search/sort behaviors.

### C. Playwright E2E Browser Test (`apps/console`)
- Create `apps/console/e2e/composite-entities.spec.ts`:
  - Playwright test navigating to `/metadata`, toggling "Composite Entities", expanding master-detail rows, checking KPI chips, and exercising child pagination in headless Chromium.

### D. Documentation, Benchmarks & Git Archival
- `docs/benchmarks/phase_45_benchmark_report.md`: Markdown report of benchmark metrics.
- `apps/console/doc/walkthrough_115.md`: Walkthrough of benchmark and chaos verification results.
- `docs/history/127_phase_45_enterprise_resilience_benchmarking_chaos.md`: History log.
- `docs/history/README.md`: Index update.
- Git commit: `[127] test(metadata): enterprise resilience, performance benchmarking and chaos verification (phase 45)`.

---

## 3. Verification & Automated Test Strategy

1. **Backend Maven Execution**:
   - Run benchmark and chaos test suites:
     `mvn test -f apps/backend/pom.xml -pl unipost-fw "-Dtest=CompositeQueryPerformanceBenchmarkTest,CompositeChaosResilienceTest,DynamicQueryCompilerTest,CompositeRecordServiceTest,CompositeEntityTypeVerificationTest,RecordMutationPipelineTest" -q`
2. **Frontend Vitest Suites**:
   - Run all console metadata test suites:
     `pnpm --filter @unipost/console test run`
3. **Playwright E2E Test**:
   - Run Playwright browser test:
     `pnpm --filter @unipost/console exec playwright test e2e/composite-entities.spec.ts`
4. **Typecheck & Monorepo Build**:
   - `pnpm --filter @unipost/console exec tsc --noEmit`
   - `pnpm check-types`
