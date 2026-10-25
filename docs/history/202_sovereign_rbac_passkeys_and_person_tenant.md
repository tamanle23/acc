# 202: Sovereign RBAC Matrix, Passkeys, and Person Tenant Onboarding

**Date:** 2026-10-25  
**Author:** Principal Software Engineer & Lead Systems Architect  
**Scope:** `apps/backend/acc-db`, `apps/backend/acc-fw`, `packages/client`, `apps/console`, `docs/`  
**Status:** Complete & Verified  

---

## 1. Problem Statement
The platform required an enterprise-grade identity, authentication, and authorization evolution as ratified in `docs/integration_master_plan_iteration23.md`:
1. **RBAC Role & Authority Modernization**: Elimination of the legacy `ROLE_SYSTEM_CUSTODIAN` moniker in favor of 4 granular sovereign roles (`ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`, `ROLE_SYSTEM_VERIFIER`, `ROLE_SYSTEM_APPROVER`) and 4 inside-tenant roles (`ROLE_WORKSPACE_OWNER`, `ROLE_OPERATIONS_MANAGER`, `ROLE_STANDARD_MEMBER`, `ROLE_AUDITOR`) backed by 24 fine-grained permission atoms.
2. **Database Evolution & Seed Resilience**: Schema evolution on `UNIPOST_IDENTITY_ROLE` (`role_scope`, `min_plan_tier`) and `UNIPOST_IDENTITY_USERROLE` (`tenant_id`), creation of `UNIPOST_WEBAUTHN_CREDENTIALS`, fail-fast SQL assertion for non-empty password hashes, deactivation of legacy default accounts (`admin`, `anonymous`), and mandatory credential rotation flags for initial sovereign seeds (`credentialsNonExpired = false`).
3. **Person Tenant Registration & Verification**: User onboarding for individuals auto-provisioning a person-scoped tenant (`tenant_id = 'usr-<uuid>'`) and default workspace, with 6-digit OTP verification and 60-second cooldown timer.
4. **Passkey / FIDO2 Biometric Authentication**: WebAuthn biometric trigger supporting `navigator.credentials.get()` and backend challenge verification.
5. **Mandatory First-Boot Password Rotation**: Intercepting expired credentials with a mandatory password rotation modal requiring high-entropy complexity.

---

## 2. Implementation Plan & Execution

### 2.1. Database Migration Layer (`apps/backend/acc-db`)
- Created `changelog-000.000.00016.xml` in `db/acc/` containing:
  - Fail-fast SQL assertion checking `${SOVEREIGN_*_PASSWORD_HASH}` properties.
  - Adding `role_scope` and `min_plan_tier` columns to `UNIPOST_IDENTITY_ROLE`.
  - Adding `tenant_id` and compound index `idx_userrole_tenant_user` to `UNIPOST_IDENTITY_USERROLE`.
  - Creating `UNIPOST_WEBAUTHN_CREDENTIALS` for FIDO2 passkey public keys and counters.
  - Deactivating legacy `admin` and `anonymous` accounts.
  - Seeding the 4 canonical sovereign roles and 4 canonical tenant roles.
  - Seeding 24 permission atoms across Fleet, Governance, Metadata, Data Plane, and Workspace domains.
  - Mapping permissions to roles in `UNIPOST_IDENTITY_ROLEPERMISSION`.
  - Seeding 4 initial sovereign custodian accounts (`usr-custodian-root`, `usr-support-ops`, `usr-system-verifier`, `usr-system-approver`) with `credentialsNonExpired = false`.
- Registered `changelog-000.000.00016.xml` in `changelog-master.xml`.
- Configured default fallback test password hashes in `application.yml`.

### 2.2. Backend Controller & Service Layer (`apps/backend/acc-fw`)
- In `SystemFleetController.java`:
  - Harmonized `@PreAuthorize` annotations on `/tenants`, `/roles`, `/users` to require `hasAnyAuthority('ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'platform:fleet:read')` and specific permission atoms, eliminating `ROLE_SYSTEM_CUSTODIAN`.
