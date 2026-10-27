# 035: Backend Workspace REST Controller & Unified Sandbox Handler

## Problem
In Task 034, we created the `UNIPOST_WORKSPACES` database table, Liquibase RLS migration, `Workspace` entity, and auto-provisioning logic within `TenantProvisioningService`. However:
1. There were no REST endpoints (`WorkspaceController`) allowing clients to list, inspect, create, switch default, or soft-delete workspaces within their active tenant context.
2. The client apps (`@acc/console`) and Unified Sandbox Platform had no mock route handler registered for `/api/v1/workspaces`, preventing local sandbox-driven workflows from aligning with the backend workspace contracts.

## Plan
1. **Backend DTOs & Service**:
   - Create `com.acc.workspace.dto.WorkspaceDto`, `CreateWorkspaceRequest`, and `UpdateWorkspaceRequest`.
   - Create `com.acc.workspace.service.WorkspaceService` enforcing multi-tenant isolation, default workspace immutability, and sole workspace protection.
2. **Backend REST Controller**:
   - Create `com.acc.presentation.WorkspaceController` exposing:
     - `GET /api/v1/workspaces`: List workspaces for current tenant.
     - `GET /api/v1/workspaces/{uid}`: Retrieve single workspace.
     - `POST /api/v1/workspaces`: Create workspace.
     - `PUT /api/v1/workspaces/{uid}`: Update workspace details.
     - `PUT /api/v1/workspaces/{uid}/default`: Set default workspace for tenant.
     - `DELETE /api/v1/workspaces/{uid}`: Soft-delete workspace with invariant guardrails.
3. **Frontend Unified Sandbox Alignment**:
   - Implement `workspaceSandboxHandler` in `apps/console/src/core/sandbox/handlers/workspace-sandbox-handler.ts`.
   - Register handler in `apps/console/src/core/sandbox/index.ts`.
   - Connect `sandboxWorkspaceRepository.reset()` in `SandboxDock`.
4. **Verification**:
   - Backend unit tests: `WorkspaceServiceTest` -> 7/7 tests passed.
   - Frontend unit tests: `workspace-sandbox-handler.test.ts` + full vitest suite -> 144/144 tests passed across 28 test files.
   - Vite production build & Maven reactor test-compile verified.

## Changes
- **Backend (`apps/backend/acc-fw`)**:
  - `src/main/java/com/acc/workspace/dto/WorkspaceDto.java`: Record DTO.
  - `src/main/java/com/acc/workspace/dto/CreateWorkspaceRequest.java`: Creation payload.
  - `src/main/java/com/acc/workspace/dto/UpdateWorkspaceRequest.java`: Update payload.
  - `src/main/java/com/acc/workspace/service/WorkspaceService.java`: Service logic & invariants.
  - `src/main/java/com/acc/presentation/WorkspaceController.java`: REST controller.
  - `src/test/java/com/acc/workspace/service/WorkspaceServiceTest.java`: 7 test cases covering listing, conflict rejection, and deletion safeguards.
- **Frontend Sandbox (`apps/console`)**:
  - `src/core/sandbox/handlers/workspace-sandbox-handler.ts`: Unified sandbox mock engine for workspaces.
  - `src/core/sandbox/index.ts`: Registered `workspaceSandboxHandler`.
  - `src/core/sandbox/ui/sandbox-dock.tsx`: Added `sandboxWorkspaceRepository.reset()` to `handleResetAllData`.
  - `src/core/sandbox/__tests__/workspace-sandbox-handler.test.ts`: Vitest suite covering API matching, default workspace protection, code duplication rejection, and default switching.

## Verification
- Maven unit tests: `apps/backend/mvnw.cmd test -pl acc-fw -Dtest=WorkspaceServiceTest` -> **7/7 passed**.
- Maven reactor compile: `apps/backend/mvnw.cmd test-compile -DskipTests` -> **BUILD SUCCESS** (4.664s).
- Vitest suite: `pnpm --filter @acc/console test` -> **144/144 passed across 28 test files**.
- Vite production build: `pnpm --filter @acc/console exec vite build` -> **Built in 641ms**.

## Tasks
- [x] Phase 1: Database Migration (`UNIPOST_WORKSPACES` table, RLS, partial default index).
- [x] Phase 2: JPA Entity, Repository & Auto-provisioning in `TenantProvisioningService`.
- [x] Phase 3: REST Controller (`WorkspaceController`), Service, and Unified Sandbox Handler alignment.
