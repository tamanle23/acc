# History Log 052: Monorepo Verification of Section 13 Architectural Invariants

## Problem
Following the completion of Phases 1 through 15 and the introduction of Playwright E2E browser automation, the 9 non-negotiable architectural invariants defined in Section 13 of `docs/brainstorming/integration_master_plan_iteration_1.md` required a formal, end-to-end verification across all applications and shared packages.

## Plan
1. **Systematic Invariant Audit**:
   - **RLS Invariant**: Verify tenant SQL context wrapping and PostgreSQL RLS constraints.
   - **FSM Invariant**: Verify that lifecycle state transitions adhere to the 5 validation gates in `EntityLifecycleService`.
   - **Facade Invariant**: Audit all UI components for rogue `axios`/`fetch` calls; replace raw calls with typed facades (`springApiClient`).
   - **Selector Invariant**: Verify atomic Zustand store selectors across components.
   - **Idempotency Invariant**: Ensure background jobs and outbox mutations maintain idempotency keys.
   - **Zero-Rogue-Mock Invariant**: Ensure all simulated endpoints register through `SandboxRegistry`.
   - **Traceability Invariant**: Verify standard W3C `traceparent` headers on outgoing requests.
   - **Accessibility Invariant**: Confirm WCAG 2.2 AA contrast compliance and fix label/form semantics flagged by `@axe-core/playwright`.
   - **Type Integrity Invariant**: Verify strict typechecking with `tsc --noEmit` and `turbo run check-types`.
2. **Resolve Identified Invariant Gaps**:
   - In `apps/console/src/features/settings/data-privacy/data-privacy-panel.tsx`: Replaced raw `axios.get` and `axios.post` with `springApiClient`.
   - In `apps/console/src/features/landing/components/landing-showcase.tsx`: Added explicit `id`, `htmlFor`, and `aria-label` attributes to dynamic mockup input fields to eliminate critical Axe form-label accessibility violations.
   - In `packages/client/src/__tests__/contract-schema.test.ts`: Fixed typed attribute definitions to align with `AttributeDefinition.isRequired` and `DataType` literal typing.
   - In `apps/console/src/core/sandbox/__tests__/axios-sandbox-adapter.test.ts`: Added timeout configuration for fallback network test.
3. **Run Full Multi-Module Verification**:
   - Execute Playwright E2E test suite in Chromium.
   - Execute Turborepo test runner across all monorepo packages.
   - Execute Turborepo `check-types` across all modules.
   - Execute `tekgo-ui` Next.js production build.
4. **Git Archival**: Record history log 052 and commit changes under Conventional Commits.

## Verification
- `pnpm turbo run check-types`: **4/4 tasks passed**.
- `pnpm turbo run test`: **6/6 tasks passed** (155 console tests, 13 mobile-ui tests, all client/backend tests).
- `pnpm --filter @acc/console test:e2e`: **3/3 passed** (including real `@axe-core/playwright` WCAG 2.2 AA scan with 0 critical violations).
- `pnpm --filter tekgo-ui build`: Next.js 15.5.12 SSG/ISR static generation succeeded for all 95 pages.
- Section 13 Checklist: All 9 invariants checked off in `docs/brainstorming/integration_master_plan_iteration_1.md`.