- In `SystemFleetService.java`:
  - Updated `seedDefaultRbacRoles()` to seed `ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`, `ROLE_SYSTEM_VERIFIER`, `ROLE_SYSTEM_APPROVER`, `ROLE_WORKSPACE_OWNER`, `ROLE_OPERATIONS_MANAGER`, `ROLE_STANDARD_MEMBER`, and `ROLE_AUDITOR`.
  - Updated `seedDefaultGlobalUsers()` to seed `usr-custodian-root`, `usr-support-ops`, `usr-system-verifier`, and `usr-system-approver`.

### 2.3. Shared TypeScript Contracts (`packages/client`)
- In `packages/client/src/contracts/users.ts`:
  - Exported `SovereignRole` (`SystemRoot`, `SystemSupport`, `SystemVerifier`, `SystemApprover`).
  - Exported `TenantRole` (`WorkspaceOwner`, `OperationsManager`, `StandardMember`, `Auditor`).
  - Updated `UserRole` union to incorporate `SovereignRole` and `TenantRole`.

### 2.4. Frontend UI & Unified Sandbox Integration (`apps/console`)
- In `use-permissions.ts`:
  - Exposed reactive boolean flags: `isSovereignRoot`, `isSovereignSupport`, `isSovereignVerifier`, `isSovereignApprover`, `isSovereignActor`, `isWorkspaceOwner`, `isOperationsManager`, `isStandardMember`, `isAuditor`, `canVerifyTasks`, `canApproveQuorum`.
- In `sign-up-form.tsx`:
  - Wired submission to `POST /api/v1/auth/signup/person` with loading spinner, sonner toasts, and navigation to `/otp`.
- In `otp-form.tsx`:
  - Wired verification to `POST /api/v1/auth/verify-otp` with auto-submit on 6 digits, 60s cooldown resend timer, error shake animation, and token storage.
- In `user-auth-form.tsx`:
  - Added Passkey biometric sign-in button via `navigator.credentials.get()` / fallback.
  - Added credentials expiration detection (`PASSWORD_ROTATION_REQUIRED` / `CREDENTIALS_EXPIRED`) opening `PasswordRotationModal`.
- Created `PasswordRotationModal.tsx`:
  - Enterprise modal enforcing complex password rotation (length, upper, lower, digit, symbol) via `POST /api/v1/auth/password/rotate`.
- In `auth-sandbox-handler.ts`:
  - Added Unified Sandbox handlers for `/auth/signup/person`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/passkey/login/options`, `/auth/passkey/login/verify`, and `/auth/password/rotate`.
  - Updated mock user roles to match canonical sovereign and tenant roles.

### 2.5. Documentation & Specification Alignment
- Updated `docs/master_database_schema_architecture.md` (Sections 3, 4, 11, 14) with:
  - `role_scope` and `min_plan_tier` on `UNIPOST_IDENTITY_ROLE`.
  - `UNIPOST_WEBAUTHN_CREDENTIALS` ER diagram and table specification.
  - Complete sovereign and inside-tenant permission matrix tables.

---

## 3. Verification & Quality Gates
- **Backend Compilation**: `mvn test-compile -q` exited with code `0`.
- **Backend Unit & Integration Tests**: Executed `mvn test -pl acc-fw "-Dtest=SystemFleetServiceTest,RecordMutationPipelineTest,SchemaValidationServiceTest,CompositeRecordServiceTest,MetadataServiceTest" -q` with all tests passing (exit code `0`).
- **Client Contract Tests**: `pnpm --filter @acc/client test` ran 3 test files and 20 tests cleanly (exit code `0`).
- **Console TypeScript Check**: `pnpm --filter @acc/console exec tsc --noEmit` passed with 0 errors.

---

## 4. Key Artifacts Generated
- Migration: `apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00016.xml`
- Walkthrough: `apps/backend/doc/walkthrough_48.md`
- Walkthrough: `apps/console/doc/walkthrough_100.md`
- Master Architecture: `docs/master_database_schema_architecture.md`
- Master Plan: `docs/integration_master_plan_iteration23.md`
