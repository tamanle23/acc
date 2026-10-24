# History Entry 197: Liquibase Unification, Dedicated UNIPOST_TENANTS Master Table & Identity Module Folding

## 1. Problem
The database architecture previously relied on floating, denormalized tenant string identifiers (`tenant_id VARCHAR(255)`) without a dedicated master entity governing organization-level lifecycles, statuses, or regions. Furthermore, Liquibase migrations were split into disconnected silos (`db/identity`, `db/unipost`, `db/fs`) with obsolete legacy tables (`ADDRESS`, `USERPROFILE`, `USERACTIVITY`), and the active identity codebase was locked in an unnecessary separate Maven module (`unipost-ms-identity`).

## 2. Plan
1. Create incremental Liquibase changelog `changelog-000.000.00014.xml` to:
   - Create `UNIPOST_TENANTS` master table with PostgreSQL Row-Level Security (RLS).
   - Automatically backfill existing tenants from `UNIPOST_WORKSPACES` / `UNIPOST_TENANT_BILLING` + `SYSTEM` root custodian.
   - Add `tenant_ref_id` foreign key referencing `UNIPOST_TENANTS.id` in `UNIPOST_WORKSPACES`.
2. Cleanly eliminate obsolete legacy identity tables `ADDRESS`, `USERPROFILE`, and `USERACTIVITY` directly at source:
   - Removed table, index, and constraint definitions from `changelog-identity-00.xml`.
   - Removed corresponding mock data inserts from `changelog-identity-mock_data.xml`.
   - Removed any DROP TABLE runtime statements.
3. Unify all migrations under a single authoritative entry point `db/changelog-master.xml`.
3. Create JPA entity `Tenant.java` and `TenantRepository.java` in `unipost-fw`.
4. Update `TenantProvisioningService.java` to atomically verify/persist `Tenant` in `UNIPOST_TENANTS` and bind `tenant_ref_id`.
5. Fold active identity components (domain models, repositories, and services) into `unipost-fw` and `unipost-ms-aio`, and decommission the separate `unipost-ms-identity` Maven module.
6. Verify compilation and execution with targeted backend test suites.

## 3. Changes
- **Database & Migrations**:
  - `apps/backend/unipost-db/src/main/resources/db/changelog-master.xml`: Unified master migration graph.
  - `apps/backend/unipost-db/src/main/resources/db/unipost/changelog-000.000.00014.xml`: Incremental DDL for `UNIPOST_TENANTS`, backfill, FKs, RLS, and dead table drops.
  - `apps/backend/unipost-db/src/main/resources/application.yml`: Pointed Liquibase configuration to unified master.
- **Domain & Services (`unipost-fw`)**:
  - Added `Tenant.java` and `TenantRepository.java`.
  - Updated `Workspace.java` with `@ManyToOne` association to `Tenant`.
  - Updated `TenantProvisioningService.java` to link master `Tenant` on workspace creation.
  - Folded active identity entities, repositories, and services into `unipost-fw`.
- **Application Tier (`unipost-ms-aio`)**:
  - Added `users.graphqls` schema and MyBatis SQL mappers to `unipost-ms-aio`.
- **Decommissioned**:
  - Removed `unipost-ms-identity` from root `pom.xml`, dependency lists, and deleted the folder.
- **Documentation**:
  - Updated `docs/master_database_schema_architecture.md`.

## 4. Verification
- Backend compilation: `./mvnw test-compile -q` PASSED.
- Targeted backend test suite: `./mvnw test -pl unipost-fw "-Dtest=TenantProvisioningServiceTest,SovereignCustodyAndRlsTest,TenantContextAndAspectTest"` ran 15/15 tests PASSED (0 failures, 0 errors).
- Frontend type safety: `pnpm --filter @unipost/console exec tsc --noEmit` exited with code 0 (zero errors).

## 5. Walkthrough
Refer to [`docs/master_database_schema_architecture.md`](../master_database_schema_architecture.md) for the unified database architecture.
