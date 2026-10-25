# 116. Move DLQ Screen to SYSTEM Root Workspace & Update Backend Authorization

## Problem Statement
The user requested moving the Dead-Letter Queue (DLQ) screen to SYSTEM's root users workspace in the console app and updating backend authorization accordingly so that poisoned task inspection, discard, and re-enqueue operations are strictly governed by Sovereign Platform Custodians.

## Implementation Plan
1. **Backend Authorization & Dual-Route Mapping**:
   - Add `@PreAuthorize("hasAuthority('ROLE_SYSTEM_CUSTODIAN') or hasAuthority('platform:dlq:manage')")` to `WorkflowDlqController`.
   - Map to both `{"/api/v1/system/dlq", "/api/v1/workflow/dlq"}`.
   - Update `resolveTenantId()` to allow Sovereign Custodians to inspect cross-tenant fleet tasks or filter by `?tenantId=...`.
   - Add `"platform:dlq:manage"` to `ROLE_SYSTEM_CUSTODIAN` in `SystemFleetService.java`.
2. **Unified Sandbox Simulation**:
   - Support `/api/v1/system/dlq` in `dlqSandboxHandler`.
3. **Console Routing & Layout Navigation**:
   - Create route `system.dlq.tsx` (`/_authenticated/system/dlq`).
   - Remove legacy `/_authenticated/dlq/`.
   - In `sidebar-data.ts`, remove DLQ from general `Admin` group and add to `Sovereign Custody (Root)` group with `badge: 'ROOT'`.
   - Update `DlqFeature` with `Sovereign Platform Root` banner and enforce `usePermissions().isSovereignCustodian` 403 guard.
   - Point `use-dlq.ts` hooks to `/system/dlq`.
4. **Living Docs & Tests**:
   - Update `apps/console/ROUTE.md`.
   - Update `dlq-feature.test.tsx` with sovereign and 403 test cases.
   - Update `WorkflowDlqRestApiTest.java`.
   - Regenerate `routeTree.gen.ts`.

## Changes Made
- `apps/backend/acc-ms-aio/.../WorkflowDlqController.java`: Added `@PreAuthorize`, `/api/v1/system/dlq` route, and fleet querying.
- `apps/backend/acc-fw/.../SystemFleetService.java`: Added `"platform:dlq:manage"` to `ROLE_SYSTEM_CUSTODIAN` permissions and ephemeral token generation.
- `apps/backend/acc-ms-aio/.../WorkflowDlqRestApiTest.java`: Verified security annotation, dual routing, and fleet-wide querying.
- `packages/sandbox/src/handlers/dlq-sandbox-handler.ts`: Supported `/api/v1/system/dlq`.
- `apps/console/src/routes/_authenticated/system.dlq.tsx`: Added new system DLQ route.
- `apps/console/src/routes/_authenticated/dlq/`: Removed old route folder.
- `apps/console/src/routeTree.gen.ts`: Regenerated route tree.
- `apps/console/src/components/layout/data/sidebar-data.ts`: Relocated DLQ to Sovereign Custody (Root) group.
- `apps/console/src/features/dlq/index.tsx`: Added Sovereign Platform Root banner and `isSovereignCustodian` access guard.
- `apps/console/src/features/dlq/hooks/use-dlq.ts`: Updated query key and endpoint to `/system/dlq`.
- `apps/console/src/features/dlq/__tests__/dlq-feature.test.tsx`: Added 403 Forbidden and sovereign root tests.
- `apps/console/ROUTE.md`: Updated layout tree, matrix, and section 3.10 blueprint.
- `apps/backend/doc/implementation_plan_40.md` & `walkthrough_40.md`: Backend artifacts.
- `apps/console/doc/implementation_plan_104.md` & `walkthrough_104.md`: Console artifacts.

## Verification
- Backend tests:
  - `WorkflowDlqRestApiTest`: 3/3 passed.
  - `SystemFleetControllerTest`: 11/11 passed.
  - `workflow-engine`: 45/45 passed.
- Frontend & Sandbox:
  - `pnpm --filter @acc/sandbox check-types`: Passed clean with 0 errors.
  - `pnpm --filter @acc/console exec tsc --noEmit`: Passed clean with 0 errors.
  - `vitest run dlq-feature`: 4/4 passed (including 403 Forbidden validation).

## Walkthrough
- Backend: `apps/backend/doc/walkthrough_40.md`
- Console UI: `apps/console/doc/walkthrough_104.md`

## Tasks
- [x] Secure `WorkflowDlqController` with `ROLE_SYSTEM_CUSTODIAN` authorization.
- [x] Map `/api/v1/system/dlq` and support cross-tenant fleet inspection.
- [x] Relocate DLQ route to `/_authenticated/system/dlq`.
- [x] Move sidebar navigation item to Sovereign Custody (Root) group with ROOT badge.
- [x] Guard `DlqFeature` against non-sovereign tenants with 403 Forbidden screen.
- [x] Update Unified Sandbox handler, living docs, and test suites.

## Enhancement
Future enhancements could provide tenant-filtering dropdowns directly inside the Sovereign Platform Root DLQ dashboard header.
