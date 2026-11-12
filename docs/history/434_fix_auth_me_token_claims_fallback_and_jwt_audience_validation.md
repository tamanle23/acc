# 434: Fix /api/auth/me Token Claims Fallback and JWT Audience Validation

## Problem
After logging into the console, `GET /api/auth/me` still failed with `401 Unauthorized` in the browser client:
```
api-client.ts:140 GET http://localhost:5173/api/auth/me 401 (Unauthorized)
api-client.ts:121 GET http://localhost:5173/api/auth/me 401 (Unauthorized)
user-auth-form.tsx:90 Failed to hydrate authentication profile: AxiosError: Request failed with status code 401
```

Two critical defects were discovered:
1. **Database Lookup Failure for Non-Database / Sandbox Personas**:
   - `TokenServiceImpl.getAuthenticationProfile(Authentication authentication)` attempted to resolve `UserDetailsImpl` via `userDetailsService.loadUserByUsername(authentication.getName())`.
   - Sandbox personas (`admin@acc.io`, `custodian_root`, `creator@acc.io`, etc.) are synthesized dynamically by `SandboxTokenAspect` and do NOT exist in the PostgreSQL `USER` table.
   - Consequently, `loadUserByUsername` threw a `UsernameNotFoundException`. Because `TokenServiceImpl` lacked a fallback to the verified `JwtAuthenticationToken` credentials, it threw `BusinessException` with `HttpStatus.UNAUTHORIZED (401)`.
2. **Brittle User-Agent to Audience Equality Check**:
   - `JwtTokenHelper.validate(Claims claims, String userAgent)` evaluated `StringUtils.equals(audience, userAgent)`.
   - `SandboxTokenAspect` minted tokens setting `aud = "web"` (or `clientType`), while real browser clients sent standard HTTP user-agent headers (`Mozilla/5.0 ...`).
   - Comparing client device class (`"web"`) with browser `User-Agent` (`"Mozilla/5.0..."`) caused `validate` to return `false`, rejecting valid browser sessions with 401.
3. **Sovereign Profile Field Alignment in Client**:
   - `AuthenticationProfileDto` serializes `private boolean sovereign` as `sovereign`, whereas `@acc/client` contract specifies `isSovereign: boolean`.

## Plan
1. **Resilient Token Fallback in TokenServiceImpl**:
   - In `TokenServiceImpl.getAuthenticationProfile(Authentication authentication)`, if `userDetailsService.loadUserByUsername` does not find the user in the database, extract the authenticated claims directly from `JwtAuthenticationToken`:
     - `userId`: from `claims.userDetails.uid` (or fallback to username).
     - `username`: from `authentication.getName()`.
     - `tenantId`: from `jwtAuth.getTenantId()`, `TenantContextHolder`, or `"SYSTEM"`.
     - `roles`: from `authentication.getAuthorities()` filtering for `"ROLE_"`.
     - `permissions`: from `authentication.getAuthorities()` filtering non-role authorities.
     - `sovereign`: evaluated from roles and tenant ID.
   - Return 200 OK with `ResponseWrapper<ContextHeader, AuthenticationProfileDto>` without throwing 401 for validly authenticated callers.
2. **Remove False-Positive Audience Check in JwtTokenHelper**:
   - Streamline `validate(Claims claims, String userAgent)` to verify token expiration and subject presence rather than rejecting on `aud` vs `User-Agent` mismatch.
3. **Client Field Alignment**:
   - In `apps/console/src/features/spring-auth/api-client.ts`, handle both `raw.isSovereign` and `raw.sovereign` to guarantee full type safety and contract adherence.
4. **Formal Testing & Verification**:
   - Create `TokenServiceImplTest.java` verifying token claim fallback and sovereign detection when the database lookup throws `UsernameNotFoundException`.
   - Run Vitest suite and Maven tests.

## Changes
### Backend (`apps/api/acc-fw`)
- `JwtTokenHelper.java`:
  - Removed brittle `aud == userAgent` equality check from `validate`.
- `TokenServiceImpl.java`:
  - Added direct token claims fallback in `getAuthenticationProfile(Authentication authentication)` when database lookup fails.
- `TokenServiceImplTest.java`:
  - Added unit test suite verifying claim extraction for non-database sandbox personas and sovereign status detection.

### Frontend (`apps/console`)
- `apps/console/src/features/spring-auth/api-client.ts`:
  - Mapped `isSovereign: raw.isSovereign ?? raw.sovereign ?? false` in `fetchAuthenticationProfile`.

## Verification
- Backend Unit Tests:
  - `mvn test -am -pl acc-fw "-Dtest=TokenServiceImplTest,UserProfileControllerTest,JwtTokenHelperTest,UserDetailsImplTest" "-Dsurefire.failIfNoSpecifiedTests=false" -q` (All 12 tests passed).
- Backend Module Compilation:
  - `mvn compile -am -pl acc-ms-aio` passed across all 9 backend modules.
- Frontend Vitest Suite:
  - `pnpm --filter @acc/console test src/features/spring-auth/ src/features/auth/ --reporter=basic` (All 8 test files, 31 tests passed).
- Frontend Typecheck:
  - `pnpm --filter @acc/console exec tsc --noEmit` (0 errors).

## Walkthrough
1. **User Authentication**:
   - Client sends credentials (`admin@acc.io`, `password`) to `POST /api/auth/token`.
   - `SandboxTokenAspect` or authentication manager generates valid JWT tokens.
2. **Session Hydration (`/api/auth/me`)**:
   - Client calls `GET /api/auth/me` with `Authorization: Bearer <accessToken>`.
   - `JwtAuthenticationTokenFilter` validates the JWT and registers the security context.
   - `AuthenticationController.me` calls `tokenService.getAuthenticationProfile(authentication)`.
   - `TokenServiceImpl` attempts DB user lookup; when not found (sandbox/federated), it seamlessly falls back to token claims, returning the complete `AuthenticationProfileDto`.
   - `api-client.ts` receives 200 OK, normalizes `isSovereign`, and hydrates `useSpringAuthStore`.
   - User successfully logs in and is navigated to dashboard without route bounce or 401 errors.

## Tasks
- [x] Identify root cause of `/api/auth/me` failure (missing DB record for sandbox personas & User-Agent audience check).
- [x] Implement token claims fallback in `TokenServiceImpl.getAuthenticationProfile`.
- [x] Streamline JWT validation in `JwtTokenHelper.validate`.
- [x] Align `isSovereign` mapping in `api-client.ts`.
- [x] Create `TokenServiceImplTest` and execute test suite.
- [x] Verify multi-module build for `acc-ms-aio`.
- [x] Register archive in `docs/history/`.

## Enhancement
- Provide automated DB sync for federated/sandbox users if local relational foreign keys require physical `USER.ID` records.
