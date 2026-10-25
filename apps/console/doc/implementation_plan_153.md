# Implementation Plan 153: Upgrade "RBAC Matrix & Global Users" Studio with Dedicated Roles Management Tab, 35-Atom Permission Matrix & Hardened Universal Directory

## 1. Goal Description & Scope
Upgrade the **"RBAC Matrix & Global Users"** screen (`apps/console/src/routes/_authenticated/system.roles.tsx`) and its feature architecture into a unified, high-density, enterprise-grade Security Governance Studio following [`docs/master_database_schema_architecture.md`](../../../docs/master_database_schema_architecture.md) and [`docs/integration_master_plan_iteration24.md`](../../../docs/integration_master_plan_iteration24.md).

### The Three Operational Pillars of `/system/roles`:
1. **Tab 1: Permission Matrix (`<RbacMatrixGrid />`)**:
   - Upgraded from 12 hardcoded items to the full **35 canonical permission atoms** across 5 security planes (`PLATFORM`, `METADATA`, `SECURITY`, `COMMERCIAL`, `ORGANIZATION`).
   - Sticky first column (permissions) and sticky top row (roles) with Liquid Glass styling.
   - Dual-Scope switcher: **"Tenant Organization Matrix"** (Tenant Admins & Members) vs **"Sovereign Cluster Matrix"** (Sovereign Root Custodian).
   - High-performance O(1) Map lookups, live plane-filter pills, and floating amber glass commit bar with batch save & discard.
2. **Tab 2: Roles Management (`<RoleManagementTab />` - NEW)**:
   - Dedicated management studio for managing system and tenant roles:
     - **Roles Catalog & Inventory Data Table**: Role Code, Display Name, Clearance Tier (`Tier 1-4` / `Plan Tier`), Role Scope (`SYSTEM` vs `TENANT`), Assigned Tenant (`SYSTEM` or specific tenant), Inherited DAG Roles, Member Count, and Action Controls.
     - **Role CRUD**: Create new custom tenant or system role (with `role_scope`, `min_plan_tier`, `tenant_id`, and inheritance DAG definition).
     - **Tenant Assignment & Revoke Actions**: Assign role to a tenant, update role properties, or revoke/delete custom roles (with soft-lock protection for core system roles).
     - **Inspect Role Modal / Drawer**: Deep inspection of all direct and inherited permissions bound to the role.
3. **Tab 3: Universal Users Directory (`<UserMembershipDrawer />`)**:
   - High-density user table with tenant badge chips (`SYSTEM`, `tenant-acme`, `usr-<uuid>`).
   - Security Telemetry Badges: `Verified Email`, `Phone Verified`, `Passkey Enrolled`, `Active/Locked`.
   - **Direct Role & Ad-Hoc Permission Delegation Action (`<TenantRoleDelegationModal />`)**:
     - Allows Tenant Admins to delegate their own authorized roles and ad-hoc permission overrides (`is_granted = true/false`) to tenant users.
     - Enforces the **Delegation Ceiling** (no self-elevation) and **Last-Admin Soft-Lock Protection** (cannot demote final active `ROLE_WORKSPACE_OWNER`).
   - Emergency Session Revocation and Lockdown Dialog with mandatory security reason capture.

---

## 2. User Review Required

> [!IMPORTANT]
> **New Dedicated Tab: "Roles Management" (`/system/roles?tab=roles`)**:
> The route tabs will be expanded from 2 to 3:
> 1. `Permission Matrix` (`ShieldCheck`)
> 2. `Roles Management` (`ShieldAlert` / `KeyRound`) - **NEW**
> 3. `Universal Users Directory` (`Users`)
> This separates matrix visualization/toggling from role lifecycle operations (creation, editing metadata, tenant-level role mapping, and role deprecation/revocation).

> [!NOTE]
> **Protected Core Roles**:
> Core system roles (`ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`, `ROLE_SYSTEM_VERIFIER`, `ROLE_SYSTEM_APPROVER`) and core tenant roles (`ROLE_WORKSPACE_OWNER`, `ROLE_OPERATIONS_MANAGER`, `ROLE_STANDARD_MEMBER`, `ROLE_AUDITOR`) are marked `systemRole: true` and are protected against deletion/revocation. Only custom roles (`systemRole: false`) can be deleted or renamed.

