# Console Implementation Plan - Iteration 163
# Clean Authorization, AuthenticationProfile & User Profile Integration for @acc/console

## 1. Executive Summary & Scope
This plan details frontend updates for `@acc/console` to establish the refined enterprise authorization and user profile architecture:
1. **Opaque Token & Strongly-Typed `AuthenticationProfile`**: Eliminate client-side JWT decoding (`atob`). Consume `GET /api/auth/me` to hydrate a strongly-typed `AuthenticationProfile` (`roles`, `permissions`, `tenantId`, `activeFeatures`).
2. **Dedicated User Profile Management**: Wire `apps/console/src/features/settings/profile/profile-form.tsx` to `GET` and `PUT /api/v1/user/profile` via TanStack Query.
3. **Consolidate on `useSpringAuthStore`**: Completely purge the legacy `useAuthStore` and route all permission and role evaluation through `useSpringAuthStore`.
4. **Canonical Permission Atoms**: Synchronize all UI gates (`entity-data-grid`, `schema-builder`, `dlq`, `sidebar`) with the canonical `<plane>:<resource>:<action>` taxonomy (Quorum removed).
5. **Unified Sandbox Parity**: Update `@acc/sandbox` to serve the identical `AuthenticationProfile` and `UserProfileDto` contracts offline.

---

## 2. Phased Roadmap (Mirrored 1:1 with Master Plan)

### Phase 1: Shared Canonical Contracts (`packages/client`)
- In `packages/client/src/contracts/auth.ts` & `users.ts`:
  - Define `AuthenticationProfile` and `CanonicalRole`.
  - Define `UserProfileDto`, `UserPreferences`, and `UpdateUserProfileRequest`.
  - Remove client reliance on `JwtPayload`.
  - Export canonical permission atom string unions.

### Phase 2: Backend Session & Profile APIs (Frontend Integration)
- In `apps/console/src/features/spring-auth/api-client.ts`:
  - Add `fetchAuthenticationProfile()` calling `GET /api/auth/me`.
- In `apps/console/src/features/settings/profile/api/use-user-profile.ts`:
  - Add `useUserProfileQuery()` calling `GET /api/v1/user/profile`.
  - Add `useUpdateUserProfileMutation()` calling `PUT /api/v1/user/profile`.

### Phase 3: Backend Controller Normalization (Contract Parity)
- Verify API payloads in `apps/console/src/features/system/api/use-system-fleet.ts` match backend `RoleWithPermissionsDto` with canonical permission atoms (Quorum roles removed).

### Phase 4: Console Session Hydration & User Profile Integration
- In `apps/console/src/features/spring-auth/store.ts`:
  - Store `session: AuthenticationProfile | null` in `useSpringAuthStore`.
  - Deprecate client-side JWT decoding in `utils/jwt.ts`.
- In `apps/console/src/features/system/hooks/use-has-permission.ts`:
  - Read `session` directly from `useSpringAuthStore`.
  - Evaluate `Boolean(session?.permissions?.includes(permissionCode))` (or active sandbox persona in dev mode).
- Delete `apps/console/src/stores/auth-store.ts`.
- Refactor legacy callers (`data-privacy-panel.tsx`, `record-audit-history-drawer.tsx`, `sign-out-dialog.tsx`) to `useSpringAuthStore`.
- Update `apps/console/src/components/layout/data/sidebar-data.ts` to derive sovereign visibility from `usePermissions()`.
- Wire `apps/console/src/features/settings/profile/profile-form.tsx` to `useUserProfileQuery` and `useUpdateUserProfileMutation`.

### Phase 5: Unified Sandbox Platform Alignment
- In `packages/sandbox/src/handlers/auth-sandbox-handler.ts`:
  - Add `/auth/me` route handler returning canonical `AuthenticationProfile` for active persona.
  - Add `/user/profile` route handler returning mock `UserProfileDto`.
  - Align mock credentials with canonical roles (`ROLE_SYSTEM_ROOT`, `ROLE_WORKSPACE_OWNER`, etc.).

### Phase 6: Verification & Zero-Regression Testing
- Update `use-has-permission.test.ts` to verify production mode against `useSpringAuthStore.getState().session`.
- Verify all console tests pass: `pnpm --filter @acc/console test`.
