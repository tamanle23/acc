# History Record 206: RBAC Matrix & Governance Studio Upgrade, Roles Management & Tenant Delegation

## 1. Problem Statement
The `/system/roles` screen was restricted to a simple list and lacked deep role lifecycle capabilities (creation, deletion, schema tier, tenancy custody). Furthermore, tenant-level users were unable to receive delegated roles or ad-hoc permission overrides from tenant administrators under enforced Delegation Ceiling and Sovereign Role Quarantine invariants.

## 2. Architectural Plan & Execution
- **Backend Persistence**:
  - Authored Liquibase changelog `changelog-000.000.00017.xml` (`evolve-userpermission-table-17` and `add-tenant-id-to-role-17`) adding `tenant_id`, `is_granted`, `delegated_by_uid`, and `reason` to `UNIPOST_IDENTITY_USERPERMISSION`, and `role_scope`, `min_plan_tier`, and `tenant_id` to `UNIPOST_IDENTITY_ROLE`.
  - Updated entities `Role`, `UserRole`, `UserPermission`, and repositories `RoleRepository`, `UserRoleRepository`, `UserPermissionRepository`.
  - Implemented `TenantRoleDelegationService` and controller `TenantRoleDelegationController` with 4 strict security checks:
    1. Cross-Tenant Barrier.
    2. Sovereign Role Quarantine.
    3. Delegation Ceiling.
    4. Last-Admin Soft-Lock.
- **Frontend Security Studio**:
  - Upgraded `/system/roles` to an enterprise 3-tab Security Studio (`<RbacMatrixGrid />`, `<RoleManagementTab />`, `<UserMembershipDrawer />`).
  - Added 35 canonical atoms across 5 security planes with sticky grid layout and batch commit strip.
  - Implemented `<RoleInspectorDialog />`, `<RoleDefinitionModal />`, and `<TenantRoleDelegationModal />`.
- **Unified Sandbox & i18n**:
  - Registered route handlers in `system-sandbox-handler.ts` for role deletion, tenant roles querying, and user delegation.
  - Synced English and Vietnamese locales in `console.json`.

## 3. Verification & Compliance
- `TenantRoleDelegationServiceTest.java`: 5/5 unit tests passed.
- `apps/console/src/features/system/roles/__tests__/rbac-matrix-grid.test.tsx`: 3/3 passed.
- `apps/console/src/features/system/__tests__/sovereign-cockpit-ui.test.tsx`: 6/6 passed.
- Playwright spec `12-sovereign-rbac-matrix.spec.ts`: Passed cleanly with 0 WCAG 2.2 AA violations.
- TypeScript: `pnpm --filter @unipost/console exec tsc --noEmit` passed with 0 errors.
