# History Log 454: Decouple Sandbox Components from Production Screens

## Problem
In **Settings -> Billing & Subscriptions**, a sandbox development widget titled `"Unified Sandbox FinOps Simulator"` (`SandboxBillingDock`) was embedded directly into the production [`BillingPanel`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/settings/billing/billing-panel.tsx) layout.

### Architectural Violations
1. **Screen-Level Sandbox Pollution**: Under Monorepo Rule `02-unified-sandbox.md`, production UI screens must remain strictly free of ad-hoc mocks, test buttons, and simulated docks. All simulation triggers and diagnostics belong exclusively in the floating, developer-controlled [`SandboxDock`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/core/sandbox/ui/sandbox-dock.tsx).
2. **Missing Session Guard**: `SandboxBillingDock` only verified `import.meta.env.DEV`, which caused it to render for all local development sessions even when logged in with genuine live backend credentials (`isSandbox === false`).

## Plan
1. **Remove Sandbox Controls from `BillingPanel`**:
   - Remove `<SandboxBillingDock />` from [`BillingPanel`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/settings/billing/billing-panel.tsx).
   - Delete [`apps/console/src/features/settings/billing/sandbox-billing-dock.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/settings/billing/sandbox-billing-dock.tsx) and clean up [`apps/console/src/features/settings/billing/index.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/settings/billing/index.ts).
2. **Relocate FinOps Simulation to Master `SandboxDock`**:
   - In [`apps/console/src/core/sandbox/ui/sandbox-dock.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/core/sandbox/ui/sandbox-dock.tsx), introduce a **FinOps & Billing Simulator** section under the **Persona & Scope** tab alongside other edge-case diagnostics (DLQ injection, orphaned tenant, unassigned user).
   - Provide one-click VietQR instant webhook simulation for unlocking **PRO** and **PRO MAX** plan tiers within the active sandbox tenant context.
3. **Automated Testing & Type Check**:
   - Add unit test coverage in [`sandbox-dock.test.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/core/sandbox/__tests__/sandbox-dock.test.tsx).
   - Verify zero regressions and strict TypeScript compliance.

## Changes
- **Screen (`apps/console/src/features/settings/billing/billing-panel.tsx`):**
  - Removed `SandboxBillingDock` import and JSX render.
- **Settings Module (`apps/console/src/features/settings/billing/index.ts`):**
  - Removed `sandbox-billing-dock` export.
- **File Removal:**
  - Deleted `apps/console/src/features/settings/billing/sandbox-billing-dock.tsx`.
- **Master Sandbox Dock (`apps/console/src/core/sandbox/ui/sandbox-dock.tsx`):**
  - Added `handleSimulateBillingPayment` executing payOS VietQR webhook simulation via `springApiClient.post('/v1/billing/payos/webhook')`.
  - Added UI triggers for **Upgrade PRO (0s)** and **Upgrade PRO MAX (0s)** in the floating dock.
- **Tests (`apps/console/src/core/sandbox/__tests__/sandbox-dock.test.tsx`):**
  - Added test validating presence and accessibility of FinOps triggers inside `SandboxDock`.

## Verification
- `pnpm --filter @acc/console test sandbox-dock`: 7/7 passed.
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.

## Walkthrough
1. Navigating to **Settings -> Billing & Subscriptions** now shows only clean production sections: subscription details, plan selector, transaction history, VAT invoice form, and modals.
2. In development or sandbox mode, developers open the floating `SandboxDock` (bottom-right) under **Persona & Scope** to trigger VietQR payments and adjust tenant quotas, cleanly isolating sandbox capabilities from business view components.
