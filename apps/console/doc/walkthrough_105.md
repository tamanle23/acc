# Walkthrough 105 - Update Unified Sandbox for DLQ Screens & Enforce Sandbox Parity Rule

## Summary
Completed full Unified Sandbox parity for the Dead-Letter Queue (DLQ) screens and codified an imperative agent rule mandating sandbox synchronization for all new and modified UI screens/features:
1. **Cross-Tenant Fleet Aggregation**: Enhanced `DlqSandboxRepository.list()` to aggregate poisoned executions across all tenants (`tenant-acme`, `tenant-us-east-1`, `SYSTEM`) when queried from the Sovereign Root scope (`/system/dlq`).
2. **On-Demand Poison Injection**: Implemented `injectPoisonTask()` in `DlqSandboxRepository` and added route handler `POST /api/v1/(system|workflow)/dlq/inject` allowing instant generation of simulated poison tasks for diagnostic testing.
3. **SandboxDock Quick Diagnostic Trigger**: Integrated an "Inject Poison Task (DLQ)" button inside `apps/console/src/core/sandbox/ui/sandbox-dock.tsx` under Edge-Case Diagnostics, triggering on-demand poison injection with instant toast feedback.
4. **Rule Management SOP**:
   - Master reference documentation added to `docs/master_rules_reference.md` (Section 12: Unified Sandbox Parity & Screen Synchronization Mandate).
   - Compact distilled rules added to `.agents/rules/02-unified-sandbox.md` (Section 5) and `.agents/rules/00-generic-common.md` (`SANDBOX-PARITY`).

---

## Changes
- **Sandbox Repository & Handler**:
  - `packages/sandbox/src/handlers/dlq-sandbox-handler.ts`:
    - Updated `list()` to aggregate all tenant partitions when `tenantId === 'SYSTEM'` or unspecified.
    - Updated `getById()`, `replay()`, and `discard()` to search across all tenant partitions under Sovereign System scope.
    - Added `injectPoisonTask()` method and `POST /api/v1/system/dlq/inject` endpoint.
- **Sandbox Dock UI**:
  - `apps/console/src/core/sandbox/ui/sandbox-dock.tsx`:
    - Added DLQ poison injection action button in the Edge-Case Diagnostics section with toast notifications.
- **Rules & Documentation**:
  - `docs/master_rules_reference.md`: Added Section 12 defining Zero-Blank-Screen Mandate, Multi-Tenant Fleet Awareness, Reset Lifecycle Hooks, and Zero Ad-Hoc Mock prohibition.
  - `.agents/rules/02-unified-sandbox.md`: Added Section 5 ("Mandatory Sandbox Synchronization for New Screens & Features").
  - `.agents/rules/00-generic-common.md`: Added `SANDBOX-PARITY` imperative constraint bullet.

---

## Verification Results
- `pnpm --filter @unipost/sandbox check-types`: Passed clean with 0 errors.
- `pnpm --filter @unipost/console exec tsc --noEmit`: Passed clean with 0 errors.
- `pnpm --filter @unipost/console test dlq-feature`: Passed all 4 unit and integration tests.
