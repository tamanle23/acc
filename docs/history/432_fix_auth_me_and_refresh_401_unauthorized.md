# 432: Fix /api/auth/me and /api/auth/refresh 401 Unauthorized Post-Login

## Problem
Following successful authentication (`POST /api/auth/token`), the frontend console encountered two persistent 401 Unauthorized errors:
1. `GET /api/auth/me` failed with `401 Unauthorized`:
   - Spring MVC controller `AuthenticationController.me(@AuthenticationPrincipal UserDetailsImpl userDetails)` expected `@AuthenticationPrincipal` to resolve to `UserDetailsImpl`.
   - In `JwtAuthenticationTokenFilter`, the `SecurityContext` is populated with `JwtAuthenticationToken(username, claims, authorities, tenantId)`, where the principal is `username` (`java.lang.String`), not `UserDetailsImpl`.
   - Consequently, `@AuthenticationPrincipal UserDetailsImpl` silently resolved to `null`.
   - `TokenServiceImpl.getAuthenticationProfile(UserDetailsImpl userDetails)` checked `if (userDetails == null)` and threw `BusinessException` with HTTP 401 Unauthorized.
   - Furthermore, initial token issuance (`jwtTokenHelper.generateToken`) checked `TenantContextHolder.getTenantId()`, which was empty during initial unauthenticated login requests. The JWT was emitted without a `tid` (`CLAIM_KEY_TENANT_ID`). In `JwtAuthenticationTokenFilter`, tokens lacking a non-empty `tid` were rejected immediately as unauthorized.
2. `POST /api/auth/refresh` triggered and failed with `401 Unauthorized`:
   - When `/api/auth/me` failed with 401, Axios interceptor in `apps/console/src/features/spring-auth/api-client.ts` caught the 401 and initiated a silent refresh.
   - The Axios request interceptor automatically attached the rejected/failing `Authorization: Bearer <accessToken>` header to the `/auth/refresh` request.
   - `JwtAuthenticationTokenFilter` intercepted `/api/auth/refresh`, attempted token authentication using the invalid access token, and rejected the request with 401 before the refresh endpoint could run.
   - `/api/auth/refresh` was missing from `application.security.permitAlls` in `SecurityConfiguration` and `application-local.yml`.
   - The client refresh interceptor extracted `data.accessToken` rather than unwrapping Spring's `ResponseWrapper.body` (`data?.body?.accessToken`).

## Plan
1. **Backend Authentication & Profile Resolution**:
   - Update `AuthenticationController.me(Authentication authentication)` to accept standard Spring `Authentication`.
   - Overload `TokenService.getAuthenticationProfile(Authentication authentication)` to dynamically resolve the user via `userDetailsService.loadUserByUsername(authentication.getName())` and fall back gracefully on tenant ID (`TenantContextHolder`, `UserDetailsImpl`, or `"SYSTEM"`).
   - In `UserDetailsImpl`, expose tenant ID getter (`getTenantId()`) from backing map.
   - In `UserDetailsServiceImpl`, seed tenant ID into `UserDetailsImpl` (from `userRoles` or defaulting to `"SYSTEM"`).
   - In `JwtTokenHelper.generateToken`, fallback to `udi.getTenantId()` and default to `"SYSTEM"` if `TenantContextHolder` is empty. Stamp both `CLAIM_KEY_TENANT_ID` (`tid`) and `"tenantId"`.
   - In `JwtAuthenticationTokenFilter`, bypass execution for token endpoints (`/api/auth/token`, `/auth/token`, `/api/auth/refresh`, `/auth/refresh`) and provide sovereign role fallback for tenant resolution.
   - In `SecurityConfiguration.java` and `application-local.yml`, permit `/api/auth/refresh`.
2. **Console Refresh & Interceptor Resilience**:
   - In `apps/console/src/features/spring-auth/api-client.ts`, ensure `/auth/refresh` requests omit the `Authorization` header so expired/invalid access tokens do not poison the refresh operation.
   - Support unwrapping `ResponseWrapper` structures in refresh response (`data?.body?.accessToken || data?.accessToken`).
3. **Verification**:
   - Add unit tests in `JwtTokenHelperTest` verifying tenant ID claims generation and extraction.
   - Verify Vitest auth and spring-auth test suites in `@acc/console`.
   - Run type checks and backend unit tests.

