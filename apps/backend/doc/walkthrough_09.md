# Walkthrough: Migrate QueryDSL Repositories to MyBatis in `@acc/backend`

All QueryDSL repositories and configurations in `@acc/backend` have been successfully migrated to MyBatis interfaces and XML mappers, and QueryDSL dependencies have been removed.

## Changes Completed

### 1. MyBatis Mapper Interfaces (`acc-ms-identity`)
- **[UserRepository.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/repository/mybatis/UserRepository.java)**:
  - Added `findAllUserPermissions(String uid)`
  - Added `findAllUserRoles(String uid)`
  - Added `findAllRoleGroupByPermission(Set<Long> roleIds)`
  - Added `findUsersName(List<String> userUids)`
- **[RoleRepository.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/repository/mybatis/RoleRepository.java)**:
  - Added `findAllRolePermissions(String uid)`
  - Added `findAllRoleUsers(String uid)`
  - Added `findAllRolesWithUserCount(long offset, long size)`

---

### 2. MyBatis Mapper XMLs (`acc-ms-identity`)
- **[UserRepository.xml](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/resources/mappers/UserRepository.xml)**:
  - Added `UserPermissionVmMap` and `UserRoleVmMap` `<resultMap>` definitions.
  - Implemented `<select>` queries for `findAllUserPermissions`, `findAllUserRoles`, `findAllRoleGroupByPermission`, and `findUsersName`.
- **[RoleRepository.xml](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/resources/mappers/RoleRepository.xml)**:
  - Added `RolePermissionVmMap`, `RoleUserVmMap`, and `RoleVmMap` `<resultMap>` definitions.
  - Implemented `<select>` queries for `findAllRolePermissions`, `findAllRoleUsers`, and `findAllRolesWithUserCount`.

---

### 3. Service Layer Refactoring (`acc-ms-identity`)
- **[UserServiceImpl.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/service/impl/UserServiceImpl.java)**: Replaced `QUserRepository` with `@Autowired com.acc.user.repository.mybatis.UserRepository mUserRepository`.
- **[RoleServiceImpl.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/service/impl/RoleServiceImpl.java)**: Replaced `QRoleRepository` with existing `@Autowired com.acc.user.repository.mybatis.RoleRepository mRoleRepository`.

---

### 4. Code Cleanup & Dependency Removal
- **Deleted QueryDSL repository and model files**:
  - `QUserRepository.java`
  - `QRoleRepository.java`
  - `CompositeUser.java`, `CompositeRole.java`, `CompositePermission.java`
  - `BaseQRepository.java`
  - `QueryDslConfiguration.java`
- **Updated POM files**:
  - Removed `querydsl-apt` and `querydsl-jpa` dependencies from `apps/backend/acc-fw/pom.xml`.
  - Removed `querydsl.version` property and `querydsl-apt` annotation processor from `apps/backend/pom.xml`.

---

## Verification Results

### Automated Build & Compilation
Executed `./mvnw.cmd clean test-compile -DskipTests` in `apps/backend`:
- All 10 reactor modules (`acc`, `acc-core`, `acc-fw`, `acc-resources`, `acc-db`, `acc-ms-fs`, `acc-ms-identity`, `acc-report-engine`, `acc-ms-worker`, `acc-ms-aio`) built **SUCCESSFULLY** in `54.74s`.
