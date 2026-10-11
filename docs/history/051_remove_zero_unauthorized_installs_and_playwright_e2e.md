# History Log 051: Remove Zero Unauthorized Installs & Implement Playwright Browser E2E Testing

## Problem
During the iterative execution of Phases 1 through 15 from `docs/brainstorming/integration_master_plan_iteration_1.md`, Phase 15 included specifications for:
1. Browser-level End-to-End (E2E) UI automation.
2. Automated WCAG 2.2 AA accessibility and contrast audits using `@axe-core/playwright`.

However, due to a previous agent rule constraint (`Zero Unauthorized Installs: DO NOT introduce new external libraries, packages, or frameworks without explicit human authorization`), browser-level Playwright automation packages were omitted and L4/L5 tests relied exclusively on Vitest in-memory mocks.

The user explicitly requested:
1. Remove the "Zero Unauthorized Installs" rule.
2. Re-evaluate Phase 1 through Phase 15 to identify and resolve any missing implementations resulting from that constraint.

## Plan
1. **Rule Modification**: Remove the Zero Unauthorized Installs constraint from `.agents/rules/00-generic-common.md`.
2. **Phase 1–15 Comprehensive Audit**:
   - Verify that all architectural abstractions across Phases 1–14 (packages extraction `@unipost/client`, `@unipost/sandbox`, `@unipost/tokens`, mobile stores/forms/outbox, gateway key authentication, HMAC webhooks, 3-way auto-merge, transactional outbox, FSM state machines, distributed tracing) were correctly implemented without gaps.
   - Confirm that the only missing implementation was browser-level Playwright UI testing and Axe-core WCAG 2.2 AA automation in Phase 15.
3. **Playwright E2E Suite Setup**:
   - Add `@playwright/test` and `@axe-core/playwright` to `apps/console`.
   - Install Chromium browser binaries.
   - Configure `apps/console/playwright.config.ts` with auto-starting `webServer` targeting Vite dev server on port 5173.
   - Author `apps/console/e2e/console-e2e.spec.ts` covering:
     - Golden Flow 1 & Automated WCAG 2.2 AA Audit via `AxeBuilder`.
     - Golden Flow 2: Multi-Tenant Context & Studio Exploration.
     - Golden Flow 3: FinOps payOS Pricing Tier Invariants.
   - Add `"test:e2e": "playwright test"` script to `apps/console/package.json`.
4. **Verification**:
   - Execute `pnpm --filter @unipost/console test:e2e` to confirm 100% pass rate in real Chromium headless browser.
   - Execute `pnpm turbo run test` across all monorepo packages.
   - Execute backend Maven test suite.

## Changes
- **`.agents/rules/00-generic-common.md`**: Removed the Zero Unauthorized Installs line.
- **`apps/console/package.json`**: Added `@playwright/test` and `@axe-core/playwright` as devDependencies, added `test:e2e` script.
- **`apps/console/playwright.config.ts`**: Created Playwright test configuration with Vite dev server integration.
- **`apps/console/e2e/console-e2e.spec.ts`**: Created comprehensive E2E test file covering navigation, tenant switching, payOS studio cards, and Axe WCAG 2.2 AA scans.

## Verification
- `pnpm --filter @unipost/console test:e2e`: **3/3 passed** in 9.8s.
- `pnpm turbo run test`: **6/6 tasks successful** across all packages.
- `.\mvnw.cmd test`: **10/10 modules green**.

## Walkthrough
1. Running `pnpm --filter @unipost/console test:e2e` spins up Vite on `localhost:5173` and launches Playwright in headless Chromium.
2. Real DOM elements render with Liquid Glass tokens and the Unified Sandbox Mock engine active.
3. `AxeBuilder` executes WCAG 2.2 AA accessibility audit against the landing page, confirming 0 critical violations.
4. Tenant selection and payOS FinOps pricing features are verified directly through interactive browser automation.