## Changes
### Backend (`apps/backend/acc-fw`, `apps/backend/acc-ms-aio`)
- `UserDetailsImpl.java`: Added `getTenantId()` getter.
- `UserDetailsServiceImpl.java`: Populate `"tenantId"` in `userMap` during user details assembly.
- `JwtTokenHelper.java`:
  - Updated `generateToken` to extract tenant ID from `UserDetailsImpl` and default to `"SYSTEM"` if context is unseeded.
  - Stamped both `CLAIM_KEY_TENANT_ID` and `"tenantId"`.
  - Added claim-safe fallback in `getTenantId(Claims claims)`.
  - Loosened audience validation in `validate` to avoid false-positive rejections when either claim or header is empty.
- `JwtAuthenticationTokenFilter.java`:
  - Added filter bypass in `doFilterInternal` for `/api/auth/token` and `/api/auth/refresh` (and short forms).
  - Added sovereign role fallback in `attemptAuthentication` for missing tenant IDs.
- `SecurityConfiguration.java`: Added `/api/auth/refresh` and `/api/auth/token` to permitAll request matchers.
- `application-local.yml`: Added `/api/auth/refresh` to `application.security.permitAlls`.
- `TokenService.java` & `TokenServiceImpl.java`: Added overloaded `getAuthenticationProfile(Authentication authentication)` with multi-tier tenant resolution and userDetailsService lookup.
- `AuthenticationController.java`: Updated `me(Authentication authentication)` endpoint signature to pass authentication directly.
- `JwtTokenHelperTest.java`: Added tests `testGenerateTokenPreservesTenantId` and `testGenerateTokenDefaultsToSystemTenantWhenMissing`.

### Frontend (`apps/console`)
- `apps/console/src/features/spring-auth/api-client.ts`:
  - Strip `Authorization` header when request URL includes `/auth/refresh`.
  - Handle unwrapped and wrapped `ResponseWrapper` bodies in refresh response handler.
- `apps/console/src/features/spring-auth/__tests__/api-client-context.test.ts`:
  - Added test verifying `/auth/refresh` requests never include the `Authorization` header.

## Verification
- Backend Unit Tests:
  - `mvn -f apps/backend/pom.xml test -pl acc-fw "-Dtest=JwtTokenHelperTest,UserDetailsImplTest" -q` (All 7 unit tests passed with 0 errors).
- Console Unit Tests:
  - `pnpm --filter @acc/console test src/features/spring-auth/ src/features/auth/ --reporter=basic` (All 8 test files, 31 tests passed).
- TypeScript Typecheck:
  - `pnpm --filter @acc/console exec tsc --noEmit` (0 errors).

## Walkthrough
1. **User Authentication Flow**:
   - `POST /api/auth/token` returns access & refresh tokens containing `tid: "SYSTEM"` (or assigned tenant).
2. **Session Hydration**:
   - Console invokes `GET /api/auth/me` with `Authorization: Bearer <accessToken>`.
   - `JwtAuthenticationTokenFilter` authenticates token, sets `SecurityContext`.
   - `AuthenticationController.me(Authentication authentication)` loads user details and returns 200 OK with `AuthenticationProfileDto`.
3. **Silent Token Refresh**:
   - If token expires, Axios interceptor calls `POST /api/auth/refresh` without `Authorization` header.
   - `JwtAuthenticationTokenFilter` bypasses refresh request.
   - `AuthenticationController.refresh` validates refresh token and returns new tokens in `ResponseWrapper`.
   - Client interceptor unwraps `data?.body?.accessToken`, replays pending requests seamlessly.

## Tasks
- [x] Diagnose root cause of `/api/auth/me` 401 Unauthorized.
- [x] Diagnose root cause of `/api/auth/refresh` 401 Unauthorized.
- [x] Update Spring controller, token service, user details, and JWT token helper.
- [x] Exempt `/api/auth/refresh` from JWT filter authentication and permit all.
- [x] Update Axios client interceptor to strip `Authorization` header on refresh requests.
- [x] Verify backend tests via Maven 3.9.9 and frontend tests via Vitest.
- [x] Register archive in `docs/history/`.

## Enhancement
- In future iterations, add WebAuthn passkey refresh rotation and dynamic tenant switching with re-signed JWT tokens.
