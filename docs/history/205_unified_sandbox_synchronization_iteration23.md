# 205. Unified Sandbox Platform Synchronization (Iteration 23)

## Problem
Following the implementation of canonical Sovereign RBAC permissions, Passkey biometric authentication, and Person-tenant self-onboarding (`tenant_id = 'usr-<uuid>'`) in Iteration 23, the Unified Sandbox Platform across both backend (`apps/backend/unipost-sandbox`) and frontend (`apps/console/src/core/sandbox/`) retained legacy role strings (e.g. `ROLE_ADMIN`, `ROLE_CREATOR`, `ROLE_USER`) and lacked aligned persona structures. To maintain zero-regression sandbox parity and enable seamless offline development and testing, the sandbox needed to be synchronized with canonical Sovereign and inside-tenant roles and authorities.

## Plan
1. **Backend Sandbox Alignment (`apps/backend/unipost-sandbox`)**:
   - Update `SandboxPersonaRegistry` to declare canonical roles and the full set of 24 permissions across all personas (`admin`, `system`, `creator`, `user`).
   - Assign `ROLE_SYSTEM_ROOT`, `ROLE_WORKSPACE_OWNER`, `ROLE_OPERATIONS_MANAGER`, and `ROLE_STANDARD_MEMBER`.
   - Update `SandboxPersonaRegistryTest` assertions to verify canonical roles.
2. **Frontend Sandbox Alignment (`apps/console/src/core/sandbox`)**:
   - Update `DEFAULT_SANDBOX_PERSONAS` in `store/sandbox-store.ts` to reflect canonical role names and titles.
   - Synchronize `apps/console/src/core/sandbox/handlers/auth-sandbox-handler.ts` mock datasets and mock authentication tokens.
   - Update frontend sandbox test suites (`sandbox-dock.test.tsx`, `sandbox-integration.test.ts`, `sandbox-core.test.ts`) to assert canonical roles.
3. **Verification**:
   - Execute backend sandbox tests: `mvn test -pl unipost-sandbox`.
   - Execute frontend unit and integration tests: `pnpm --filter @unipost/console test:run`.
   - Verify zero regressions and 100% test pass rates.

## Changes
- `apps/backend/unipost-sandbox/src/main/java/com/unipost/sandbox/auth/SandboxPersonaRegistry.java`:
  - Aligned `system` persona with `ROLE_SYSTEM_ROOT`, `ROLE_WORKSPACE_OWNER`, `ROLE_STANDARD_MEMBER`.
  - Aligned `admin` persona with `ROLE_WORKSPACE_OWNER`, `ROLE_STANDARD_MEMBER`, `ROLE_ADMIN`.
  - Aligned `creator` persona with `ROLE_OPERATIONS_MANAGER`, `ROLE_STANDARD_MEMBER`.
  - Aligned `user` persona with `ROLE_STANDARD_MEMBER`.
  - Populated complete canonical authority sets for each persona.
- `apps/backend/unipost-sandbox/src/test/java/com/unipost/sandbox/auth/SandboxPersonaRegistryTest.java`:
  - Updated assertions for canonical roles across all default personas.
- `apps/console/src/core/sandbox/store/sandbox-store.ts`:
  - Updated `DEFAULT_SANDBOX_PERSONAS` with canonical titles and role arrays.
- `apps/console/src/core/sandbox/__tests__/sandbox-dock.test.tsx`:
  - Updated persona dock switch button query from "Content" to "Operations".
- `apps/console/src/core/sandbox/__tests__/sandbox-integration.test.ts`:
  - Updated expected creator persona role from `ROLE_CREATOR` to `ROLE_OPERATIONS_MANAGER`.
- `apps/console/src/core/sandbox/__tests__/sandbox-core.test.ts`:
  - Updated expected creator persona role from `ROLE_CREATOR` to `ROLE_OPERATIONS_MANAGER`.

## Verification
- `mvn test -pl unipost-sandbox` -> 100% passed (6/6 tests passing, exit code 0).
- `pnpm --filter @unipost/console test:run` -> 100% passed (93/93 test files passing, 432/432 tests passing, exit code 0).

## Walkthrough
1. Persona switching in SandboxDock dynamically transitions between Sovereign Root, Workspace Owner, Operations Manager, and Standard Member.
2. Intercepted `/auth/me` and `/auth/login` requests emit canonical roles and 24 permission atoms matching the production backend RBAC matrix.
3. Offline dev mode and automated unit/integration tests run with complete fidelity against the Iteration 23 architectural specifications.
