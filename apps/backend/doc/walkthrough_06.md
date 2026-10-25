# UserGraphqlController — Walkthrough

**Date:** 2026-09-22  
**Scope:** `acc-ms-identity` module

## Changes Made

### 1. `users.graphqls` — GraphQL Schema
**File:** `acc-ms-identity/src/main/resources/graphql/users.graphqls`

- Defined `extend type Query` with 6 operations mirroring all `UserQueryController` read endpoints
- Two input types: `UserSearchInput` (userName, userTypes, page, size) and `PageInput` (page, size)
- Two enums matching exact Java domain model values:
  - `UserType`: ANONYMOUS, REGISTERED, SUPER, ADMIN
  - `UserStatus`: ENABLED, DISABLED
- Output types: `UserVm`, `UserPage`, `UserProfileVm`, `PermissionVm`, `UserPermissionVm`, `RoleVm`, `UserRoleVm`, `RolePage`, `PermissionPage`

### 2. `UserGraphqlController.java` — Controller
**File:** `acc-ms-identity/src/main/java/com/acc/user/controller/graphql/UserGraphqlController.java`

- Extended `CommonController` (inherits `extractRequest`, `context`, logger)
- Injected `UserService<User>` and `UserMapper` via `@Autowired`
- Implemented 6 `@QueryMapping` methods:
  - `user(uid)` → `userMapper.userToResponseModel(userService.findByUid(uid))`
  - `users(request)` → `userService.findBy(...)` with pagination via `PageRequest`
  - `userPermissions(uid, request)` → `userService.findUserPermissions(...)`
  - `userRoles(uid, request)` → `userService.findUserRoles(...)`
  - `userProfile(uid)` → `userMapper.userProfileToResponseBody(userService.getUserProfile(uid))`
  - `userWithPermissions(uid)` → `userService.findUserWithPermissions(uid)`
- All methods guarded by `@PreAuthorize("hasPermission(ResourceConstants.USER, PermissionConstants.LIST)")`
- Private `toSearchCondition()` converts `UserSearchInput` record → `UserSearchCondition`
- Private `applyPagination()` builds a `PageRequest` (with `number` + `size` fields) when page/size are provided
- Two Java `record` types declared as inner classes: `UserSearchInput`, `PageInput`

### 3. `application.yml` — GraphQL Config
**File:** `acc-ms-identity/src/main/resources/application.yml`

Added:
```yaml
spring:
  graphql:
    path: /graphql
    graphiql:
      enabled: true
      path: /graphiql
    schema:
      locations: classpath:graphql/**/
      file-extensions: .graphqls
```

## GraphiQL Usage

After starting the service on port 8081, open: `http://localhost:8081/graphiql`

### Sample queries

```graphql
# Get user by UID
query {
  user(uid: "abc-123") {
    uid
    userName
    email
    status
    type
  }
}

# List users
query {
  users(request: { size: 20, page: 1 }) {
    content { uid userName email }
    totalElements
    totalPages
  }
}

# User roles
query {
  userRoles(uid: "abc-123", request: { page: 1, size: 10 }) {
    content { uid code description }
    totalElements
  }
}
```
