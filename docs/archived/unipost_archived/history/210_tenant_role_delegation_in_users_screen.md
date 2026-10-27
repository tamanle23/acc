# 210: Tenant Role Delegation Integration & Users Screen Refinement

## Problem
In UniPost's multi-tenant architecture, non-sovereign tenant administrators (Workspace Owners) did not have direct access to `/system/roles` (which is restricted to Sovereign Custody). While the backend `TenantRoleDelegationServiceImpl` supported tenant-level delegation with strict delegation ceilings and cross-tenant barriers, the tenant-scoped `/users` screen only offered basic edit/delete dialogs, lacking an interface to assign canonical tenant roles or ad-hoc permission overrides.

## Plan
1. **Schema Evolution**: Expand `User` schema in `features/users/data/schema.ts` to support canonical tenant roles and `tenantId`/`roles` fields.
2. **UI/UX Modernization**: Update `features/users/data/data.ts` with canonical roles and WCAG 2.2 AA compliant badge tokens.
3. **Action Integration**: Add "Delegate Permissions" to `DataTableRowActions` in `data-table-row-actions.tsx`.
4. **Dialog Mounting**: Mount `TenantRoleDelegationModal` in `UsersDialogs` wired to `useUsers()`.
5. **Screen Refinement**: Redesign `/users` header with Liquid Glass aesthetics, tenant badge, and DataTable empty state CTA.
6. **Sandbox Synchronization**: Ensure `system-sandbox-handler.ts` updates `usersSandboxRepo` on user delegation.
7. **Verification**: Add unit test `data-table-row-actions.test.tsx` and Playwright Flow 14 `14-tenant-user-delegation.spec.ts` with Axe Core accessibility audit.

## Changes
- `apps/console/src/features/users/data/schema.ts`: Expanded `userRoleSchema` and `User` interface.
- `apps/console/src/features/users/data/data.ts`: Added canonical roles and hardened status badge contrast.
- `apps/console/src/features/users/components/users-columns.tsx`: Enhanced role cell to render icons and multi-role badges.
- `apps/console/src/features/users/components/users-provider.tsx`: Added `'delegate'` to `UsersDialogType`.
- `apps/console/src/features/users/components/data-table-row-actions.tsx`: Added "Delegate Permissions" menu item.
- `apps/console/src/features/users/components/users-dialogs.tsx`: Mounted `TenantRoleDelegationModal`.
- `apps/console/src/features/users/index.tsx`: Liquid Glass header with tenant scope badge.
- `apps/console/src/features/users/components/users-table.tsx`: Glass container and 5-state empty state.
- `apps/console/src/core/sandbox/handlers/system-sandbox-handler.ts`: Two-way sync with `usersSandboxRepo`.
- `apps/console/src/features/users/components/__tests__/data-table-row-actions.test.tsx`: Unit tests.
- `apps/console/e2e/14-tenant-user-delegation.spec.ts`: Playwright Flow 14 E2E test.

## Verification
- `tsc --noEmit`: 0 errors.
- Vitest unit tests: 8/8 passed.
- Playwright E2E: Flows 12, 13, and 14 all passed with 0 WCAG 2.2 AA accessibility violations.

## Walkthrough & Artifacts
- Walkthrough: `apps/console/doc/walkthrough_157.md`.
- Implementation Plan: `apps/console/doc/implementation_plan_157.md`.