---

## 3. Architecture & Proposed File Changes

```
apps/backend/
├── unipost-db/src/main/resources/db/unipost/
│   └── changelog-000.000.00017.xml                 # [NEW] UNIPOST_IDENTITY_USERPERMISSION table + role tenant_id
├── unipost-fw/src/main/java/com/unipost/
│   └── user/
│       ├── controller/
│       │   └── TenantRoleDelegationController.java # [NEW] Endpoints for delegation, user permissions & tenant roles
│       ├── service/
│       │   └── TenantRoleDelegationService.java    # [NEW] Service enforcing delegation ceiling & last-admin lock
│       └── repository/
│           ├── UserRoleRepository.java             # [MODIFY] Stamped queries
│           └── UserPermissionRepository.java       # [NEW] Ad-hoc user permissions repository
apps/console/
├── src/
│   ├── routes/_authenticated/
│   │   └── system.roles.tsx                        # [MODIFY] 3-tab layout: Matrix, Roles Management, Users Directory
│   ├── features/
│   │   └── system/
│   │       ├── api/
│   │       │   └── use-system-fleet.ts             # [MODIFY] Add deleteRole, updateRole, and delegation hooks
│   │       ├── roles/
│   │       │   ├── rbac-matrix-grid.tsx            # [MODIFY] 35 canonical atoms, 5 planes, sticky table, scope toggle
│   │       │   ├── role-management-tab.tsx         # [NEW] Dedicated Roles Management tab (table, CRUD, tenant assign)
│   │       │   ├── role-definition-modal.tsx       # [MODIFY] Create/Edit role modal with roleScope, tenantId, planTier
│   │       │   ├── role-inspector-dialog.tsx       # [NEW] Role deep-inspection dialog showing permissions breakdown
│   │       │   ├── user-membership-drawer.tsx      # [MODIFY] User directory with delegation button & passkey badges
│   │       │   ├── tenant-role-delegation-modal.tsx# [NEW] Modal for Tenant Admin to delegate roles + ad-hoc perms
│   │       │   └── __tests__/
│   │       │       └── rbac-matrix-grid.test.tsx   # [NEW] Comprehensive unit/integration tests for 3 tabs
│   │       └── types/
│   │           └── rbac-matrix-types.ts            # [NEW] Canonical 35 atoms, planes, role scopes, delegation types
│   ├── core/
│   │   └── sandbox/
│   │       └── handlers/
│   │           └── system-sandbox-handler.ts       # [MODIFY] Mock routes for 35 atoms, role CRUD, and user delegation
│   └── locales/
│       ├── en/console.json                         # [MODIFY] Add all new tab strings, role management, delegation copy
│       └── vi/console.json                         # [MODIFY] Vietnamese locale sync
└── e2e/
    └── 12-sovereign-rbac-matrix.spec.ts             # [MODIFY] Update E2E test verifying all 3 tabs and accessibility
```

---

## 4. Component Details & UI/UX Design Specifications

### 4.1 Tab 1: Permission Matrix (`<RbacMatrixGrid />`)
- **Category Filter Pills**: `All Planes`, `Platform Fleet`, `Dynamic Metadata`, `Security & Audit`, `Commercial & Quorum`, `Inside-Tenant Workspace`.
- **Search Bar**: Debounced text search filtering across permission label, atom code, and category.
- **Sticky Matrix Architecture**:
  - Left column: `w-[320px] sticky left-0 z-20 bg-background/95 backdrop-blur-md border-r`.
  - Header row: `sticky top-0 z-30 bg-muted/90 backdrop-blur-md`.
- **Inheritance Resolution**: Checkboxes calculate inherited grants from DAG ancestors with lock icon and tooltip: `"Inherited via ${roleName}"`.
- **Floating Commit Strip**: Staged changes display unsaved modifications count, per-role "Save" buttons, and a master "Discard All" button.

