# 430 - Clean Cross-Stack Authorization & User Profile Architecture

## Problem
Prior to this implementation, the authorization and identity models between `@acc/backend` (Spring Boot / Modulith) and `@acc/console` (React 19 / Vite 8) exhibited architectural drift, legacy alias baggage, and security leaks:
1. **JWT Claim Asymmetry & Client Token Cracking**: The client application cracked open JWT tokens using browser `atob` (`decodeJwt`) to extract claims, violating zero-client-trust principles and failing when backend claims changed.
2. **Legacy Alias Baggage**: The backend retained legacy permission tokens (e.g. `METADATA_RECORD_READ`, `METADATA_SCHEMA_WRITE`, `metadata:record:read`) across SpEL expressions (`@PreAuthorize`) and evaluation pipelines.
3. **Roles vs Permissions Confusion**: Roles (`ROLE_*`) and granular permission atoms were conflated in authorization checks.
4. **Quorum Remnants**: Unimplemented two-custody approval quorum roles (`ROLE_SYSTEM_VERIFIER`, `ROLE_SYSTEM_APPROVER`) lingered in RBAC matrix definitions.
5. **Absence of Self-Service Profile API**: User identity in session profile was mingled with user account details without dedicated endpoints for updating user name, contact information, and UI preferences.
6. **Dual Auth Stores**: Console maintained two stores: legacy cookie-based `useAuthStore` and session-based `useSpringAuthStore`.

## Plan
1. Establish a **Canonical Permission Catalog** across 7 planes: `platform`, `metadata`, `entity:record`, `workspace`, `workflow`, `audit`, and `billing`.
2. Strictly separate Roles (`ROLE_*`) and Permissions (`<plane>:<resource>:<action>`).
3. Purge all legacy alias tokens (`METADATA_*`) with zero backward-compatibility debt.
4. Treat client-side JWTs as opaque bearer credentials. Implement `GET /api/auth/me` returning `AuthenticationProfile` to hydrate `useSpringAuthStore`.
5. Implement dedicated self-service user profile endpoints: `GET /api/v1/user/profile` and `PUT /api/v1/user/profile` with JSON `preferences`.
6. Eliminate two-person Quorum roles and permission atoms.
7. Align `@acc/sandbox` with 100% offline-to-online parity.
8. Delete legacy `useAuthStore` in `@acc/console` and update all consumers.

## Changes

### 1. Contracts (`@acc/client`)
- `packages/client/src/contracts/auth.ts`: Defined `CanonicalRole`, `CanonicalPermission` (39 atoms), `AuthenticationProfile`, `AuthenticationToken`, `LoginResponse`.
- `packages/client/src/contracts/users.ts`: Defined `UserProfileDto`, `UpdateUserProfileRequest`, `UserPreferences`.

### 2. Backend (`@acc/backend`)
- `apps/backend/acc-core/src/main/java/com/acc/core/constant/CanonicalPermissions.java`: Created constant catalog of all 39 atoms across 7 planes.
- `apps/backend/acc-core/src/main/java/com/acc/core/constant/CanonicalRoles.java`: Created 6 standard canonical roles (`ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`, `ROLE_WORKSPACE_OWNER`, `ROLE_OPERATIONS_MANAGER`, `ROLE_STANDARD_MEMBER`, `ROLE_AUDITOR`).
- `apps/backend/acc-fw/src/main/java/com/acc/system/dto/AuthenticationProfileDto.java`: Added session DTO for `/api/auth/me`.
- `apps/backend/acc-fw/src/main/java/com/acc/system/dto/UserProfileDto.java` & `UpdateUserProfileRequest.java`: DTOs for `/api/v1/user/profile`.
- `apps/backend/acc-fw/src/main/java/com/acc/user/model/User.java`: Added `preferences` text column.
- `apps/backend/acc-fw/src/main/java/com/acc/user/service/UserProfileService.java` & `UserProfileServiceImpl.java`: Service implementation for user profile read and update.
- `apps/backend/acc-fw/src/main/java/com/acc/presentation/UserProfileController.java`: Endpoints `GET` and `PUT` on `/api/v1/user/profile`.
- `apps/backend/acc-fw/src/main/java/com/acc/user/controller/AuthenticationController.java`: Added `GET /api/auth/me` calling `TokenService.getAuthenticationProfile()`.
- `apps/backend/acc-fw/src/main/java/com/acc/user/service/TokenService.java` & `TokenServiceImpl.java`: Implemented `getAuthenticationProfile(username)` resolving roles, permissions, and active features.
- `apps/backend/acc-fw/src/main/java/com/acc/fw/security/CustomPermissionEvaluator.java`: Supported colon-separated permission atoms (`hasAuthority(permission.toLowerCase())`).
- `apps/backend/acc-fw/src/main/java/com/acc/user/service/impl/UserDetailsServiceImpl.java`: Maintained lowercase canonical atoms in granted authorities.
- `apps/backend/acc-fw/src/main/java/com/acc/presentation/CompositeEntityController.java`, `MetadataController.java`, `WorkspaceController.java`, `SystemFleetController.java`, `TenantBillingController.java`, `TenantDataLifecycleController.java`: Replaced legacy SpEL strings with canonical permission atoms (`hasAuthority('entity:record:read')`, `hasAuthority('metadata:schema:write')`, etc.).
- `apps/backend/acc-fw/src/main/java/com/acc/system/service/SystemFleetService.java`: Seeded canonical roles without Quorum.
- `apps/backend/acc-fw/src/main/java/com/acc/fw/core/jwt/JwtTokenHelper.java`: Serialized `roles` and `permissions` in claims; preserved lowercase canonical atoms.

