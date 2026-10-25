# Migrate QueryDSL Repositories to MyBatis in `@acc/backend`

Migrate all QueryDSL repositories (`QUserRepository`, `QRoleRepository`, `BaseQRepository`, `QueryDslConfiguration`) in `@acc/backend` (`acc-ms-identity` and `acc-fw`) to existing MyBatis repository interfaces (`UserRepository`, `RoleRepository`) and XML mappers (`UserRepository.xml`, `RoleRepository.xml`), reusing existing domain models/DTOs and removing QueryDSL dependencies.

## User Review Required

> [!IMPORTANT]
> - All QueryDSL repositories (`QUserRepository`, `QRoleRepository`) and helper classes (`BaseQRepository`, `QueryDslConfiguration`) will be removed.
> - Queries are migrated directly into existing MyBatis interfaces (`com.acc.user.repository.mybatis.UserRepository` & `RoleRepository`) and existing XML mapper files (`src/main/resources/mappers/UserRepository.xml` & `RoleRepository.xml`).
> - No new DTO classes are introduced. Existing response/request VMs (`UserPermissionVm`, `UserRoleVm`, `RolePermissionVm`, `RoleVm`, `PermissionVm`, `User`, `Permission`) and standard `Map<String, Object>` results are reused.

> [!NOTE]
> QueryDSL dependencies (`querydsl-apt`, `querydsl-jpa`, `querydsl.version` property) will be removed from `apps/backend/pom.xml` and `apps/backend/acc-fw/pom.xml`.

## Open Questions

None.

## Proposed Changes

---

### `acc-ms-identity`

#### [MODIFY] [UserRepository.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/repository/mybatis/UserRepository.java)
- Add MyBatis interface methods reusing existing DTOs/models:
  - `List<UserPermissionVm> findAllUserPermissions(@Param("uid") String uid)`
  - `List<UserRoleVm> findAllUserRoles(@Param("uid") String uid)`
  - `List<Map<String, Object>> findAllRoleGroupByPermission(@Param("roleIds") Set<Long> roleIds)`
  - `List<Map<String, String>> findUsersName(@Param("userUids") List<String> userUids)`

#### [MODIFY] [UserRepository.xml](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/resources/mappers/UserRepository.xml)
- Add MyBatis `<resultMap>` definitions and `<select>` queries for `findAllUserPermissions`, `findAllUserRoles`, `findAllRoleGroupByPermission`, and `findUsersName`.

#### [MODIFY] [RoleRepository.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/repository/mybatis/RoleRepository.java)
- Add MyBatis interface methods reusing existing DTOs/models:
  - `List<RolePermissionVm> findAllRolePermissions(@Param("uid") String uid)`
  - `List<UserRoleVm> findAllRoleUsers(@Param("uid") String uid)`
  - `List<RoleVm> findAllRolesWithUserCount(@Param("offset") long offset, @Param("size") long size)`

#### [MODIFY] [RoleRepository.xml](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/resources/mappers/RoleRepository.xml)
- Add MyBatis `<resultMap>` definitions and `<select>` queries for `findAllRolePermissions`, `findAllRoleUsers`, and `findAllRolesWithUserCount`.

#### [MODIFY] [UserServiceImpl.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/service/impl/UserServiceImpl.java)
- Replace `@Autowired QUserRepository qUserRepository` with `@Autowired UserRepository mUserRepository`.
- Update `findUserWithPermissions` and `findUsersName` to call MyBatis `mUserRepository` methods and map results.

#### [MODIFY] [RoleServiceImpl.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/service/impl/RoleServiceImpl.java)
- Replace `@Autowired QRoleRepository qRoleRepository` with existing `@Autowired com.acc.user.repository.mybatis.RoleRepository mRoleRepository`.
- Update `findAllBelongingPermissions`, `findAllBelongingUsers`, and `getRoleDetail` to call MyBatis `mRoleRepository` methods.

#### [DELETE] [QUserRepository.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/repository/querydsl/QUserRepository.java)
#### [DELETE] [QRoleRepository.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/repository/querydsl/QRoleRepository.java)
#### [DELETE] [CompositeUser.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/repository/querydsl/model/CompositeUser.java)
#### [DELETE] [CompositeRole.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/repository/querydsl/model/CompositeRole.java)
#### [DELETE] [CompositePermission.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-identity/src/main/java/com/acc/user/repository/querydsl/model/CompositePermission.java)
- Delete legacy QueryDSL repository classes and unused models under `com.acc.user.repository.querydsl`.

---

### `acc-fw` & Root Configuration

#### [DELETE] [BaseQRepository.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/repository/queryDsl/BaseQRepository.java)
#### [DELETE] [QueryDslConfiguration.java](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/boot/config/QueryDslConfiguration.java)
- Delete QueryDSL base class and configuration.

#### [MODIFY] [apps/backend/acc-fw/pom.xml](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/pom.xml)
- Remove `querydsl-apt` and `querydsl-jpa` dependencies.

#### [MODIFY] [apps/backend/pom.xml](file:///c:/Users/Admin/workspace/git/acc/apps/backend/pom.xml)
- Remove `querydsl.version` property and `querydsl-apt` dependency management.

---

## Verification Plan

### Automated Tests
- Run Maven build to compile code and ensure clean removal of QueryDSL without compiler errors:
  `pnpm --filter @acc/backend build` or `./mvnw clean compile -DskipTests` (in `apps/backend`)
- Run unit/integration tests for backend:
  `pnpm --filter @acc/backend test` or `./mvnw test` (in `apps/backend`)
