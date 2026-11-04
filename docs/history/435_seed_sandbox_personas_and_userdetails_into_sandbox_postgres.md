# 435: Seed Sandbox Personas and UserDetails into Sandbox PostgreSQL

## Problem
In the backend Unified Sandbox Platform (`acc-sandbox`), `SandboxTokenAspect` intercepted `/api/auth/token` and `/api/auth/refresh` to mint valid cryptographic JWT tokens in-memory using `SandboxPersonaRegistry`.
However, the underlying PostgreSQL database was not populated with actual `User`, `Role`, `UserRole`, `Permission`, and `UserPermission` entities for those personas.
Consequently:
1. `UserDetailsServiceImpl.loadUserByUsername` failed to locate sandbox users (`admin@acc.io`, `custodian@system`, `creator@acc.io`, `user@acc.io`) in PostgreSQL.
2. Any downstream domain service, relational foreign key, user search, or audit trail relying on physical `USER` records in PostgreSQL failed or lacked entity resolution.

## Plan
1. **Implement Dedicated Sandbox User Seeder**:
   - Create `SandboxUserSeeder` in `com.acc.sandbox.seed`.
   - Iterate over all personas registered in `SandboxPersonaRegistry`.
   - Seed `User` records with BCrypt encoded password `"password"`, active status, and appropriate `UserType`.
   - Seed `Role` records (`WORKSPACE_OWNER`, `SYSTEM_ROOT`, `OPERATIONS_MANAGER`, `STANDARD_MEMBER`, `ADMIN`) and link via `UserRole` partitioned by tenant.
   - Seed granular `Permission` records and link via `UserPermission`.
2. **Wire into Sandbox Lifecycle**:
   - Register `SandboxUserSeeder` in `SandboxAutoConfiguration`.
   - Trigger `userSeeder.seedUsersIfMissing()` within `SandboxDataPreWarmer` upon `ApplicationReadyEvent` in DEV mode.
3. **Verify with Formal Tests**:
   - Update `SandboxDataPreWarmerTest` to verify user seeding is invoked.
   - Add `SandboxUserSeederTest` to verify all 4 personas, roles, and permissions are persisted.
   - Run the complete test suite.

## Changes
### Backend (`apps/backend/acc-sandbox`)
- `SandboxUserSeeder.java`:
  - Created seeder persisting `User`, `Role`, `UserRole`, `Permission`, and `UserPermission` entities from `SandboxPersonaRegistry`.
- `SandboxDataPreWarmer.java`:
  - Injected `SandboxUserSeeder` and triggered `seedUsersIfMissing()` during startup pre-warming.
- `SandboxAutoConfiguration.java`:
  - Added `SandboxUserSeeder.class` to `@Import`.
- `SandboxDataPreWarmerTest.java`:
  - Updated mock verifications to ensure user seeding is executed in DEV mode and skipped in TEST mode.
- `SandboxUserSeederTest.java`:
  - Added unit test suite verifying personas, roles, and permissions are seeded into JPA repositories.

## Verification
- Unit Tests:
  - `mvn test -am -pl acc-sandbox "-Dtest=SandboxUserSeederTest,SandboxDataPreWarmerTest" "-Dsurefire.failIfNoSpecifiedTests=false" -q` passed with 0 errors.
- Full Sandbox Suite:
  - `mvn test -pl acc-sandbox -q` passed (13 test classes).
- Multi-Module Compilation:
  - `mvn compile -am -pl acc-ms-aio` compiled cleanly across all 9 backend modules.

## Walkthrough
1. **Sandbox Application Startup (`dev:sandbox`)**:
   - Spring Boot fires `ApplicationReadyEvent`.
   - `SandboxDataPreWarmer` detects `DEV` mode and invokes `SandboxUserSeeder.seedUsersIfMissing()`.
   - Seeder checks PostgreSQL:
     - Seeds `admin@acc.io` with roles `WORKSPACE_OWNER`, `ADMIN`, `STANDARD_MEMBER`.
     - Seeds `custodian@system` with roles `SYSTEM_ROOT`, `SYSTEM_SUPPORT`.
     - Seeds `creator@acc.io` with roles `OPERATIONS_MANAGER`, `STANDARD_MEMBER`.
     - Seeds `user@acc.io` with role `STANDARD_MEMBER`.
     - All user passwords set to `"password"`.
2. **Subsequent Database Lookups**:
   - `userRepository.findByUserName("admin@acc.io")` returns the physical `User` entity.
   - `UserDetailsServiceImpl.loadUserByUsername` resolves successfully against PostgreSQL.

## Tasks
- [x] Create `SandboxUserSeeder` implementing idempotent JPA entity seeding for all sandbox personas.
- [x] Wire `SandboxUserSeeder` into `SandboxDataPreWarmer` and `SandboxAutoConfiguration`.
- [x] Update `SandboxDataPreWarmerTest` and create `SandboxUserSeederTest`.
- [x] Verify full `acc-sandbox` test suite.
- [x] Register archive in `docs/history/`.

## Enhancement
- In future iterations, add dynamic workspace association records to auto-link seeded users into `tenant-acme` and `SYSTEM` workspaces upon bootstrap.