### 3. Unified Sandbox (`@acc/sandbox`)
- `packages/sandbox/src/handlers/auth-sandbox-handler.ts`:
  - Updated `SANDBOX_AUTH_USERS` and `SANDBOX_REFRESH_TOKENS` to canonical roles.
  - Handled `GET /auth/me` returning `AuthenticationProfile`.
  - Handled `GET` and `PUT` on `/api/v1/user/profile` maintaining mock profile state.
- `packages/sandbox/src/store.ts`: Aligned `DEFAULT_SANDBOX_PERSONAS` with canonical roles.
- `packages/sandbox/src/handlers/system-sandbox-handler.ts`: Replaced legacy roles and permissions in `DEFAULT_ROLES` and `/assume`.
- `packages/sandbox/src/handlers/data/metadata.ts`: Updated FSM `allowed_roles` to canonical roles.
- `packages/sandbox/src/jwt.ts`: Defined internal `SandboxJwtPayload`.

### 4. Console Client (`@acc/console`)
- `apps/console/src/features/spring-auth/types.ts`: Replaced `JwtPayload` with `AuthenticationProfile`.
- `apps/console/src/features/spring-auth/store.ts`: Removed `decodeJwt` import and client-side cracking in `setTokens`. Added `setUser(profile)`.
- `apps/console/src/features/spring-auth/api-client.ts`: Exported `fetchAuthenticationProfile()`.
- `apps/console/src/features/spring-auth/hooks/use-auth-hydration.ts`: Hydrated session via `fetchAuthenticationProfile()` on startup.
- `apps/console/src/features/system/hooks/use-has-permission.ts`: Switched from `useAuthStore` to `useSpringAuthStore`, mapped canonical fallback permissions.
- `apps/console/src/stores/auth-store.ts`: **Deleted** legacy auth store.
- `apps/console/src/main.tsx`, `sign-out-dialog.tsx`, `data-privacy-panel.tsx`, `record-audit-history-drawer.tsx`: Switched callers to `useSpringAuthStore`.
- `apps/console/src/components/layout/data/sidebar-data.ts` & `profile-switcher.tsx`: Checked `user?.isSovereign || user?.roles?.includes('ROLE_SYSTEM_ROOT')`.
- `apps/console/src/features/system/types/rbac-matrix-types.ts`: Updated `CANONICAL_PERMISSION_ATOMS` to 39 atoms across 7 planes.
- `apps/console/src/features/settings/profile/api/use-user-profile.ts`: Created `useUserProfileQuery` and `useUpdateUserProfileMutation`.
- `apps/console/src/features/settings/profile/profile-form.tsx`: Connected profile form to `/api/v1/user/profile` API.

## Verification
- **Backend Compilation**: `pnpm --filter @acc/backend check-types` (`mvn test-compile -DskipTests`) passed across all 9 modules with exit code 0.
- **Backend Tests**: `JwtTokenHelperTest` and `SystemFleetServiceTest` (15 tests) passed with exit code 0.
- **Sandbox Tests**: `pnpm --filter @acc/sandbox test` passed all 11 test suites (103 tests passed).
- **Console Unit Tests**:
  - `use-spring-auth-store.test.ts` (5 tests) passed.
  - `use-has-permission.test.ts` (5 tests) passed.
  - `profile-switcher.test.tsx` (7 tests) passed.
  - `sign-out-dialog.test.tsx` (2 tests) passed.
  - `record-audit-history-drawer.test.tsx` (3 tests) passed.
  - `protected-route.test.tsx` (5 tests) passed.
  - `api-client-context.test.ts` (3 tests) passed.
  - `use-user-profile.test.tsx` (2 tests) passed.
- **Formal End-to-End Verification**: `bun test autogenerated-tests/canonical_authorization_and_user_profile.test.ts` passed 3/3 tests with 49 assertions.

## Walkthrough
1. **Login Flow**:
   User submits credentials to `POST /api/auth/token`. Backend issues signed JWT. Client receives opaque tokens and calls `setTokens(access, refresh)`.
2. **Session Hydration**:
   Client calls `GET /api/auth/me`. Backend resolves `AuthenticationProfile` (user ID, tenant, sovereign status, canonical roles, and atomic permissions). Client store sets `user` without decoding JWT.
3. **Action Gating**:
   UI calls `useHasPermission('entity:record:create')`. Hook directly checks `user.permissions.includes(...)` with fallback to canonical roles.
4. **User Profile**:
   User navigates to `/settings/profile`. `useUserProfileQuery` calls `GET /api/v1/user/profile`. User edits name, contact, and language/bio preferences and submits. `useUpdateUserProfileMutation` calls `PUT /api/v1/user/profile` and updates cache.

## Tasks
- [x] Canonical permissions and roles catalog definition
- [x] Backend endpoint `GET /api/auth/me` with `AuthenticationProfileDto`
- [x] Backend endpoints `GET` and `PUT` `/api/v1/user/profile` with `UserProfileDto`
- [x] Removal of legacy `METADATA_*` SpEL expressions across controllers
- [x] Elimination of client-side JWT decoding
- [x] Migration of console store to `AuthenticationProfile` and deletion of `useAuthStore`
- [x] React Query hooks for user profile
- [x] Unified sandbox alignment and test suite passes
- [x] Automated formal tests in `autogenerated-tests/`

## Enhancement
Future iterations can layer:
- Role delegation TTL expiration alarms via SSE/WebSocket.
- Fine-grained attribute-level permission masking (e.g. `entity:record:read:salary`) driven by dynamic metadata schemas.
