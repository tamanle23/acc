# Implement Refresh Token Support in JWT Authentication

Modify the backend's JWT authentication framework (`acc-fw` and `acc-ms-identity`) to generate, validate, and process refresh tokens when issuing and refreshing authentication tokens.

## User Review Required

> [!IMPORTANT]
> - `AuthenticationToken` returned upon login/token creation will now include a valid `refreshToken` string in addition to the access `token`.
> - The `/api/auth/refresh` endpoint will validate the provided `refreshToken` (handling expired access tokens gracefully) and issue a fresh access token and refresh token pair.

## Proposed Changes

### Core Framework Layer (`apps/backend/acc-fw`)

#### [MODIFY] [JwtTokenHelper.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/fw/core/jwt/JwtTokenHelper.java)
- Enhance `getClaims(String token)` to catch `ExpiredJwtException` and extract claims safely for expired access token inspection.
- Update `generateRefreshToken` to encode user subject (`sub`), audience (`audience`), and token type (`type: refresh`).
- Update `generateToken(UserDetailsImpl userDetails, String userAgent)` to automatically populate the `refreshToken` property in `AuthenticationToken`.
- Update `refreshToken(...)` to validate the refresh token and issue a new `AuthenticationToken` containing fresh access and refresh tokens.

---

### Identity Microservice Layer (`apps/backend/acc-ms-identity`)

#### [NEW] [TokenRefreshValidator.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/controller/validator/TokenRefreshValidator.java)
- Implement `TokenRefreshValidator` extending `AbstractValidator<AuthenticationToken>` to validate that the request body contains a non-empty refresh token.

#### [MODIFY] [ValidatorConfiguration.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/ValidatorConfiguration.java)
- Register the `@Bean(name = TOKEN_REFRESH)` for `TokenRefreshValidator`.

#### [MODIFY] [TokenServiceImpl.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/service/TokenServiceImpl.java)
- Update `refreshToken` method to validate the refresh token from `request.getBody()`, re-load user details if necessary, and return the new `AuthenticationToken`.

---

### Documentation & History

#### [NEW] [implementation_plan_02.md](file:///c:/Users/Admin/workspace/git/acc/apps/backend/doc/implementation_plan_02.md)
- Persist this implementation plan to the target app's `doc/` directory as `implementation_plan_02.md`.

## Verification Plan

### Automated Build & Test Verification
- Run Maven build and tests on `acc-fw` and `acc-ms-identity` using `./mvnw clean test` from `apps/backend`.
