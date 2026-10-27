# 109. Unify Client-Backend Contracts (`@acc/client`) & Sandbox Platform (`@acc/sandbox`)

**Date**: 2026-10-15  
**Author**: Antigravity  
**Status**: Completed  
**Scope**: `@acc/client`, `@acc/sandbox`, `@acc/console`

---

## 1. Problem Statement
Across the Acc monorepo, both **API contracts** and **sandbox mock implementations** were fragmented:
1. **Contract Fragmentation**: Model definitions, DTOs, and API envelopes were split across `packages/client/src/types.ts`, `apps/console/src/features/spring-auth/types.ts`, `apps/console/src/features/workflows/`, and `apps/console/src/features/workflow-executions/`.
2. **Sandbox Fragmentation**: Most mock handlers (`auth`, `metadata`, `users`, `billing`, `system`, `workspaces`, `chats`, `apps`) and stateful in-memory repositories resided strictly inside `apps/console/src/core/sandbox/handlers/`, leaving `@acc/sandbox` incomplete and preventing other clients (like `apps/mobile-ui`) from reusing mock infrastructure.
3. **Reset Inconsistencies**: No centralized reset registry existed across repositories, making deterministic data resetting difficult.

---

## 2. Proposed Architecture & Plan
1. **Contract Unification (`@acc/client`)**:
   - Establish modular domain submodules under `packages/client/src/contracts/` (`common`, `auth`, `metadata`, `workflows`, `workflow-executions`, `users`, `billing`).
   - Maintain pure TypeScript contracts with zero 3rd-party runtime dependencies.
   - Expand `AccClient` with domain-namespaced APIs and SSE execution stream reader.
2. **Sandbox Unification (`@acc/sandbox`)**:
   - Build `SandboxResetRegistry` (`sandboxResetRegistry`) for stateful repositories.
   - Centralize all mock handlers, repositories, fixtures, and store management in `packages/sandbox`.
3. **Backward Compatibility Hub in `@acc/console`**:
   - Re-export all handlers, types, and registries from `@acc/sandbox` in `apps/console/src/core/sandbox/index.ts`.
   - Update `SandboxDock` to invoke `sandboxResetRegistry.resetAll()`.
   - Synchronize tenant context in `springApiClient` request interceptor.

---

## 3. Implementation Details

### A. `@acc/client`
- Created `packages/client/src/contracts/`:
  - `common.ts`: Standard API envelopes, traceparent generator, pagination, sort, and validation errors.
  - `auth.ts`: Authentication requests, responses, JWT claims, roles, and tenant context.
  - `metadata.ts`: Entity types, attributes, relations, schemas, records.
  - `workflows.ts`: Workflow definition DTOs, tasks, triggers, parameters, validation results.
  - `workflow-executions.ts`: Execution units, lifecycle statuses, step metrics, DAG snapshots.
  - `users.ts`: Tenant users, memberships, roles, status, invitations.
  - `billing.ts`: Pricing tiers, quotas, checkout, payOS VietQR models.
  - `index.ts`: Re-export barrel.
- Updated `AccClient` in `packages/client/src/client.ts` to provide typed namespaces (`auth`, `metadata`, `workflows`, `workflowExecutions`, `users`, `billing`).

### B. `@acc/sandbox`
- Implemented `SandboxResetRegistry` in `packages/sandbox/src/reset-registry.ts`.
- Migrated domain handlers and stateful repositories:
  - `auth-sandbox-handler.ts` (with `createMockJwt`, `MOCK_ACCESS_TOKEN`, `MOCK_REFRESH_TOKEN`)
  - `users-sandbox-handler.ts` & `UsersSandboxRepository`
  - `workflow-executions-sandbox-handler.ts` & `WorkflowExecutionsSandboxRepository`
  - `workflows-sandbox-handler.ts` & workflow definition catalog
  - `billing-sandbox-handler.ts` & VietQR sandbox repo
  - `system-sandbox-handler.ts` & fleet tenant repository
  - `workspace-sandbox-handler.ts` & workspace repository
  - `chats-sandbox-handler.ts` & chat repository
  - `apps-sandbox-handler.ts` & installed app repository
- Standardized `SandboxStoreManager` and `defaultSandboxStore`.

### C. `@acc/console`
- Re-exported all sandbox handlers and singleton `sandboxRegistry` from `@acc/sandbox`.
- Connected `SandboxDock` reset button to `sandboxResetRegistry.resetAll()`.
- Synchronized tenant header in `apps/console/src/features/spring-auth/api-client.ts` with `useSandboxStore.getState().activeTenantId`.
- Resolved type mapping in `apps/console/src/routes/_authenticated/workflow-executions/index.tsx`.

---

## 4. Verification

1. **`@acc/client` Vitest Suite**:
   ```bash
   pnpm --filter @acc/client test
   # Test Files: 3 passed, Tests: 20 passed
   ```
2. **`@acc/client` Type Check**:
   ```bash
   pnpm --filter @acc/client check-types
   # 0 errors
   ```
3. **`@acc/sandbox` Vitest Suite**:
   ```bash
   pnpm --filter @acc/sandbox test
   # Test Files: 2 passed, Tests: 9 passed
   ```
4. **`@acc/sandbox` Type Check**:
   ```bash
   pnpm --filter @acc/sandbox check-types
   # 0 errors
   ```
5. **`@acc/console` Sandbox Vitest Suite**:
   ```bash
   pnpm --filter @acc/console test src/core/sandbox
   # Test Files: 10 passed, Tests: 65 passed
   ```

---

## 5. Walkthrough & Documentation
- Implementation Plan: `apps/console/doc/implementation_plan_99.md`
- Walkthrough: `apps/console/doc/walkthrough_99.md`
