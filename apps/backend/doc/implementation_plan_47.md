# Implementation Plan 47: Secure Credential Management & Sovereign Custody Seed (Iteration 23)

## Goal Description
Implement comprehensive, idempotent, production-grade seed data for:
1. **The Sovereign RBAC Permission Matrix**: Standardizing roles (`ROLE_SYSTEM_CUSTODIAN`, `ROLE_ADMIN`, `ROLE_USER`, `ROLE_READONLY`) and permission atoms (`platform:fleet:read`, `platform:fleet:mutate`, `platform:tenant:assume`, `platform:quotas:override`, `platform:roles:manage`, `platform:users:lock`, `platform:dlq:manage`, `METADATA_SCHEMA_READ`, `METADATA_SCHEMA_WRITE`, `METADATA_RECORD_READ`, `METADATA_RECORD_WRITE`, `TENANT_SETTINGS_MANAGE`, `BILLING_MANAGE`) mapped via `UNIPOST_IDENTITY_ROLEPERMISSION`.
2. **Zero-Plaintext Credential Management**: Protecting administrative credentials from being committed to version control using Liquibase dynamic property injection (`${SOVEREIGN_CUSTODIAN_PASSWORD_HASH}`) and first-boot password expiration (`CREDENTIALSNONEXPIRED = false`).
3. **Global Users Registry**: Seeding the Sovereign Platform Custodian root user (`custodian`, UID `usr-custodian-root`), Org Admins, and standard operators into `UNIPOST_IDENTITY_USER` and binding them via `UNIPOST_IDENTITY_USERROLE`.
4. **SYSTEM Tenant Canonical Custody Seeding**: Seeding the root `SYSTEM` organization in `UNIPOST_TENANTS`, its default immutable workspace in `UNIPOST_WORKSPACES`, its billing entitlement in `UNIPOST_TENANT_BILLING`, and publishing canonical ecosystem blueprint schemas (`UNIPOST_ENTITY_TYPES` with `tenant_id = 'SYSTEM'`).
5. **Master Architectural Specification Synchronization**: Updating [`docs/master_database_schema_architecture.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/master_database_schema_architecture.md) to document the complete seed catalog, topological sequence, credential management model, and verification matrix.

---

## User Review Required

> [!IMPORTANT]
> - **Zero Committed Production Secrets**: No plaintext passwords or production BCrypt hashes are committed into Git. Liquibase evaluates `${SOVEREIGN_CUSTODIAN_PASSWORD_HASH}` injected by container environment or vault at runtime, falling back to an explicit dummy dev hash for offline unit testing only.
> - **Mandatory First-Boot Password Rotation**: `CREDENTIALSNONEXPIRED` is set to `FALSE` for default seeded administrative accounts to mandate password rotation on first login in live environments.
> - **Idempotent Inserts**: All SQL inserts in Liquibase utilize `ON CONFLICT (code) DO NOTHING` or `WHERE NOT EXISTS` ensuring safe, repeatable executions.

---

## Proposed Changes

### Database Layer (`apps/backend/unipost-db`)

#### [NEW] `apps/backend/unipost-db/src/main/resources/db/unipost/changelog-000.000.00016.xml`
- Implements:
  1. `<property name="custodian_password_hash" value="${SOVEREIGN_CUSTODIAN_PASSWORD_HASH:...}"/>`
  2. Canonical roles, 13 permission atoms, and role-permission mappings.
  3. Sovereign root custodian user (`custodian`, UID `usr-custodian-root`).
  4. Dev/test personas (`alice@acme.com`, `bob@logistics.vn`) tagged with `context="dev, test, local, mock"`.
  5. SYSTEM tenant master catalog, root workspace, and enterprise billing entitlement.
  6. Canonical blueprint models for `SYSTEM` tenant.

#### [MODIFY] `apps/backend/unipost-db/src/main/resources/db/unipost/changelog-master.xml`
- Links `changelog-000.000.00016.xml`.

---

### Backend Service Alignment Layer (`apps/backend/unipost-fw`)

#### [MODIFY] `apps/backend/unipost-fw/src/main/java/com/unipost/system/service/SystemFleetService.java`
- Harmonizes in-memory stores with the exact database seed UIDs, roles, and permission atoms.

---

### Documentation Layer

#### [MODIFY] `docs/master_database_schema_architecture.md`
- Documents the Zero-Plaintext Credential Management Architecture in Section 3.3.
- Updates Section 11 Liquibase topology graph to link `changelog 16`.

---

## Verification Plan

### Automated Tests
```bash
cmd.exe /c "mvnw.cmd test-compile -q"
cmd.exe /c "mvnw.cmd test -pl unipost-fw -Dtest=SystemFleetServiceTest,TenantProvisioningServiceTest,PayOsBillingAndEntitlementsTest -q"
pnpm --filter @unipost/console exec tsc --noEmit
pnpm --filter @unipost/console test src/core/sandbox/__tests__/system-sandbox.test.ts
```
