# 433: Fix UserProfileController Bytecode Corruption and Authentication Principal Resolution

## Problem
During backend startup (`@acc/backend:dev:sandbox`), Spring container initialization failed with:
```
org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'userProfileController': Resolution of declared constructors on bean Class [com.acc.presentation.UserProfileController] from ClassLoader failed
Caused by: java.lang.NoClassDefFoundError: ResponseEntityBuilder
```

Two underlying root causes were identified:
1. **Corrupted Bytecode Stub from Stale IDE Language Server Compilation**:
   - Disassembly (`javap`) of `UserProfileController.class` revealed:
     `Unresolved compilation problem: ResponseEntityBuilder cannot be resolved to a type` and constructor descriptor `(com.acc.user.service.UserProfileService, ResponseEntityBuilder);` lacking the package qualifier `com.acc.fw.`.
   - The Eclipse/VSCode background compiler had generated an ECJ error stub when the file was initially created during incremental indexing prior to full module compilation.
   - Subsequent Maven incremental compilations saw that `target/classes/.../UserProfileController.class` already existed with an up-to-date timestamp and skipped recompiling it (`Nothing to compile - all classes are up to date.`), leaving the broken class file in the build output.
2. **AuthenticationPrincipal Type Mismatch in UserProfileController**:
   - `UserProfileController` methods (`getProfile`, `updateProfile`) used `@AuthenticationPrincipal UserDetailsImpl userDetails`.
   - Since JWT authentication populates `SecurityContext` with `JwtAuthenticationToken` whose principal is a `java.lang.String` (`username`), `@AuthenticationPrincipal UserDetailsImpl` resolved to `null`, causing the username to fall back to `"anonymous"` rather than the authenticated caller's identity.

## Plan
1. **Controller Modernization**:
   - Update `UserProfileController.java` to accept Spring's `Authentication` object directly and extract the username safely via `resolveUsername(Authentication authentication)` supporting both `UserDetails` and string principals.
2. **Purge Corrupted Class Bytecode & Full Clean Recompile**:
   - Perform a clean compile across `acc-core` and `acc-fw` using Maven javac (`mvn clean compile -am -pl acc-fw`).
   - Disassemble `UserProfileController.class` to confirm the constructor accurately resolves to `(com.acc.user.service.UserProfileService, com.acc.fw.ResponseEntityBuilder)`.
3. **Formal Unit Testing**:
   - Create `UserProfileControllerTest.java` in `apps/backend/acc-fw/src/test/java/com/acc/presentation/` verifying constructor instantiation, `getProfile` with standard authentication and UserDetails, and `updateProfile`.
   - Verify all tests pass with Maven 3.9.9.

## Changes
### Backend (`apps/backend/acc-fw`)
- `UserProfileController.java`:
  - Replaced `@AuthenticationPrincipal UserDetailsImpl userDetails` with `Authentication authentication`.
  - Added private `resolveUsername(Authentication authentication)` supporting both `UserDetails` and principal string names, with graceful fallback.
- `UserProfileControllerTest.java`:
  - Added unit tests for `getProfile` (both standard token principal and `UserDetails` principal) and `updateProfile` with mocked `UserProfileService` and `ResponseEntityBuilder`.

## Verification
- Clean Maven Compile:
  - `mvn clean compile -am -pl acc-fw` passed (Reactor build order: `acc`, `acc-core`, `acc-fw` all `SUCCESS`).
- Bytecode Verification:
  - `javap -cp "apps/backend/acc-fw/target/classes" com.acc.presentation.UserProfileController` verified constructor signature:
    `public com.acc.presentation.UserProfileController(com.acc.user.service.UserProfileService, com.acc.fw.ResponseEntityBuilder);`
- Test Execution:
  - `mvn test -pl acc-fw "-Dtest=UserProfileControllerTest,JwtTokenHelperTest,UserDetailsImplTest" -q` passed with 0 failures (10/10 tests passed).
- Reactor Module Verification:
  - `mvn compile -am -pl acc-ms-aio` passed across all 9 backend modules.

## Walkthrough
1. **Startup / Instantiation**:
   - Spring IoC container instantiates `UserProfileController` injecting `UserProfileService` and `com.acc.fw.ResponseEntityBuilder` without `NoClassDefFoundError`.
2. **Authenticated Retrieval / Mutation**:
   - Calls to `GET /api/v1/user/profile` and `PUT /api/v1/user/profile` accept the caller's JWT `Authentication` token, resolve the caller's username, and delegate directly to `UserProfileService`.

## Tasks
- [x] Diagnose `NoClassDefFoundError: ResponseEntityBuilder` on `UserProfileController`.
- [x] Clean compile `acc-core` and `acc-fw` to replace stale ECJ class placeholder.
- [x] Update `UserProfileController` to use `Authentication` parameter injection and safe username resolution.
- [x] Create and run `UserProfileControllerTest`.
- [x] Verify multi-module build for `acc-ms-aio`.
- [x] Register archive in `docs/history/`.

## Enhancement
- Consider adding an automated CI check that fails the build if any generated `.class` files contain `java/lang/Error` or `Unresolved compilation problem` strings to prevent IDE error stubs from leaking into target directories.
