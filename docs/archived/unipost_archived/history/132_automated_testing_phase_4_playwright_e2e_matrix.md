# 132. Automated Testing Phase 4: 10-Spec Golden Playwright E2E Browser Journey Matrix & WCAG 2.2 AA Gating

## Problem
In accordance with `docs/integration_master_plan_iteration7.md`, Phase 4 of automated testing required implementing and validating the complete 10-spec Golden E2E Browser Journey Matrix across `@acc/console`. The tests needed to run deterministically offline in Mode 1 (Unified Sandbox Autonomous) and pass strict `@axe-core/playwright` accessibility audits verifying 0 critical or serious WCAG 2.2 AA violations.

## Plan
1. Create 10 end-to-end test specs covering the golden user journeys:
   - `01-auth-and-personas.spec.ts`
   - `02-metadata-schema-studio.spec.ts`
   - `03-composite-entities-explorer.spec.ts`
   - `04-record-crud-lifecycle.spec.ts`
   - `05-visual-dag-workflows.spec.ts`
   - `06-sovereign-dlq-operations.spec.ts`
   - `07-worker-fleet-telemetry.spec.ts`
   - `08-finops-vietqr-billing.spec.ts`
   - `09-multi-workspace-isolation.spec.ts`
   - `10-faceted-search-and-export.spec.ts`
2. Integrate `auditAccessibility(page)` checks into all 10 journeys.
3. Configure authentication and sandbox dock helper to prevent click interceptions and toast scrim false positives.
4. Correct any UI color contrast or missing accessible labels identified during Axe audits.
5. Verify that all 15 Playwright tests pass cleanly.

## Changes
- **E2E Test Specs**: Created `01-auth-and-personas.spec.ts` through `10-faceted-search-and-export.spec.ts` in `apps/console/e2e/`.
- **E2E Helpers**:
  - `apps/console/e2e/helpers/auth-helper.ts`: Automatically sets `acc_unified_sandbox_minimized: 'true'` so the floating dock stays minimized during browser clicks.
  - `apps/console/e2e/helpers/axe-helper.ts`: Excludes `[data-sonner-toaster]` from accessibility scans so animated toast scrims do not cause contrast false positives.
- **Unified Sandbox & API Routing**:
  - `apps/console/src/core/sandbox/handlers/worker-sandbox-handler.ts`: Added support for `/v1/workflow/workers` and boosted priority.
  - `apps/console/src/core/sandbox/index.ts`: Installed sandbox request interceptor during DEV bootstrapping.
  - `apps/console/src/main.tsx`: Eagerly loaded sandbox registry.
  - `apps/console/src/features/workers/api/worker-fleet-api.ts`: Standardized on `springApiClient` to enable sandbox interception.
  - `packages/sandbox/src/handlers/billing-sandbox-handler.ts`: Supported payment endpoint aliases.
- **WCAG 2.2 AA Contrast & Label Fixes**:
  - `dlq-inspector-sheet.tsx`: Added `tabIndex={0}`, `aria-label`, and high-contrast red/emerald tokens.
  - `profile-switcher.tsx`: High-contrast amber badge tokens for `ROOT`, `ASSUMED`, `NO WORKSPACE`.
  - `workspaces-panel.tsx`: High-contrast amber badge tokens for `MY DEFAULT`.
  - `customer-accounts-explorer.tsx`: High-contrast emerald badge tokens for `Three-Tier Enforced`.
  - `fleet-tenants-table.tsx`: Added accessible labels to SelectTrigger comboboxes.
  - `payos-qr-modal.tsx`: Added accessible label to copy button and adjusted badge contrast.

## Verification
Executed `pnpm --filter @acc/console test:e2e`:
- 15 passed out of 15 tests (10 Golden Flows + composite-entities + legacy console-e2e) in 26.4s with 0 accessibility violations.

## Walkthrough
Refer to `apps/console/doc/walkthrough_120.md` for the full breakdown of flows and test invariants.

## Tasks
- [x] Implement 10 Golden E2E Browser Journey specs in `apps/console/e2e/`
- [x] Integrate WCAG 2.2 AA Axe audits with 0 critical/serious violations
- [x] Fix accessibility contrast tokens and combobox accessible names
- [x] Verify complete E2E test suite passing (15/15)
- [x] Document walkthrough and history record
