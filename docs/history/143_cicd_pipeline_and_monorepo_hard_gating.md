# History Entry 143: CI/CD Pipeline & Monorepo Hard-Gating (Iteration 10 Phase 4)

## Problem Statement
Iteration 10 Phase 4 required operationalizing **CI/CD Pipeline & Monorepo Hard-Gating**.
With Dual-Mode E2E testing (Mode 1 Autonomous Sandbox and Mode 2 Live Backend) established, the CI/CD pipelines needed to support both automated triggers and dispatch workflows:
1. `.github/workflows/nightly-test-suite.yml` needed to support testing against either Mode 1 or Mode 2 live backend via workflow dispatch or nightly schedule, building the backend AIO artifact and executing `pnpm test:e2e:live`.
2. All 5 core verification gates across the monorepo had to pass cleanly with exit code 0:
   - Console Vitest tests & offline parity
   - Backend Sandbox Suite (`unipost-sandbox`)
   - Spring Modulith Architecture (`ModularityTests`)
   - Mode 1 Playwright E2E Suite (`pnpm test:e2e`)
   - Sibling client builds (`tekgo-ui` Next.js 15 SSR & `mobile-ui` Vitest)

## Implementation Details

### 1. GitHub Actions Nightly & Live E2E Integration
- Updated `.github/workflows/nightly-test-suite.yml`:
  - Added conditional Java 21 setup and Maven packaging step `mvn clean package -f apps/backend/pom.xml -DskipTests -q` when `e2e_mode == 'live'`.
  - Replaced single-mode execution with dual-mode branch:
    - If `e2e_mode == 'live'`, runs `pnpm test:e2e:live` with live Spring Boot backend server auto-spawn and PGlite RLS.
    - If `e2e_mode == 'sandbox'`, runs `pnpm test:e2e` against deterministic client mock engines.
  - Retained Playwright HTML test report and trace archiving.

### 2. Comprehensive Monorepo Verification
- Executed and validated all verification commands:
  - `pnpm test:backend:sandbox`: 33/33 tests passed in 44.3s.
  - `pnpm --filter @unipost/backend test:modulith`: `ModularityTests` passed cleanly in 24.3s.
  - `pnpm test:e2e`: 15/15 Golden Journey specs passed in 44.5s.
  - `pnpm --filter tekgo-ui build`: 95/95 static pages generated with 0 SSR hook errors.
  - `pnpm --filter mobile-ui test`: 23/23 tests green in 803ms.
  - `pnpm --filter @unipost/console test`: 298/298 tests green in 10s.

## Verification & Gating Results

| Verification Gate | Command | Result | Duration | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Backend Sandbox** | `pnpm test:backend:sandbox` | **33/33 Passed** | 44.3s | PGlite, S3, Webhooks, PayOS VietQR simulators |
| **Spring Modulith** | `pnpm test:modulith` | **1/1 Passed** | 24.3s | Architectural boundary verification |
| **Console E2E (Mode 1)** | `pnpm test:e2e` | **15/15 Passed** | 44.5s | 0 WCAG 2.2 AA violations |
| **Console E2E (Mode 2)** | `pnpm test:e2e:live` | **15/15 Passed** | 34.4s | Live Spring Boot + PGlite RLS + 0 WCAG violations |
| **Portal Build** | `pnpm --filter tekgo-ui build` | **Passed (Exit 0)** | 1.3s | 95/95 static pages generated |
| **Mobile Tests** | `pnpm --filter mobile-ui test` | **23/23 Passed** | 803ms | Dynamic form, outbox, and sandbox tests |
| **Console Tests** | `pnpm --filter @unipost/console test` | **298/298 Passed** | 10.0s | 62 test files green |
