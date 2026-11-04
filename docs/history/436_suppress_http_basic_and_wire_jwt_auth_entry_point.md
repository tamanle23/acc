# History Entry 436: Suppress Native HTTP Basic Auth Dialog and Wire Dedicated JWT Authentication Entry Point

## Context & Problem
During login in `@acc/console`, upon calling `GET /api/auth/me`, a native browser HTTP Basic Authentication popup dialog appeared (`WWW-Authenticate: Basic realm="..."`). When dismissed or cancelled by the user, the request failed with `401 Unauthorized` and triggered a silent refresh loop that failed with `401 Unauthorized`.

Root Causes Identified:
1. `SecurityConfiguration.java` explicitly invoked `.httpBasic(hb -> {})` on the secured filter chain, registering `BasicAuthenticationFilter` and `BasicAuthenticationEntryPoint` by default. Any unauthenticated access to secured routes emitted a `WWW-Authenticate: Basic` header that browsers trap with a native login modal.
2. `JwtAuthenticationEntryPoint` existed in `com.acc.fw.core.jwt` but was never registered in the `SecurityFilterChain` exception handling block. Additionally, it previously used `httpServletResponse.sendError(SC_UNAUTHORIZED, ...)` which could initiate servlet-level error dispatches.
3. CORS configuration (`corsConfigurationSource()`) was previously only registered in the `nonsecured` profile block and missing from the secured filter chain.
4. In Console (`user-auth-form.tsx`), `fetchAuthenticationProfile()` was invoked immediately after `setTokens(...)` without passing the explicit Bearer token, causing potential race conditions with asynchronous store updates.

## Changes Made
1. **Backend (`apps/backend/acc-fw`)**:
   - `SecurityConfiguration.java`:
     - Injected `JwtAuthenticationEntryPoint`.
     - Explicitly disabled HTTP Basic authentication: `.httpBasic(hb -> hb.disable())`.
     - Added `.cors(cors -> cors.configurationSource(corsConfigurationSource()))` to the secured filter chain.
     - Registered `.exceptionHandling(eh -> eh.authenticationEntryPoint(jwtAuthenticationEntryPoint))`.
   - `JwtAuthenticationEntryPoint.java`:
     - Replaced `sendError` with direct JSON response writing: sets HTTP status 401, `Content-Type: application/json;charset=UTF-8`, and writes payload `{"status":401,"error":"Unauthorized","message":"..."}`, suppressing any `WWW-Authenticate` basic challenge.
2. **Frontend Console (`apps/console`)**:
   - `api-client.ts`:
     - Updated `fetchAuthenticationProfile(explicitToken?: string)` to accept an explicit token and attach it directly to the `Authorization` header.
   - `user-auth-form.tsx`:
     - Passed `accessToken` directly to `fetchAuthenticationProfile(accessToken)`.

## Verification
- Backend unit tests (`TokenServiceImplTest,UserProfileControllerTest,JwtTokenHelperTest,UserDetailsImplTest`): PASSED (Exit code 0).
- Module re-compilation (`acc-ms-aio`): PASSED (Exit code 0).
- Console Vitest tests (`src/features/spring-auth/`, `src/features/auth/`): PASSED (8 test files, 31 tests passed).
- Console TypeScript check (`tsc --noEmit`): PASSED (0 errors).
