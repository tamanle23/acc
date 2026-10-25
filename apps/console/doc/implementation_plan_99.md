# Implementation Plan 99 - Unified Client & Sandbox Architecture Plan (`@acc/client` & `@acc/sandbox`)

## 1. Executive Summary
Across the Acc monorepo, both **API contracts** and **sandbox mock implementations** have grown fragmented across different directories and applications:
1. **Contract Fragmentation (`@acc/client`)**:
   - Model definitions, DTOs, and API envelopes are split across `packages/client/src/types.ts`, `apps/console/src/features/spring-auth/types.ts`, `apps/console/src/features/workflows/api/workflow-api.ts`, `apps/console/src/features/workflow-executions/`, and Java Spring controllers (`acc-fw`, `acc-ms-identity`, `acc-ms-aio`, `workflow-engine`).
2. **Sandbox Mock Fragmentation (`@acc/sandbox` vs `apps/console/src/core/sandbox`)**:
   - The monorepo has a standalone package `packages/sandbox`, yet most mock handlers (`auth`, `metadata`, `users`, `billing`, `system`, `workspaces`, `chats`, `apps`) and in-memory mock repositories reside inside `apps/console/src/core/sandbox/handlers/`.
   - `apps/mobile-ui` imports from `@acc/sandbox`, but only has access to a subset of handlers (`widget`, `workflow`).
   - The in-memory state reset mechanism is currently hardcoded and fragmented.

---

## 2. Core Decisions Aligned
1. **Pure TypeScript Contracts**: `@acc/client` maintains zero third-party runtime dependencies.
2. **Domain-Namespaced Client**: `AccClient` provides `.auth`, `.metadata`, `.workflows`, `.workflowExecutions` (with SSE stream helper), `.users`, and `.billing`.
3. **Complete Sandbox Engine Centralization**: All domain mock handlers and in-memory repositories migrate to `@acc/sandbox`.
4. **Master Reset Registry**: Centralized `sandboxResetRegistry.resetAll()` replaces ad-hoc reset calls.
5. **Zero Breaking Changes**: `apps/console/src/core/sandbox/` re-exports from `@acc/sandbox` and hosts `SandboxDock`.

---

## 3. Tasks & Scope
- **Part 1**: Modularize `@acc/client/src/contracts/` into domain sub-modules and enrich `AccClient`.
- **Part 2**: Build `SandboxResetRegistry` in `@acc/sandbox` and migrate all domain handlers & repositories from `apps/console`.
- **Part 3**: Refactor `apps/console/src/core/sandbox/` to re-export from `@acc/sandbox` and wire `SandboxDock` to `sandboxResetRegistry.resetAll()`.
- **Part 4**: Align feature-level `types.ts` in `apps/console` as re-export hubs.
- **Part 5**: Full test suite verification across `@acc/client`, `@acc/sandbox`, and `@acc/console`.
