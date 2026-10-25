# Implement Facade Pattern for View Model Mapping

The current implementation of `UserServiceImpl` and `RoleServiceImpl` directly handles the orchestration of View Models (`UserVm`, `RoleVm`, etc.) using `UserMapper` and `RoleMapper`. Additionally, MyBatis repositories are returning View Model classes directly (`UserPermissionVm`, `UserRoleVm`). This violates the separation of concerns by coupling the Service and Repository layers to the Presentation layer (View Models).

## Proposed Changes

We will introduce a Facade layer (`UserFacade` and `RoleFacade`) to handle View Model mapping and orchestration. The Service layer will be refactored to return DTOs or Domain models, and the MyBatis Repositories will be updated to return DTOs.

---

### DTO Layer
We will create DTOs to replace the View Models currently returned by MyBatis.

#### [NEW] UserPermissionDto.java
`apps/backend/acc-ms-identity/src/main/java/com/acc/user/dto/UserPermissionDto.java`

#### [NEW] UserRoleDto.java
`apps/backend/acc-ms-identity/src/main/java/com/acc/user/dto/UserRoleDto.java`

#### [NEW] RolePermissionDto.java
`apps/backend/acc-ms-identity/src/main/java/com/acc/user/dto/RolePermissionDto.java`

#### [NEW] RoleUserDto.java
`apps/backend/acc-ms-identity/src/main/java/com/acc/user/dto/RoleUserDto.java`

---

### Repository Layer
Update MyBatis mappers and interfaces to return the newly created DTOs instead of View Models.

#### [MODIFY] UserRepository.java
Change return types of `findAllUserPermissions` and `findAllUserRoles` to return DTOs.

#### [MODIFY] UserRepository.xml
Update `<resultMap>` definitions to map to DTOs instead of `UserPermissionVm` and `UserRoleVm`.

#### [MODIFY] RoleRepository.java
Change return types of `findAllRolePermissions` and `findAllRoleUsers` to return DTOs.

#### [MODIFY] RoleRepository.xml
Update `<resultMap>` definitions to map to DTOs instead of `RolePermissionVm` and `UserRoleVm`.

---

### Service Layer
Remove Mapper dependencies from Services and update them to return DTOs.

#### [MODIFY] UserService.java & UserServiceImpl.java
- Remove `findUserWithPermissions(String uid)` which returns `UserVm`.
- Remove `userMapper` dependency.
- Return DTOs instead of View Models for any permission/role lookup methods.

#### [MODIFY] RoleService.java & RoleServiceImpl.java
- Remove `getRoleDetail(String uid)` which returns `RoleVm`.
- Remove `roleMapper` dependency.
- Return DTOs instead of View Models for any permission/user lookup methods.

---

### Facade Layer (New)
Introduce Facades to orchestrate service calls and map the results to View Models.

#### [NEW] UserFacade.java & UserFacadeImpl.java
`apps/backend/acc-ms-identity/src/main/java/com/acc/user/facade/UserFacade.java`
- Inject `UserService` and `UserMapper`.
- Implement `findUserWithPermissions(String uid)` which calls `UserService` for the user, roles, and permissions (as DTOs), maps them, and returns `UserVm`.

#### [NEW] RoleFacade.java & RoleFacadeImpl.java
`apps/backend/acc-ms-identity/src/main/java/com/acc/user/facade/RoleFacade.java`
- Inject `RoleService` and `RoleMapper`.
- Implement `getRoleDetail(String uid)` which orchestrates service calls and returns `RoleVm`.

---

### Controller Layer
Update controllers to use the new Facades for operations that require View Model orchestration.

#### [MODIFY] UserQueryController.java
- Inject `UserFacade`.
- Update endpoints (like `getUserWithPermissions`) to call `UserFacade` instead of `UserService`.

#### [MODIFY] UserGraphqlController.java
- Inject `UserFacade`.
- Update `userWithPermissions` query mapping to call `UserFacade`.

#### [MODIFY] RoleQueryController.java
- Inject `RoleFacade`.
- Update `getRoleDetail` to call `RoleFacade`.

## Verification Plan

### Automated Tests
- Run backend tests to ensure the application starts up and contexts load correctly.

### Manual Verification
- Build the backend application to ensure no compilation errors.
