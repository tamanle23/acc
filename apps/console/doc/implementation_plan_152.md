# Implementation Plan 152 (v3): Upgrade RBAC Matrix & Global Users Studio with Tenant-Sole Role Assignment, Ad-Hoc Permission Overrides & Subordinate Delegation Architecture

## 1. Goal Description & Problem Statement
Upgrade the **"RBAC Matrix & Global Users"** screen (`apps/console/src/routes/_authenticated/system.roles.tsx` and its feature components: `rbac-matrix-grid.tsx`, `user-membership-drawer.tsx`, `role-definition-modal.tsx`, plus a new `tenant-role-delegation-modal.tsx`) to enterprise-grade quality and resilience following [`docs/master_database_schema_architecture.md`](../../../docs/master_database_schema_architecture.md) and [`docs/integration_master_plan_iteration24.md`](../../../docs/integration_master_plan_iteration24.md).

### Design Interview ("Grill-Me") Decisions Incorporated:
1. **Global Tenant-Wide Scope**: Role and permission delegations apply across all workspaces within that tenant organization (`app.current_tenant_id = target_tenant`).
2. **Tenant-Scoped Custom Roles**: Custom roles created by Tenant Admins have `role_scope = 'TENANT'` and are stamped with `tenant_id` in `UNIPOST_IDENTITY_ROLE`, visible and assignable **only** within that creating tenant.
3. **Ad-Hoc Direct Permission Overrides via `UNIPOST_IDENTITY_USERPERMISSION`**: In addition to coarse-grained roles, Tenant Admins can attach direct ad-hoc permission grants or denials (`is_granted = true/false`) to individual users, backed by a dedicated join table stamped with `tenant_id`.
4. **Subordinate Delegation Boundary (Delegation Ceiling)**: A Tenant Admin (`ROLE_WORKSPACE_OWNER`) can delegate only permissions that they themselves hold (`perm.role_scope = 'TENANT'`).
5. **Sovereign System Role Quarantine**: Sovereign System roles (`ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`, `ROLE_SYSTEM_VERIFIER`, `ROLE_SYSTEM_APPROVER`) are strictly marked with `role_scope = 'SYSTEM'` and can **never** be delegated, assigned, or assumed outside of `tenant_id = 'SYSTEM'`.
6. **Last-Admin Soft-Lock Protection**: The system prevents demoting or revoking the final active `ROLE_WORKSPACE_OWNER` in a tenant, preventing orphaned or unmanageable organizations.

---

## 2. Liquibase Migration (`changelog-000.000.00017.xml`)

```xml
<databaseChangeLog ...>
    <!-- 1. Create UNIPOST_IDENTITY_USERPERMISSION for Ad-Hoc Overrides -->
    <changeSet id="create-userpermission-table-17" author="antigravity">
        <comment>Create UNIPOST_IDENTITY_USERPERMISSION for ad-hoc user-level permission overrides</comment>
        <createTable tableName="${table_prefix}USERPERMISSION">
            <column name="id" type="BIGINT" autoIncrement="true">
                <constraints primaryKey="true" primaryKeyName="PK_USERPERMISSION"/>
            </column>
            <column name="uid" type="VARCHAR(255)">
                <constraints unique="true" nullable="false"/>
            </column>
            <column name="user_uid" type="VARCHAR(255)">
                <constraints nullable="false"/>
            </column>
            <column name="permission_uid" type="VARCHAR(255)">
                <constraints nullable="false"/>
            </column>
            <column name="tenant_id" type="VARCHAR(255)">
                <constraints nullable="false"/>
            </column>
            <column name="is_granted" type="BOOLEAN" defaultValueBoolean="true">
                <constraints nullable="false"/>
            </column>
            <column name="delegated_by_uid" type="VARCHAR(255)"/>
            <column name="reason" type="VARCHAR(500)"/>
            <column name="created_date" type="TIMESTAMP" defaultValueComputed="CURRENT_TIMESTAMP"/>
        </createTable>

        <sql dbms="postgresql">
            CREATE UNIQUE INDEX uk_userperm_tenant ON ${table_prefix}USERPERMISSION (user_uid, permission_uid, tenant_id);
            CREATE INDEX idx_userperm_lookup ON ${table_prefix}USERPERMISSION (user_uid, tenant_id);
        </sql>
    </changeSet>

    <!-- 2. Add tenant_id to UNIPOST_IDENTITY_ROLE -->
    <changeSet id="add-tenant-id-to-role-17" author="antigravity">
        <comment>Add tenant_id column to ROLE table to isolate custom tenant roles</comment>
        <addColumn tableName="${table_prefix}ROLE">
            <column name="tenant_id" type="VARCHAR(255)" defaultValue="SYSTEM">
                <constraints nullable="false"/>
            </column>
        </addColumn>
        <sql dbms="postgresql">
            CREATE INDEX idx_role_tenant ON ${table_prefix}ROLE (tenant_id) WHERE role_scope = 'TENANT';
        </sql>
    </changeSet>
</databaseChangeLog>
```

