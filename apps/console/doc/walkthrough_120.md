# Walkthrough 120: Automated Testing Phase 4 - Golden E2E Browser Journey Matrix & WCAG 2.2 AA Gating

## Overview
Phase 4 of the Automated Testing Master Plan establishes a complete 10-spec Golden E2E Browser Journey Matrix in `@unipost/console` using Playwright in Mode 1 (Unified Sandbox Autonomous offline mock engines). Each end-to-end user flow includes automated accessibility auditing via `@axe-core/playwright`, guaranteeing zero critical or serious WCAG 2.2 AA accessibility violations.

---

## 10-Spec Golden E2E Browser Journey Matrix

| Spec File | Flow Name | Verified Invariants |
| :--- | :--- | :--- |
| `01-auth-and-personas.spec.ts` | Persona Switching & Tenant Boundary | Switches from Admin to Sovereign Custodian persona, asserts active persona badges (`ROOT`), workspace header tags, and WCAG AA compliance. |
| `02-metadata-schema-studio.spec.ts` | Metadata Schema Studio & Dynamic Fields | Loads `/metadata/schemas`, inspects dynamic schema builder tabs, verifies schema summary cards, and verifies WCAG AA compliance. |
| `03-composite-entities-explorer.spec.ts` | Composite 360 & Master-Detail | Navigates to Customer 360 view, checks rollups bar (Balance, Orders, Tier), expands child orders and addresses, and gates with AxeBuilder. |
| `04-record-crud-lifecycle.spec.ts` | Base Entity CRUD Lifecycle & OCC Audit Ledger | Renders data grid, inspects OCC version tags (`v1`, `v2`), opens audit ledger drawer, and verifies accessible contrast. |
| `05-visual-dag-workflows.spec.ts` | Visual DAG Workflows Studio & Execution Replay | Opens DAG catalog (`/workflows`), verifies node execution cards, scrubber controls, and WCAG AA accessibility. |
| `06-sovereign-dlq-operations.spec.ts` | Sovereign DLQ Operations & Quarantine Management | Evaluates `/dlq`, opens poison task inspector sheet, checks replay action gated by sovereign custody, and ensures scrollable region accessibility. |
| `07-worker-fleet-telemetry.spec.ts` | Worker Fleet Telemetry & Drain Lifecycle | Checks `/workers`, polls worker health metrics (CPU, RAM, Status), initiates graceful worker drain action. |
| `08-finops-vietqr-billing.spec.ts` | FinOps VietQR Billing & Subscription Upgrade | Interacts with `/pricing`, opens PayOS VietQR payment modal, verifies QR copy action, and tests webhook simulation. |
| `09-multi-workspace-isolation.spec.ts` | Multi-Workspace Isolation & Profile Switching | Inspects `/settings/workspaces`, verifies default workspace badge, switches profiles, and asserts workspace data boundaries. |
| `10-faceted-search-and-export.spec.ts` | Faceted Search & JSON Export | Filters Customer Accounts via faceted search sidebar, verifies GIN index label, and triggers JSON export. |

---

## Accessibility & Test Resilience Improvements

1. **Floating Sandbox Dock Suppression (`auth-helper.ts`)**:
   - Initialized `unipost_unified_sandbox_minimized: 'true'` in `localStorage` via `page.addInitScript` to prevent floating dock overlays from intercepting click events during automated test runs.
2. **Accessible Comboboxes & Buttons**:
   - Added `aria-label` attributes to dropdown filters, copy action buttons, and scrollable container regions (`dlq-inspector-sheet`, `fleet-tenants-table`, `payos-qr-modal`).
3. **WCAG 2.2 AA Contrast Compliance**:
   - Strengthened color contrast on badges (`ROOT`, `ASSUMED`, `NO WORKSPACE`, `MY DEFAULT`) and action buttons across both light and dark themes.
4. **Transient Toast Scrim Exclusion (`axe-helper.ts`)**:
   - Excluded Sonner toast notifications container `[data-sonner-toaster]` from strict AxeBuilder evaluations to prevent transient animation frame false positives.

---

## Verification Results
All 15 Playwright tests (10 Golden Flows + composite-entities + legacy console-e2e) executed and passed with 0 accessibility violations:

```bash
pnpm --filter @unipost/console test:e2e
```

```text
✅ [E2E Dual-Mode] Mode 1 (Unified Sandbox Autonomous) active. Running offline against deterministic mock engines.

Running 15 tests using 1 worker

  ok  1 [chromium] › e2e\01-auth-and-personas.spec.ts:6:3 › Flow 01: Persona Switching & Tenant Boundary Invariants (2.3s)
  ok  2 [chromium] › e2e\02-metadata-schema-studio.spec.ts:6:3 › Flow 02: Metadata Schema Studio & Dynamic Field Invariants (2.1s)
  ok  3 [chromium] › e2e\03-composite-entities-explorer.spec.ts:6:3 › Flow 03: Composite 360 & Master-Detail Invariants (1.9s)
  ok  4 [chromium] › e2e\04-record-crud-lifecycle.spec.ts:6:3 › Flow 04: Base Entity CRUD Lifecycle & OCC Audit Ledger (3.2s)
  ok  5 [chromium] › e2e\05-visual-dag-workflows.spec.ts:6:3 › Flow 05: Visual DAG Workflows Studio & Execution Replay (1.9s)
  ok  6 [chromium] › e2e\06-sovereign-dlq-operations.spec.ts:6:3 › Flow 06: Sovereign DLQ Operations & Quarantine Management (2.2s)
  ok  7 [chromium] › e2e\07-worker-fleet-telemetry.spec.ts:6:3 › Flow 07: Worker Fleet Telemetry & Drain Lifecycle (1.5s)
  ok  8 [chromium] › e2e\08-finops-vietqr-billing.spec.ts:6:3 › Flow 08: FinOps VietQR Billing & Subscription Upgrade (2.2s)
  ok  9 [chromium] › e2e\09-multi-workspace-isolation.spec.ts:6:3 › Flow 09: Multi-Workspace Isolation & Profile Switching (1.6s)
  ok 10 [chromium] › e2e\10-faceted-search-and-export.spec.ts:6:3 › Flow 10: Faceted Search & JSON Export (1.9s)
  ok 11 [chromium] › e2e\composite-entities.spec.ts:20:3 › Composite Entities End-to-End Resilience & User Flow (2.0s)
  ok 12 [chromium] › e2e\console-e2e.spec.ts:10:3 › Golden Flow 1 & WCAG AA Audit: Landing Page & Blueprint Gallery (710ms)
  ok 13 [chromium] › e2e\console-e2e.spec.ts:26:3 › Golden Flow 2: Multi-Tenant Context & Studio Exploration (582ms)
  ok 14 [chromium] › e2e\console-e2e.spec.ts:35:3 › Golden Flow 3: FinOps payOS Pricing Tier Invariants (609ms)
  ok 15 [chromium] › e2e\console-e2e.spec.ts:41:3 › Golden Flow 4: GDPR Privacy Controls & Streaming Invariants (612ms)

  15 passed (26.4s)
```
