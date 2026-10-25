# 149 - Iteration 11 WCAG 2.2 AA Audit, ARIA Invariants & Backend RFC-7807 Remediation

## Problem
Following the initial delivery of Iteration 11 remaining phases, a skeptical review identified multiple latent defects:
1. **Radix UI Dialog Description Warnings**: In `DlqInspectorSheet`, `TenantUsersDrawer`, and `TenantWorkspacesDrawer`, explicit string `id` and `aria-describedby` props bypassed Radix UI's internal `context.descriptionId` mapping, causing Radix to log development warnings (`Missing Description or aria-describedby={undefined} for {DialogContent}`).
2. **Missing `aria-sort="none"` on Sortable Headers**: In `@/components/data-table/data-table.tsx`, sortable columns that were not currently sorted had `aria-sort={undefined}` rather than the W3C WAI-ARIA standard `aria-sort="none"`.
3. **Generic Row Action Labels**: Action triggers in `users/components/data-table-row-actions.tsx`, `dlq-columns.tsx`, and `user-membership-drawer.tsx` used non-descriptive labels ("Open menu"), violating WCAG 2.2 AA (SC 2.4.4 / 4.1.2).
4. **Missing Toolbar Role**: `DataTableToolbar` lacked `role="toolbar"`, causing CSS rules with `max-sm:has-[div[role="toolbar"]]:mb-16` to fail matching.
5. **Backend Error Payloads**: `GlobalExceptionHandler.java` returned HTTP 200 OK for access denials, uncaught runtime exceptions, and message conversion errors, and produced null messages for exceptions without messages.

## Plan
1. Strip manual `id` overrides from `SheetDescription` and custom `aria-describedby` from `SheetContent` in the three affected drawers so Radix wires descriptions cleanly.
2. Upgrade `data-table.tsx` to set `aria-sort="none"` on sortable un-sorted headers.
3. Add unique, entity-specific `aria-label`s across User, DLQ, and Membership tables.
4. Add `role="toolbar"` and `aria-label="Table toolbar"` to `DataTableToolbar`.
5. Standardize `GlobalExceptionHandler.java` HTTP status codes (403, 400, 500) and safe message fallbacks, validated with `GlobalExceptionHandlerTest.java`.

## Changes
- `apps/console/src/features/dlq/components/dlq-inspector-sheet.tsx`
- `apps/console/src/features/system/tenants/tenant-users-drawer.tsx`
- `apps/console/src/features/system/tenants/tenant-workspaces-drawer.tsx`
- `apps/console/src/components/data-table/data-table.tsx`
- `apps/console/src/components/data-table/toolbar.tsx`
- `apps/console/src/features/users/components/data-table-row-actions.tsx`
- `apps/console/src/features/dlq/components/dlq-columns.tsx`
- `apps/console/src/features/system/roles/user-membership-drawer.tsx`
- `apps/backend/acc-fw/src/main/java/com/acc/fw/exceptionhandling/GlobalExceptionHandler.java`
- `apps/backend/acc-fw/src/test/java/com/acc/fw/exceptionhandling/GlobalExceptionHandlerTest.java`
- `apps/console/doc/walkthrough_124.md`

## Verification
- `pnpm --filter @acc/console test`: 65/65 test files passed (309/309 tests passing), 0 warnings.
- `node mvnw.cjs -pl acc-fw test -Dtest=GlobalExceptionHandlerTest`: 6/6 tests passing (BUILD SUCCESS).
- `pnpm --filter @acc/backend test:sandbox`: 33/33 tests passing (BUILD SUCCESS).
- `pnpm --filter @acc/backend test:modulith`: 1/1 architectural tests passing (BUILD SUCCESS).
- `pnpm test:e2e`: 15/15 Playwright E2E tests passing.
- `pnpm --filter tekgo-ui lint`: 0 warnings, 0 errors.

## Walkthrough
Refer to `apps/console/doc/walkthrough_124.md`.

## Tasks
- [x] Fix Radix Dialog Description ID wiring on Sheets/Drawers.
- [x] Calibrate WAI-ARIA `aria-sort="none"` on table headers.
- [x] Ensure unique `aria-label`s on row action triggers.
- [x] Add semantic `role="toolbar"` to `DataTableToolbar`.
- [x] Standardize backend error responses in `GlobalExceptionHandler` with unit test suite.
- [x] Re-verify all monorepo test suites end-to-end.

## Enhancement
Future iterations may expose custom localized problem detail extensions conforming to RFC-9457 (successor to RFC-7807) across all domain exception subtypes.
