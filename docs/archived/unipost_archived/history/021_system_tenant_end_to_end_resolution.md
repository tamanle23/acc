# History Log 021: SYSTEM Tenant Sovereign Custody End-to-End Resolution

## Problem
Following the initial rollout of the Sovereign SYSTEM Tenant Cockpit (History Log 020), an audit revealed critical wiring gaps and behavioral disconnects across both backend and frontend layers:
1. **Canonical Schema Mutation Barrier**: `attribute-card.tsx` locked SYSTEM attributes with `disabled={isSystemField}` unconditionally, preventing Sovereign Custodians from editing canonical attributes in Schema Studio.
2. **Disconnected Role Definition Modal**: `RoleDefinitionModal` only contained a stub `onOpenChange(false)` without dispatching API mutations, and was never rendered in `RbacMatrixGrid` or `system.roles.tsx`. The backend also lacked `POST /api/v1/system/roles`.
3. **Missing User Inspector Drawer**: `user-membership-drawer.tsx` rendered a table without the planned diagnostics sheet/drawer to inspect account metadata or revoke sessions.
4. **Assume-Tenant Dual-Context Leak**: Neither backend `JwtAuthenticationTokenFilter` nor frontend `api-client.ts` propagated the dual-context impersonation state (`actor_tid` = `SYSTEM` and `effective_tid`), causing backend calls during Assume-Tenant sessions to lose sovereign actor auditing.
5. **Auth Store Missing Tenant Context**: `useSpringAuthStore` did not track `currentTenantId`, and mock tokens in sandbox omitted `tenantId`.

## Plan
1. Update `JwtAuthenticationTokenFilter.java` to extract `actor_tid` and invoke `TenantContextHolder.setDualContext(...)`.
2. Add `CreateRoleRequest.java`, `SystemFleetService.createRole(...)`, and `@PostMapping("/roles")` in `SystemFleetController.java`.
3. Update `use-system-fleet.ts`, `system-sandbox-handler.ts`, `role-definition-modal.tsx`, and `rbac-matrix-grid.tsx` for custom role provisioning.
4. Update `attribute-card.tsx` so Sovereign Custodians can edit and delete canonical SYSTEM attributes while keeping them protected from commercial tenants.
5. Add the slide-over `Sheet` inspector to `user-membership-drawer.tsx` with identity diagnostics, copyable user ID, and session revocation.
6. Enhance `api-client.ts`, `fleet-tenants-table.tsx`, `assume-tenant-bar.tsx`, and sandbox tokens for clean Assume-Tenant token lifecycle.
7. Verify with backend Maven tests, console Vitest, and TypeScript checks.

## Changes
- **Backend**:
  - Created `apps/backend/acc-fw/src/main/java/com/acc/system/dto/CreateRoleRequest.java`.
  - Added `createRole` method to `SystemFleetService.java`.
  - Added `@PostMapping("/roles")` endpoint to `SystemFleetController.java`.
  - Added dual-context detection (`actor_tid`) to `JwtAuthenticationTokenFilter.java`.
  - Added `testCreateRole_ReturnsSuccess` in `SystemFleetControllerTest.java`.
- **Frontend Console**:
  - `attribute-card.tsx`: Enabled Sovereign Custodian editing of canonical schemas (`isLocked = isSystemField && !isSovereign`).
  - `role-definition-modal.tsx`: Connected `useCreateSystemRole` with loading state and validation.
  - `rbac-matrix-grid.tsx`: Added "Create Custom Role" button and rendered `RoleDefinitionModal`.
  - `user-membership-drawer.tsx`: Added slide-over `Sheet` inspector with identity telemetry and session revocation.
  - `api-client.ts`: Attached `acc_assumed_token` and `X-Assumed-Tenant` header.
  - `fleet-tenants-table.tsx` & `assume-tenant-bar.tsx`: Stored and cleared ephemeral assumed tokens.
  - `types.ts` & `store.ts`: Added `currentTenantId` to `AuthState` and synced from decoded JWT.
  - `auth-sandbox-handler.ts` & `sandbox-manager.ts`: Stamped `tenantId` into mock JWT tokens.
  - `system-sandbox-handler.ts`: Added `mockFleetStore.createRole` and `POST /api/v1/system/roles`.
  - `sovereign-cockpit-ui.test.tsx`: Added assertions for role creation and user inspection.

## Verification
- `mvn test -Dtest=SystemFleetControllerTest,SovereignCustodyAndRlsTest,TenantContextAndAspectTest`: 21/21 passed.
- `vitest run src/features/system`: 3/3 passed.
- `vitest run src/core/sandbox`: 53/53 passed.
- `vitest run src/features/metadata`: 35/35 passed.
- `tsc --noEmit`: 0 errors.

## Walkthrough
Detailed walkthrough documented in [`apps/console/doc/walkthrough_69.md`](../../apps/console/doc/walkthrough_69.md).