### 4.2 Tab 2: Roles Management (`<RoleManagementTab />`)
- **Header Action Bar**:
  - Search input for role name or code.
  - Filter by Scope (`All`, `SYSTEM`, `TENANT`).
  - "Create Role" button (opens `<RoleDefinitionModal />`).
- **Liquid Glass Roles Table**:
  - `Role Identification`: Name, code badge, description.
  - `Scope & Tenant`: Badge for `SYSTEM` vs `TENANT`, and tenant ID badge.
  - `Clearance / Plan Tier`: Badge for `Tier 1-4` (Sovereign) or `Community / Standard / Pro / Enterprise` (Tenant).
  - `Inheritance DAG`: Visual badges showing inherited parent roles.
  - `Assigned Members`: Badge showing active user count with link to filter User Directory.
  - `Actions`:
    - `Inspect`: Opens `<RoleInspectorDialog />` displaying full permission list grouped by plane.
    - `Edit`: Opens edit mode in `<RoleDefinitionModal />` (for custom roles).
    - `Delete / Revoke`: Triggers deletion confirmation (disabled for system-protected roles).

### 4.3 Tab 3: Universal Users Directory (`<UserMembershipDrawer />`)
- **Enhanced Table Columns**:
  - `User Identity`: Name, username, email with copy button, creation date.
  - `Tenant Organization`: Badge chip with link/filter (`SYSTEM`, `tenant-acme`, `usr-<uuid>`).
  - `Roles & Permissions`: Badges for assigned roles + popover showing ad-hoc permission overrides.
  - `Security & Passkey Telemetry`:
    - `Passkey Enrolled` (Fingerprint/Key icon) vs `Password Only`.
    - `Email Verified` checkmark.
  - `Status`: `ACTIVE` vs `LOCKED` (red badge).
  - `Actions`:
    - `Delegate Roles`: Opens `<TenantRoleDelegationModal />` to assign roles & permission overrides within tenant.
    - `Inspect`: Opens Sheet showing full security telemetry and session fingerprints.
    - `Revoke Sessions`: Emergency cluster token revocation.
    - `Lock/Unlock`: Opens reason-mandatory emergency lockdown dialog.

---

## 5. Verification Plan

### Automated Tests
1. **Backend Unit & Controller Tests**:
   - Verify `TenantRoleDelegationController` and `TenantRoleDelegationService`.
   - Command:
     ```bash
     mvn test -pl unipost-fw -Dtest=TenantRoleDelegationServiceTest -q
     ```
2. **Frontend Unit & Component Integration Tests**:
   - Verify all 3 tabs in `rbac-matrix-grid.test.tsx`:
     - Matrix grid rendering 35 atoms.
     - Role Management tab CRUD actions and protected role guards.
     - Users directory delegation modal and ad-hoc overrides.
   - Command:
     ```bash
     pnpm --filter @unipost/console test:run
     ```
3. **TypeScript Compilation**:
   - Command:
     ```bash
     pnpm --filter @unipost/console check-types
     ```
4. **Playwright E2E Suite**:
   - Verify all 3 tabs and WCAG 2.2 AA accessibility audit:
     ```bash
     pnpm --filter @unipost/console test:e2e e2e/12-sovereign-rbac-matrix.spec.ts
     ```

### Manual Verification
1. Navigate to `/system/roles`.
2. Inspect the 3 tabs: **Permission Matrix**, **Roles Management**, **Universal Users Directory**.
3. In **Permission Matrix**: Toggle planes, filter by search, toggle a permission on `ROLE_WORKSPACE_OWNER`, verify floating commit bar, click Save.
4. In **Roles Management**: View role inventory, click "Inspect" on `ROLE_OPERATIONS_MANAGER`, click "Create Role", provision a custom role `ROLE_WAREHOUSE_LEAD`, verify it appears in the table.
5. In **Universal Users Directory**: Click "Delegate Roles" on a tenant user, assign `ROLE_WAREHOUSE_LEAD`, attach an ad-hoc override `entity:record:delete = false`, submit, and verify updated badges.
