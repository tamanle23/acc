# Implementation Plan 48: Sovereign RBAC Matrix, Fail-Fast Credential Injection & System Custody

- **Target App**: `@unipost/backend`
- **Related Spec**: `docs/master_database_schema_architecture.md`
- **History Tracking**: `docs/history/202_seed_sovereign_rbac_and_custody.md`

---

## 1. Context & Architectural Rationale

Following enterprise security standards and feedback on credential management:
1. **Zero Secret in Git**: Passwords and static password hashes are strictly forbidden in source control.
2. **Fail-Fast Credential Injection**: Liquibase will require external environment variables `${SOVEREIGN_*_PASSWORD_HASH}` and abort immediately if any are unexpanded or missing.
3. **Multi-Level Sovereign Roles**:
   - `ROLE_SYSTEM_ROOT`: Supreme god admin for the platform.
   - `ROLE_SYSTEM_SUPPORT`: Tenant support, billing adjustments, assume-tenant capability.
   - `ROLE_SYSTEM_VERIFIER`: Read-only compliance and immutable audit log inspection.
   - `ROLE_SYSTEM_APPROVER`: Dual-custody authorization for high-risk fleet mutations.
4. **Elimination of Generic Roles**: `ROLE_USER` and `ROLE_READONLY` are eliminated.
5. **Decoupled Organizational RBAC**: Commercial organizations manage custom roles and permissions dynamically via the metadata engine (`UNIPOST_ENTITIES`), preserving purity in platform-level identity tables.
6. **Realistic Personas**: Dedicated operational identities for root, ops support, compliance, and governance.

---

## 2. Proposed Changes

### `apps/backend/unipost-db`
- Create `changelog-000.000.00016.xml`:
  - Fail-fast SQL precondition enforcing presence of password hashes.
  - Insert permissions, sovereign roles, role permissions, users, and user roles.
- Include in `changelog-master.xml`.

### `docs/master_database_schema_architecture.md`
- Synchronize section 4 and section 5 with the refined Sovereign RBAC schema, permission catalog, and dynamic tenant role decoupling.

---

## 3. Verification Plan
- `mvnw.cmd test-compile -q`
- Unit and slice tests with test-scoped credentials.
- `pnpm --filter @unipost/console exec tsc --noEmit`
