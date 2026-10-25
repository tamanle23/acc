# 117 - Update Unified Sandbox for DLQ Screens & Enforce Sandbox Parity Rule

## Problem
Following the migration of the Dead-Letter Queue (DLQ) feature to the Sovereign Root Custodian (`/system/dlq`), the Unified Sandbox lacked fleet-wide cross-tenant poison task visibility and on-demand poison task injection for offline diagnosis. Furthermore, to prevent future regressions where new screens or features are implemented without corresponding Unified Sandbox simulation, an authoritative agent rule was required.

## Plan
1. Enhance `DlqSandboxRepository` and `DlqSandboxHandler` in `@acc/sandbox` to support multi-tenant fleet aggregation when on Sovereign System scope and provide an on-demand poison injection API.
2. Add a quick diagnostic button ("Inject Poison Task (DLQ)") in `apps/console/src/core/sandbox/ui/sandbox-dock.tsx` under Edge-Case Diagnostics.
3. Codify the Sandbox Parity rule following the mandatory Rule Management SOP:
   - Exhaustive explanation and rationale in `docs/master_rules_reference.md` (Section 12).
   - Distilled rule section in `.agents/rules/02-unified-sandbox.md` (Section 5).
   - Compact imperative bullet in `.agents/rules/00-generic-common.md` (`SANDBOX-PARITY`).
4. Verify sandbox and console type safety, run Vitest tests, and document in history and walkthrough artifacts.

## Changes
- **`packages/sandbox/src/handlers/dlq-sandbox-handler.ts`**:
  - Enhanced `DlqSandboxRepository.list()` to aggregate across all tenants (`tenant-acme`, `tenant-us-east-1`, `SYSTEM`) when `tenantId === 'SYSTEM'` or omitted.
  - Implemented `injectPoisonTask()` to dynamically spawn simulated poison executions with stack traces and parameters.
  - Handled `POST /api/v1/(system|workflow)/dlq/inject` in `DlqSandboxHandler`.
- **`apps/console/src/core/sandbox/ui/sandbox-dock.tsx`**:
  - Added "Inject Poison Task (DLQ)" button with icon and toast feedback under Edge-Case Diagnostics.
- **`docs/master_rules_reference.md`**:
  - Documented Section 12: Unified Sandbox Parity & Screen Synchronization Mandate.
- **`.agents/rules/02-unified-sandbox.md`**:
  - Added Section 5: Mandatory Sandbox Synchronization for New Screens & Features.
- **`.agents/rules/00-generic-common.md`**:
  - Added `SANDBOX-PARITY` imperative constraint bullet.
- **`apps/console/doc/walkthrough_105.md`**:
  - Documented walkthrough and verification steps.

## Verification
- `pnpm --filter @acc/sandbox check-types`: Passed with 0 errors.
- `pnpm --filter @acc/console exec tsc --noEmit`: Passed with 0 errors.
- `pnpm --filter @acc/console test dlq-feature`: Passed 4/4 Vitest tests.

## Walkthrough
Refer to [walkthrough_105.md](../../apps/console/doc/walkthrough_105.md).

## Tasks
- [x] Update `dlq-sandbox-handler.ts` with cross-tenant aggregation and `injectPoisonTask`
- [x] Add DLQ injection trigger to `sandbox-dock.tsx`
- [x] Document Section 12 in `docs/master_rules_reference.md`
- [x] Add distilled rule to `.agents/rules/02-unified-sandbox.md`
- [x] Add `SANDBOX-PARITY` bullet to `.agents/rules/00-generic-common.md`
- [x] Verify type safety and Vitest suites
- [x] Create walkthrough and history log

## Enhancement
Future enhancements can connect the DLQ sandbox injection to realistic SSE execution streaming to showcase real-time dead-letter alerting and notification toasts.
