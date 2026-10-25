# Facade Pattern Implementation Walkthrough

## What was Accomplished
We implemented a Facade pattern in `@acc/backend` to remove ViewModel (Vm) mapping logic and direct repository orchestration from the Service layer, specifically focusing on `UserService` and `RoleService`.

1.  **Repository Layer Updates**:
    *   Updated `UserRepository.xml` and `RoleRepository.xml` `resultMap` definitions to map directly to `CompositeUserPermission`, `CompositeUserRole`, and `CompositeRolePermission` instead of `Vm` models.
    *   Updated `UserRepository.java` and `RoleRepository.java` interfaces to return these `Composite` DTOs.
2.  **Service Layer Updates**:
    *   Updated `UserService` and `RoleService` to return the `Composite` DTO models.
    *   Removed `UserMapper` and `RoleMapper` dependencies from `UserServiceImpl` and `RoleServiceImpl`.
    *   Removed complex orchestration logic for fetching and combining nested entities (like fetching permissions and roles for a user) from the services.
3.  **Facade Layer Creation**:
    *   Created `UserFacade` and `RoleFacade` interfaces.
    *   Implemented `UserFacadeImpl` and `RoleFacadeImpl` to orchestrate calls to the services and handle the mapping of `Composite` DTOs to `Vm` models (e.g., `UserPermissionVm`, `UserRoleVm`) for the presentation layer.
4.  **Controller Layer Updates**:
    *   Updated `UserQueryController`, `UserGraphqlController`, `RoleQueryController`, and `RoleCommandController` to inject and use the new `UserFacade` and `RoleFacade` for fetching and updating nested data.

## Verification
*   **Compilation**: The `@acc/backend` application was compiled successfully using `pnpm --filter @acc/backend build`.
*   All tests and build phases completed without errors, ensuring the new Facade pattern integrations are structurally sound.

## Summary
The `UserService` and `RoleService` are now decoupled from the presentation-specific ViewModel logic. They correctly return reusable DTOs (`Composite` models). The Facade layer handles all complex orchestration and ViewModel mapping, resolving the identified anti-pattern.
