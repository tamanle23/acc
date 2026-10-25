# Implementation Plan 157: Tenant Role Delegation Integration & Users Screen Refinement

Surface the `TenantRoleDelegationModal` directly as a "Delegate Permissions" action within the tenant-scoped `/users` table row actions menu. Refine `/users` screen with canonical Liquid Glass styling, role token synchronization, and full backend/unified sandbox integration.

## Proposed Changes

### 1. Unified Types & User Schema Adaptation
- In `apps/console/src/features/users/data/schema.ts`, expand `userRoleSchema` and `User` interface to recognize both canonical system roles (`ROLE_WORKSPACE_OWNER`, `ROLE_STANDARD_MEMBER`, `ROLE_COMPLIANCE_OFFICER`, `ROLE_INTEGRATION_SVC`) and legacy user roles (`superadmin`, `admin`, `manager`, `cashier`).
- Add optional `tenantId` and `roles?: string[]` to `User` interface so `User` can map seamlessly to `SandboxGlobalUser` for the delegation modal.

### 2. Role Token & Icons Synchronization
- In `apps/console/src/features/users/data/data.ts`, update `roles` array with canonical roles and icons (`Shield`, `UserCheck`, `Users`, `KeyRound`, `Bot`).
- Ensure label and badge color mapping handles both canonical codes and lowercase legacy codes.

### 3. Users Provider & Dialog Registration
- In `apps/console/src/features/users/components/users-provider.tsx`:
  - Add `'delegate'` to `UsersDialogType = 'invite' | 'add' | 'edit' | 'delete' | 'delegate'`.
- In `apps/console/src/features/users/components/users-dialogs.tsx`:
  - Mount `TenantRoleDelegationModal` with `open={open === 'delegate'}` and map `currentRow` to `SandboxGlobalUser` (using `currentRow.id`, `currentRow.username`, `currentRow.email`, `activeTenantId`).

### 4. Row Actions Menu Enhancement
- In `apps/console/src/features/users/components/data-table-row-actions.tsx`:
  - Add "Delegate Permissions" option with `KeyRound` icon that sets `currentRow` and opens the `'delegate'` dialog.
  - Retain `Edit` and `Delete` options with semantic accessibility labels.

### 5. UI/UX Refinement for `/users` Screens
- In `apps/console/src/features/users/index.tsx`:
  - Refine page header with Liquid Glass container, subtitle, and badge displaying active tenant scope.
- In `apps/console/src/features/users/components/users-table.tsx`:
  - Add empty state treatment with CTA matching the 5-state component matrix.
  - Enhance `DataTableToolbar` filtering with canonical role options.

### 6. Sandbox & Backend Wiring
- In `apps/console/src/core/sandbox/handlers/users-sandbox-handler.ts`:
  - Ensure users list returned matches active tenant.
  - Ensure roles assigned via `system-sandbox-handler` (`/api/v1/system/roles/delegate`) reflect immediately on `/api/users` in the sandbox.

### 7. Verification & Tests
- Vitest unit tests in `apps/console/src/features/users/components/__tests__/users-table.test.tsx` and `data-table-row-actions.test.tsx`.
- Playwright E2E verification test covering navigation to `/users`, opening "Delegate Permissions" modal, choosing permissions, and saving.
- Type check with `pnpm --filter @unipost/console exec tsc --noEmit`.
