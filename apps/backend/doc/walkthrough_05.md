# Walkthrough - Implement Refresh Token Support in JWT Authentication

Added full refresh token support to the backend JWT authentication framework (`acc-fw` and `acc-ms-identity`), allowing clients to receive refresh tokens on login and refresh expired access tokens.

## Changes Made

### Core Framework (`apps/backend/acc-fw`)

#### [JwtTokenHelper.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/fw/core/jwt/JwtTokenHelper.java)
- Defined `CLAIM_KEY_TYPE` and `TOKEN_TYPE_REFRESH`.
- Updated `generateRefreshToken` to generate 30-day signed refresh tokens containing user subject (`sub`), audience, and refresh type.
- Updated `getAuthenticationToken(claims)` to automatically generate and include `refreshToken` in the returned `AuthenticationToken`.
- Enhanced `getClaims(token)` to catch `ExpiredJwtException` and extract claims safely for token inspection.
- Fixed `isTokenExpired` to validate expiration dates accurately for both access tokens and long-lived refresh tokens.
- Added default fallback value of `2592000000` (30 days) to `@Value("${application.security.jwtRefreshTokenExpiration:2592000000}")`.

#### [JwtTokenHelperTest.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/test/java/com/acc/fw/core/jwt/JwtTokenHelperTest.java)
- Added unit tests for verifying refresh token generation and refresh token validation.

---

### Identity Microservice (`apps/backend/acc-ms-identity`)

#### [TokenRefreshValidator.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/controller/validator/TokenRefreshValidator.java)
- Implemented `TokenRefreshValidator` to validate request payloads on the token refresh endpoint.

#### [ValidatorConfiguration.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/ValidatorConfiguration.java)
- Registered `TOKEN_REFRESH` bean (`tokenRefreshValidator`).

#### [TokenServiceImpl.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/service/TokenServiceImpl.java)
- Updated `refreshToken` implementation to parse the refresh token, validate claims and expiration, reload user details, and return a fresh `AuthenticationToken` pair.

---

## Verification Results

### Automated Tests
- Executed `mvnw.cmd test` for all backend modules (`acc-fw`, `acc-ms-identity`, `acc-ms-aio`).
- Build status: **BUILD SUCCESS** (0 failures, 0 errors across all 10 reactor modules).
