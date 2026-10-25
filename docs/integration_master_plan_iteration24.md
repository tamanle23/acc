# Integration Master Plan: Iteration 24 - Tenant-Sole Role Assignment, Subordinate RBAC Delegation, Ad-Hoc Permission Overrides & Enterprise Security Studio Upgrade

**Target Systems:**  
- `@unipost/backend` (`apps/backend/unipost-db`, `apps/backend/unipost-fw`, `apps/backend/unipost-ms-aio`)  
- `@unipost/client` (`packages/client/src/contracts/system.ts`)  
- `@unipost/console` (`apps/console/src/features/system`, `apps/console/src/core/sandbox`)  
**Lead Systems Architect:** Principal Polyglot Architect, Spring Boot Backend Specialist, TypeScript Frontend Architect & UI/UX Systems Specialist  
**Standards:** W3C WebAuthn Level 3 / FIDO2, NIST SP 800-63B, PostgreSQL 16+ RLS, WCAG 2.2 AA, Liquid Glass Design Tokens  
**Reference SSOT:** [`docs/master_database_schema_architecture.md`](master_database_schema_architecture.md) (v1.5.0)  

---

## 1. Executive Summary & Core Architectural Decisions

In enterprise multi-tenant systems, allowing cross-tenant role assignments or permitting tenant administrators to delegate permissions beyond their own authorized boundary creates critical privilege escalation vulnerabilities. 

Iteration 24 formalizes the **Tenant-Sole Role Assignment and Subordinate RBAC Delegation Invariant**:

> **"Roles and permissions are solely assignable to a tenant context, and a Tenant Admin can delegate only its own roles and permissions to the tenant's users."**

### Architectural Invariants & User Alignment (Post-Grill Decisions):
1. **Global Tenant-Wide Scope**: When a Tenant Admin delegates roles or permissions to a user, the delegation applies across all workspaces within that tenant organization (`app.current_tenant_id = target_tenant`).
2. **Tenant-Scoped Custom Roles**: Custom roles created by Tenant Admins have `role_scope = 'TENANT'` and are stamped with `tenant_id` in `UNIPOST_IDENTITY_ROLE`. They are visible and assignable **only** within that creating tenant organization.
3. **Ad-Hoc Direct Permission Overrides via `UNIPOST_IDENTITY_USERPERMISSION`**: In addition to coarse-grained roles, Tenant Admins can attach direct ad-hoc permission grants or denials (`is_granted = true/false`) to individual users, backed by a dedicated join table stamped with `tenant_id`.
4. **Subordinate Delegation Boundary (Delegation Ceiling)**: A Tenant Admin (`ROLE_WORKSPACE_OWNER`) can delegate only permissions that they themselves hold (`perm.role_scope = 'TENANT'`).
5. **Sovereign System Role Quarantine**: Sovereign System roles (`ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`, `ROLE_SYSTEM_VERIFIER`, `ROLE_SYSTEM_APPROVER`) are strictly marked with `role_scope = 'SYSTEM'` and can **never** be delegated, assigned, or assumed outside of `tenant_id = 'SYSTEM'`.
6. **Last-Admin Soft-Lock Protection**: The system prevents demoting or revoking the final active `ROLE_WORKSPACE_OWNER` in a tenant, preventing orphaned or unmanageable organizations.

