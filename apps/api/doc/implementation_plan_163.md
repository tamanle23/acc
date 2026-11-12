# Backend Implementation Plan - Iteration 163
# Clean Authorization Architecture, AuthenticationProfile & User Profile API for @acc/api

## 1. Executive Summary & Scope
This plan details backend updates for `@acc/api` (Spring Modulith) to establish an enterprise-grade authorization and profile architecture:
1. **Purge Legacy Constants & Aliases**: Remove `METADATA_RECORD_READ`, `METADATA_SCHEMA_WRITE`, `metadata:record:read`, and all legacy SpEL expressions. Adopt canonical `<plane>:<resource>:<action>` atoms across all controllers.
2. **Strict Role vs. Permission Separation in Spring Security**:
   - Roles represent identity groups (`ROLE_SYSTEM_ROOT`, `ROLE_WORKSPACE_OWNER`, etc.).
   - Permissions represent functional capabilities (`entity:record:read`, `platform:fleet:read`).
   - Controllers check permissions only: `@PreAuthorize("hasAuthority('entity:record:read')")`.
3. **Session & Profile Endpoints**:
   - `GET /api/auth/me`: Returns strongly-typed `AuthenticationProfileDto` containing resolved roles, permissions, and tenant context.
   - `GET /api/v1/user/profile` & `PUT /api/v1/user/profile`: Self-service profile management with core columns and JSON preferences.
4. **Remove Quorum Governance**:
   - Purge `ROLE_SYSTEM_VERIFIER` and `ROLE_SYSTEM_APPROVER`.
   - Clean up `SystemFleetService.java`.

---

## 2. Phased Roadmap (Mirrored 1:1 with Master Plan)

### Phase 1: Shared Canonical Contracts (`acc-core`)
- Create `CanonicalPermissions.java` in `com.acc.core.constant` with constant definitions for all 7 planes.
- Create `CanonicalRoles.java` in `com.acc.core.constant`.
- Create `AuthenticationProfileDto.java` and `UserProfileDto.java` in `com.acc.system.dto`.

### Phase 2: Backend Session & Profile APIs
- In `AuthenticationController.java`:
  - Add `GET /api/auth/me` returning `AuthenticationProfileDto`.
  - Include optional `user` profile in `token` login response.
- In `UserProfileController.java`:
  - Add `GET /api/v1/user/profile` and `PUT /api/v1/user/profile`.
  - Add `UserProfileService` to read and update `User` entity and preferences map.
- In `UserDetailsServiceImpl.java`:
  - Map DB roles to `SimpleGrantedAuthority("ROLE_" + role.getCode().toUpperCase())`.
  - Map role permissions to lowercase `SimpleGrantedAuthority(permCode.toLowerCase())`.

### Phase 3: Backend Controller Normalization (Clean Canonical Atoms)
- In `CompositeEntityController.java`:
  - Replace `METADATA_RECORD_READ` with `@PreAuthorize("hasAuthority('entity:record:read')")`.
- In `MetadataController.java`:
  - Replace `METADATA_SCHEMA_READ` with `@PreAuthorize("hasAuthority('metadata:schema:read')")`.
  - Replace `METADATA_SCHEMA_WRITE` with `@PreAuthorize("hasAuthority('metadata:schema:write')")`.
  - Replace record checks with `entity:record:read`, `entity:record:create`.
- In `WorkspaceController.java`:
  - Update `@PreAuthorize` to `@PreAuthorize("hasAuthority('workspace:settings:manage')")`.
- In `SystemFleetService.java`:
  - Align `seedDefaultRbacRoles()` to seed the canonical permission atoms without Quorum roles.

### Phase 4: Console Session Hydration & User Profile Integration
- Ensure backend API contracts match Console expectations.

### Phase 5: Unified Sandbox Platform Alignment
- Synchronize seed fixtures with `@acc/sandbox`.

### Phase 6: Verification & Zero-Regression Testing
- Add `AuthenticationControllerSessionTest.java` verifying `/api/auth/me`.
- Add `UserProfileControllerTest.java` verifying `/api/v1/user/profile`.
- Add `SecurityAuthorizationTest.java` verifying controller `@PreAuthorize` gates against canonical atoms.
- Run tests: `./mvnw test -q -Dtest="AuthenticationControllerTest,UserProfileControllerTest,CompositeEntityControllerTest,SystemFleetControllerTest"`.
