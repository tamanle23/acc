# 034: Backend Multi-Tenant Workspace Entity & Auto-Provisioning Invariants

## Problem
In earlier iterations, Workspaces were conceptual constructs tracked on the frontend (`apps/console`), client stores (`useProfileStore`), and Unified Sandbox state. In the backend (`apps/backend`):
1. There was no PostgreSQL table or JPA entity representing Workspaces.
2. Tenant provisioning (`TenantProvisioningService`) cloned metadata Blueprint entities, attributes, and relationships, but left tenants without an initial default workspace record.
3. There was no backend database invariant guaranteeing that each tenant has exactly one active immutable default workspace or isolating workspaces via PostgreSQL Row Level Security (RLS).

## Plan
1. **Database Migration**: Create Liquibase changelog `changelog-000.000.00008.xml` defining `UNIPOST_WORKSPACES` with:
   - Soft-delete auditing (`deletedDate`).
   - PostgreSQL RLS policy isolating tenants while allowing sovereign custodian `SYSTEM` custody.
   - Partial unique index `uk_tenant_default_workspace` (`WHERE is_default = TRUE AND "deletedDate" IS NULL`) ensuring exactly 1 default workspace per tenant.
   - Unique index `uk_tenant_workspace_code` (`tenant_id, code` where active).
2. **Domain & Repository**:
   - Create `com.acc.domain.workspace.Workspace` extending `BaseModel`.
   - Create `com.acc.repository.jpa.WorkspaceRepository` extending `BaseRepository<Workspace>`.
3. **Provisioning Integration**:
   - Enhance `TenantProvisioningService` to automatically seed an immutable default workspace (`code: "MAIN"`, `name: "{tenantName} Primary"`, `is_default: true`, `is_immutable: true`).
   - Enhance `TenantProvisioningResult` to return `defaultWorkspaceUid` and `defaultWorkspaceName`.
4. **Verification**:
   - Update `TenantProvisioningServiceTest` with `WorkspaceRepository` mocking and assertions.
   - Run tests and compile all 10 backend reactor modules.

## Changes
- **Liquibase**:
  - `apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00008.xml`: Defined table, constraints, partial indexes, and RLS policy.
  - `apps/backend/acc-db/src/main/resources/db/acc/changelog-master.xml`: Included changelog 8.
- **Domain & Repository**:
  - `apps/backend/acc-fw/src/main/java/com/acc/domain/workspace/Workspace.java`: JPA Entity.
  - `apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/WorkspaceRepository.java`: JPA Repository with tenant queries.
- **Provisioning Service**:
  - `apps/backend/acc-fw/src/main/java/com/acc/tenant/service/TenantProvisioningService.java`: Step 5 auto-provisions default immutable workspace.
  - `apps/backend/acc-fw/src/main/java/com/acc/tenant/dto/TenantProvisioningResult.java`: Added default workspace tracking fields.
  - `apps/backend/acc-fw/src/test/java/com/acc/tenant/service/TenantProvisioningServiceTest.java`: Added mock and assertions across test cases.

## Verification
- Unit Tests: `apps/backend/mvnw.cmd test -pl acc-fw -Dtest=TenantProvisioningServiceTest` -> **5/5 tests passed** (0 failures, 0 errors).
- Full Build: `apps/backend/mvnw.cmd test-compile -DskipTests` -> **BUILD SUCCESS** across all 10 Maven reactor modules in 6.894s.

## Tasks
- [x] Phase 1: Database Migration (`UNIPOST_WORKSPACES` table, RLS, partial default index).
- [x] Phase 2: JPA Entity & Repository (`Workspace`, `WorkspaceRepository`).
- [x] Phase 2: Auto-provisioning pipeline integration in `TenantProvisioningService`.
- [ ] Phase 3: REST Controller & Client API Integration (`/api/v1/workspaces`).