```
+─────────────────────────────────────────────────────────────────────────────────────────+
|               TENANT-SOLE RBAC ASSIGNMENT & DELEGATION ARCHITECTURE                     |
+─────────────────────────────────────────────────────────────────────────────────────────+
| CONSOLE UI (Tenant Context Switcher: tenant-acme)                                       |
|                                                                                         |
| [Tenant Admin: Alice] ──► Opens "Delegate Roles" for [Member: Bob]                      |
|                           ├── Roles: [ROLE_OPERATIONS_MANAGER, ROLE_STANDARD_MEMBER]    |
|                           │   (Sovereign roles filtered out & disabled)                 |
|                           ├── Ad-Hoc Perm Overrides: [entity:record:delete = FALSE]     |
|                           └── Available Scope: Subset of Alice's 13 org:* permissions   |
|                                                                                         |
|                           ▼                                                             |
| API PUT /api/v1/system/tenants/{tenantId}/users/{userId}/delegation                     |
| Payload: { roles: [...], permissionOverrides: [...], reason: 'Lead promotion' }         |
+─────────────────────────────────────────────────────────────────────────────────────────+
| BACKEND SPRING SECURITY & POSTGRESQL RLS                                                |
|                                                                                         |
| 1. Capability Barrier: @PreAuthorize("hasAuthority('org:member:manage') or ...")       |
| 2. Scope Barrier: Checks app.current_tenant_id == target tenantId                       |
| 3. Subordinate Barrier: TenantAdmin cannot grant permissions they do not possess       |
| 4. Last-Admin Barrier: Rejects demotion if target is final active ROLE_WORKSPACE_OWNER |
| 5. Persistence: Updates UNIPOST_IDENTITY_USERROLE & UNIPOST_IDENTITY_USERPERMISSION    |
+─────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Liquibase Database Migration (`changelog-000.000.00017.xml`)

1. **Create Table `UNIPOST_IDENTITY_USERPERMISSION`**:
   ```xml
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
   ```
2. **Index & Constraints**:
   - Unique constraint: `uk_userperm_tenant (user_uid, permission_uid, tenant_id)`.
   - Index: `idx_userperm_lookup ON ${table_prefix}USERPERMISSION (user_uid, tenant_id)`.
   - Foreign key to `${table_prefix}USER` and `${table_prefix}PERMISSION`.
3. **Evolve `UNIPOST_IDENTITY_ROLE`**:
   - Add `tenant_id VARCHAR(255) DEFAULT 'SYSTEM' NOT NULL` to allow tenant-scoped custom roles.
   - Partial index: `idx_role_tenant ON ${table_prefix}ROLE (tenant_id) WHERE role_scope = 'TENANT'`.

---

## 3. Two-Tier Scope Architecture: System vs Tenant

### A. Sovereign System Tier (`tenant_id = 'SYSTEM'`)
- **Admin Role**: `ROLE_SYSTEM_ROOT`
- **Scope**: Platform-wide cluster management, database migration, circuit breaker, tenant provisioning.
- **Assignable Roles**: `ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`, `ROLE_SYSTEM_VERIFIER`, `ROLE_SYSTEM_APPROVER`.
- **Assignable Permissions**: `platform:*`, `security:*`, `billing:*`, `metadata:*`.

### B. Tenant Organization Tier (`tenant_id = 'tenant-xyz'`)
- **Admin Role**: `ROLE_WORKSPACE_OWNER`
- **Scope**: Scoped solely to `tenant-xyz` via PostgreSQL RLS `app.current_tenant_id`.
- **Assignable Roles**: `ROLE_OPERATIONS_MANAGER`, `ROLE_STANDARD_MEMBER`, `ROLE_AUDITOR`, plus tenant-created custom roles (`role_scope = 'TENANT', tenant_id = 'tenant-xyz'`).
- **Assignable Permissions**: `org:*`, `entity:record:*`, `metadata:schema:read`.
- **Prohibited**: Any assignment of `ROLE_SYSTEM_*` or `platform:*` results in immediate `HTTP 403 Forbidden` (`ProblemDetail: "CROSS_TENANT_PRIVILEGE_VIOLATION"`).

---

## 4. Full 35 Canonical Permission Dictionary

| Security Plane | Atom Code | Category | Clearance Tier | Description |
| :--- | :--- | :--- | :--- | :--- |
| **PLATFORM** | `platform:fleet:read` | Fleet | Sovereign Tier 3 | Inspect fleet inventory and cluster runtime metrics |
| **PLATFORM** | `platform:fleet:mutate` | Fleet | Sovereign Tier 4 | Provision, suspend, or update tenant cluster resources |
| **PLATFORM** | `platform:fleet:circuit_trip` | Fleet | Sovereign Tier 3 | Emergency systemic circuit breaker trip |
| **PLATFORM** | `platform:tenant:assume` | Fleet | Sovereign Tier 3 | Assume tenant context for support and troubleshooting |
| **PLATFORM** | `platform:tenant:suspend` | Fleet | Sovereign Tier 4 | Temporarily lock tenant traffic and API access |
| **PLATFORM** | `platform:tenant:purge:request` | Fleet | Sovereign Tier 4 | Request permanent cryptographic tenant data shredding |
| **PLATFORM** | `platform:tenant:purge:approve` | Fleet | Sovereign Tier 3 | Dual-custody sign-off for permanent tenant shredding |
| **PLATFORM** | `platform:quotas:override` | Fleet | Sovereign Tier 3 | Override workspace, schema, and record quota limits |
| **PLATFORM** | `platform:roles:manage` | Governance | Sovereign Tier 4 | Manage sovereign roles, permission matrices, and DAGs |
| **PLATFORM** | `platform:users:lock` | Governance | Sovereign Tier 4 | Emergency cross-tenant account lockdown |
| **PLATFORM** | `platform:workflow:submit` | Quorum | Sovereign Tier 3 | Submit high-risk task to quorum queue |
| **PLATFORM** | `platform:workflow:verify` | Quorum | Sovereign Tier 2 | Verify and pre-flight proposed system task |
| **PLATFORM** | `platform:workflow:approve` | Quorum | Sovereign Tier 3 | Sign off and make permanent verified change |
| **PLATFORM** | `platform:workflow:reject` | Quorum | Sovereign Tier 3 | Reject or return pending quorum task |
| **METADATA** | `metadata:schema:read` | Schema | Community | Read dynamic entity types and attribute definitions |
| **METADATA** | `metadata:schema:write` | Schema | Sovereign Tier 4 | Author, modify, and deploy dynamic entity schemas |
| **METADATA** | `metadata:blueprint:package` | Blueprint | Sovereign Tier 4 | Package system catalog blueprint manifests |
| **METADATA** | `metadata:blueprint:provision`| Blueprint | Sovereign Tier 3 | Provision blueprint packages into tenant workspaces |
| **METADATA** | `metadata:cache:evict` | Infrastructure| Sovereign Tier 4 | Force invalidate L1/L2 schema cache partitions |
| **SECURITY** | `platform:security:inspect` | Audit | Sovereign Tier 2 | Inspect real-time security events and RLS alerts |
| **SECURITY** | `platform:audit:verify` | Audit | Sovereign Tier 2 | Verify cryptographic audit trail forward hashes |
| **SECURITY** | `platform:compliance:export` | Compliance | Sovereign Tier 2 | Export tamper-evident compliance evidence bundles |
| **SECURITY** | `platform:dlq:manage` | Operations | Sovereign Tier 3 | Inspect and replay mutation dead-letter queue records |
| **COMMERCIAL** | `billing:tier:override` | Billing | Sovereign Tier 4 | Manually override tenant subscription tier |
| **COMMERCIAL** | `billing:manual:invoice` | Billing | Sovereign Tier 3 | Issue manual credits and dispute adjustments |
| **COMMERCIAL** | `billing:reconcile` | Billing | Sovereign Tier 3 | Trigger payment gateway reconciliation |
| **COMMERCIAL** | `tenant:feature:grant` | Features | Sovereign Tier 3 | Selectively enable tenant feature flags |
| **COMMERCIAL** | `platform:kyc:verify` | KYC | Sovereign Tier 2 | Review tenant KYC and business registration proofs |
| **COMMERCIAL** | `platform:kyc:approve` | KYC | Sovereign Tier 3 | Approve commercial account credit lines and limits |
| **ORGANIZATION**| `org:workspace:read` | Workspace | Community | View workspace metadata and provisioned schemas |
| **ORGANIZATION**| `org:workspace:mutate` | Workspace | Community | Update workspace branding and settings |
| **ORGANIZATION**| `org:member:invite` | Membership | Community | Invite team members to workspace |
| **ORGANIZATION**| `org:member:manage` | Membership | Community | Manage member statuses and role delegations |
| **ORGANIZATION**| `org:billing:read` | Billing | Community | View subscription usage and invoices |
| **ORGANIZATION**| `org:billing:upgrade` | Billing | Community | Initiate plan tier upgrades |
| **ORGANIZATION**| `entity:record:read` | Records | Community | Read dynamic business entity records |
| **ORGANIZATION**| `entity:record:create` | Records | Community | Create dynamic business entity records |
| **ORGANIZATION**| `entity:record:update` | Records | Community | Update dynamic business entity records |
| **ORGANIZATION**| `entity:record:delete` | Records | Community | Soft-delete dynamic business entity records |
| **ORGANIZATION**| `org:workflow:submit` | Workflow | Standard | Submit record for internal approval |
| **ORGANIZATION**| `org:workflow:approve` | Workflow | Standard | Approve internal workflow transition |
| **ORGANIZATION**| `org:audit:read` | Audit | Pro | Read tenant record change history deltas |

---

## 5. Full-Stack Implementation Deliverables & UI Architecture

### 5.1 Three-Tab Architecture for `/system/roles` (`system.roles.tsx`)
The view is structured into three dedicated tabs under Liquid Glass styling:
1. **Tab 1: Permission Matrix (`<RbacMatrixGrid />`)**:
   - 35 canonical atoms across 5 security planes with category filter pills and live search.
   - Dual-Scope segmented control: "Tenant Organization Matrix" vs "Sovereign Cluster Matrix".
   - Sticky left column (permissions) and sticky top row (roles) with zero-gap borders.
   - Live inheritance calculation with lock icon on DAG-inherited permissions.
   - Floating amber glass commit strip for batch saving staged modifications.
2. **Tab 2: Roles Management (`<RoleManagementTab />` - NEW)**:
   - Dedicated management view for Role lifecycle operations.
   - Roles Catalog Data Table displaying Role Code, Name, Scope (`SYSTEM` vs `TENANT`), Assigned Tenant, Clearance / Plan Tier, Inherited DAG Roles, Member Count, and Actions.
   - **Role CRUD**: Create new custom tenant or system role (`<RoleDefinitionModal />`).
   - **Role Inspection**: Deep inspect permissions grouped by plane (`<RoleInspectorDialog />`).
   - **Delete/Revoke Protection**: Soft-lock guard preventing deletion of core system and tenant roles.
3. **Tab 3: Universal Users Directory (`<UserMembershipDrawer />`)**:
   - High-density table with Tenant Badge Chips, Passkey WebAuthn telemetry badges, and email verification indicators.
   - **"Delegate Roles" Action (`<TenantRoleDelegationModal />`)**: Allows Tenant Admins to assign tenant-scoped roles and attach ad-hoc permission overrides (`is_granted = true/false`) to tenant members, enforcing the delegation ceiling and last-admin soft-lock.
   - Emergency Session Revocation and reason-audited Account Lockdown dialog.

### 5.2 Deliverables File Tree
```
apps/backend/
├── unipost-db/src/main/resources/db/unipost/
│   └── changelog-000.000.00017.xml                 # [NEW] Liquibase migration: UNIPOST_IDENTITY_USERPERMISSION + role tenant_id
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
│   ├── routes/_authenticated/
│   │   └── system.roles.tsx                        # [MODIFY] 3-tab layout: Matrix, Roles Management, Users Directory
│   ├── features/
│   │   └── system/
│   │       ├── api/
│   │       │   └── use-system-fleet.ts             # [MODIFY] Hooks for tenant delegation, deleteRole, and role CRUD
│   │       ├── roles/
│   │       │   ├── rbac-matrix-grid.tsx            # [MODIFY] Matrix Studio with Tenant/System Scope Switcher & 35 atoms
│   │       │   ├── role-management-tab.tsx         # [NEW] Dedicated Roles Management tab (table, CRUD, tenant assign)
│   │       │   ├── role-definition-modal.tsx       # [MODIFY] Role creation locked to tenant context with role_scope
│   │       │   ├── role-inspector-dialog.tsx       # [NEW] Role deep-inspection dialog showing permissions breakdown
│   │       │   ├── user-membership-drawer.tsx      # [MODIFY] Directory with "Delegate Roles" action per tenant member
│   │       │   ├── tenant-role-delegation-modal.tsx# [NEW] Modal for Tenant Admin to delegate roles + ad-hoc perms
│   │       │   └── __tests__/
│   │       │       └── rbac-matrix-grid.test.tsx   # [NEW] Unit/integration tests for 3 tabs & delegation
│   │       └── types/
│   │           └── rbac-matrix-types.ts            # [NEW] 35 canonical atoms, planes, role scopes, delegation payloads
│   ├── core/
│   │   └── sandbox/
│   │       └── handlers/
│   │           └── system-sandbox-handler.ts       # [MODIFY] Support 35 atoms, role CRUD, and user delegation
│   └── locales/
│       ├── en/console.json                         # [MODIFY] Add delegation, scope, role management, and validation keys
│       └── vi/console.json                         # [MODIFY] Vietnamese sync
```

---

## 6. Verification Plan

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