---

## 3. Full-Stack Implementation Deliverables

```
apps/backend/
├── unipost-db/src/main/resources/db/unipost/
│   └── changelog-000.000.00017.xml                 # [NEW] Liquibase migration
├── unipost-fw/src/main/java/com/unipost/
│   └── user/
│       ├── controller/
│       │   └── TenantRoleDelegationController.java # [NEW] REST controller for tenant delegation & overrides
│       ├── service/
│       │   └── TenantRoleDelegationService.java    # [NEW] Delegation ceiling validator & last-admin soft lock
│       └── repository/
│           ├── UserRoleRepository.java             # [MODIFY] Stamped tenant_id queries
│           └── UserPermissionRepository.java       # [NEW] Ad-hoc user permission overrides JPA repository
apps/console/
├── src/
│   ├── features/
│   │   └── system/
│   │       ├── api/
│   │       │   └── use-system-fleet.ts             # [MODIFY] Hooks for tenant delegation & permission overrides
│   │       ├── roles/
│   │       │   ├── rbac-matrix-grid.tsx            # [MODIFY] Matrix Studio with Tenant/System Scope Switcher & 35 atoms
│   │       │   ├── user-membership-drawer.tsx      # [MODIFY] Directory with "Delegate Roles" action per tenant member
│   │       │   ├── role-definition-modal.tsx       # [MODIFY] Role creation locked to tenant context with role_scope
│   │       │   ├── tenant-role-delegation-modal.tsx# [NEW] Modal for Tenant Admin to delegate roles + ad-hoc perms
│   │       │   └── __tests__/
│   │       │       └── rbac-matrix-grid.test.tsx   # [NEW] Unit/integration tests for matrix, directory & delegation
│   │       └── types/
│   │           └── rbac-matrix-types.ts            # [NEW] 35 canonical atoms, planes, role scopes, delegation payloads
│   ├── core/
│   │   └── sandbox/
│   │       └── handlers/
│   │           └── system-sandbox-handler.ts       # [MODIFY] Support tenant-sole role delegation routes in sandbox
│   └── locales/
│       ├── en/console.json                         # [MODIFY] Add delegation, scope, and validation keys
│       └── vi/console.json                         # [MODIFY] Vietnamese sync
```

---

## 4. Verification Plan

### Automated Tests
1. **Backend Unit & Slice Tests (`apps/backend`)**:
   - `TenantRoleDelegationServiceTest`:
     - Test: Tenant Admin delegates `ROLE_OPERATIONS_MANAGER` to member in same tenant -> SUCCESS.
     - Test: Tenant Admin attaches ad-hoc override `entity:record:delete = false` -> SUCCESS.
     - Test: Tenant Admin attempts to assign `ROLE_SYSTEM_ROOT` -> `SecurityException` (403).
     - Test: Tenant Admin attempts to demote sole active `ROLE_WORKSPACE_OWNER` -> `LastAdminProtectionException` (400).
     - Test: Tenant Admin attempts to delegate to user in another tenant -> `TenantMismatchException` (403).
     - Test: Sovereign Root can assign any role within `SYSTEM` -> SUCCESS.
   - Command:
     ```bash
     mvn test -pl unipost-fw -Dtest=TenantRoleDelegationServiceTest -q
     ```
2. **Frontend Unit & Component Integration Tests (`apps/console`)**:
   - `rbac-matrix-grid.test.tsx`:
     - Test: Scope toggle switches between Tenant Matrix and Sovereign Matrix.
     - Test: Matrix displays 35 canonical atoms across 5 planes.
     - Test: Staging role changes displays floating save/discard bar.
     - Test: Tenant delegation modal displays only tenant-scoped roles and ad-hoc permission overrides.
     - Test: Submitting delegation mutation invalidates user query cache.
   - Command:
     ```bash
     pnpm --filter @unipost/console test:run
     ```
3. **Playwright E2E Suite**:
   - Run updated Flow 12 E2E test verifying tenant-scoped delegation and WCAG 2.2 AA accessibility:
     ```bash
     pnpm --filter @unipost/console test:e2e e2e/12-sovereign-rbac-matrix.spec.ts
     ```
