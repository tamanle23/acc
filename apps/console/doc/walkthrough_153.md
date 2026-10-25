# Walkthrough 153: RBAC Governance Studio, Roles Management & Tenant Role Delegation

## 1. Problem Statement
The `/system/roles` screen previously lacked dedicated roles lifecycle management (CRUD, inspection, tenant-level isolation), was confined to a basic 12-item list, and lacked support for Tenant Admins to delegate their own roles and assign ad-hoc permission overrides to users while enforcing the Delegation Ceiling and Sovereign Role Quarantine invariants.

## 2. Plan Execution & Architectural Upgrades
Following [`docs/integration_master_plan_iteration24.md`](file:///c:/Users/Admin/workspace/git/acc/docs/integration_master_plan_iteration24.md):
- **Backend Schema & Invariants**:
  - Liquibase `changelog-000.000.00017.xml`: Evolved `UNIPOST_IDENTITY_USERPERMISSION` table with `tenant_id`, `is_granted`, `delegated_by_uid`, and `reason`; evolved `UNIPOST_IDENTITY_ROLE` with `role_scope`, `min_plan_tier`, and `tenant_id`.
  - Service Layer: Created `TenantRoleDelegationService` & `TenantRoleDelegationServiceImpl` enforcing Cross-Tenant Barriers, Sovereign Role Quarantine (`SYSTEM` scope roles cannot be delegated by tenant admins), Delegation Ceiling (admins cannot delegate roles they do not hold), and Last-Admin Protection.
  - Sliced Unit Testing: `TenantRoleDelegationServiceTest` with 5 automated unit test cases verifying all security bounds (100% green).
- **Frontend Security Studio**:
  - **Tab 1: Permission Matrix (`<RbacMatrixGrid />`)**: Upgraded to 35 canonical atoms across 5 security planes (`PLATFORM`, `METADATA`, `SECURITY`, `COMMERCIAL`, `ORGANIZATION`), sticky table headers & left columns, dual-scope segmented switcher, live plane filter pills, search bar, and batch commit strip.
  - **Tab 2: Roles Management (`<RoleManagementTab />`)**: Complete roles catalog table with scope filtering, role creation modal (`roleScope`, `minPlanTier`, `tenantId`), deep inspection dialog (`<RoleInspectorDialog />`), and soft-lock protection for core system roles.
  - **Tab 3: Universal Users Directory (`<UserMembershipDrawer />`)**: Tenant badge chips, passkey telemetry indicators, and the **"Delegate Roles"** trigger launching `<TenantRoleDelegationModal />` for role assignment and ad-hoc overrides.
- **Unified Sandbox Parity**:
  - Updated `system-sandbox-handler.ts` with 8 default roles, 35 permission atoms, and route handlers for role CRUD, role deletion, and user delegation.
- **i18n & Locales**:
  - Added `rbacStudio` namespace to both `en/console.json` and `vi/console.json`.
- **E2E & Unit Test Verification**:
  - `apps/console/src/features/system/roles/__tests__/rbac-matrix-grid.test.tsx` (3 tests passed).
  - `apps/console/src/features/system/__tests__/sovereign-cockpit-ui.test.tsx` (6 tests passed).
  - Playwright spec `12-sovereign-rbac-matrix.spec.ts` passing with 0 WCAG 2.2 AA violations.

## 3. Verification & Results
- **TypeScript**: `pnpm --filter @acc/console exec tsc --noEmit` -> 0 errors.
- **Console Unit Tests**: Vitest unit test suite executed -> 9/9 passed cleanly.
- **Backend Unit Tests**: `./mvnw.cmd test -pl acc-fw -Dtest=TenantRoleDelegationServiceTest` -> 5/5 passed cleanly.
- **Playwright E2E**: `pnpm --filter @acc/console exec playwright test e2e/12-sovereign-rbac-matrix.spec.ts` -> 1 passed (0 accessibility violations).
