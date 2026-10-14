# 067: Purge Rogue Mocks, Wire End-to-End Flows & Unify Sandbox Platform

## 1. Problem Statement
An audit of `@unipost/console` revealed violations of **Rule 00 (`ZERO-STUB-PROHIBITION` & `NO-ORPHANED-CODE`)** and **Rule 02 (`UNIFIED SANDBOX PLATFORM INTEGRATION MANDATE`)**:
1. Rogue in-component mock datasets and fake timeout promises were hardcoded directly in `features/tasks`, `features/users`, `features/chats`, and `features/apps`.
2. Existing sandbox handlers (`tasksSandboxHandler`, `usersSandboxHandler`) were partially implemented, lacked REST handler logic for mutations, and were completely disconnected from active UI flows.
3. Mutations in drawers and dialogs (e.g., `tasks-mutate-drawer.tsx`, `users-action-dialog.tsx`, `facebook-connect-modal.tsx`) invoked mock helper `showSubmittedData` or synthetic delays instead of real API calls through `springApiClient`.
4. Multi-tenant partitioning was not applied to in-memory datasets, preventing tenant switching verification.

## 2. Implementation Plan
1. **Phase A: Wire Core Views to Network APIs & Clean Up Rogue Mocks**:
   - Create typed TanStack Query hook facades: `use-tasks.ts`, `use-users.ts`, `use-chats.ts`.
   - Wire all UI tables, mutation drawers, delete dialogs, and bulk actions in `features/tasks` and `features/users` to network endpoints (`/api/tasks`, `/api/users`).
   - Wire `features/chats` conversation view and message composer to `/api/chats` and `/api/chats/:id`.
   - Wire `features/apps` connect modals (Facebook, TikTok, YouTube) to `/api/integrations/<provider>/exchange`.
2. **Phase B: Sandbox Platform Alignment & Multi-Tenant Isolation**:
   - Re-architect `tasksSandboxRepo` and `usersSandboxRepo` to partition in-memory records using `Map<string, T[]>` keyed by `activeTenantId`.
   - Implement `chats-sandbox-handler.ts` and `apps-sandbox-handler.ts` implementing `SandboxRouteHandler` with reset capabilities.
   - Register new handlers in `sandboxRegistry` and wire into `SandboxDock`'s `handleResetAllData()`.
   - Harden `axios-sandbox-adapter.ts` with idempotent registration and path normalization.
3. **Verification**:
   - Author end-to-end integration test `phase-a-b-flow.test.ts` validating all 4 domains under multi-tenant isolation.
   - Verify entire test suite (37 files, 182 tests) and run Vite production and electron builds.

## 3. Changes
- **Tasks Feature**:
  - [`apps/console/src/features/tasks/api/use-tasks.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/tasks/api/use-tasks.ts): TanStack Query facade for tasks CRUD and bulk mutations.
  - [`apps/console/src/features/tasks/index.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/tasks/index.tsx): Replaced static mock import with `useTasksQuery()`.
  - [`apps/console/src/features/tasks/components/tasks-mutate-drawer.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/tasks/components/tasks-mutate-drawer.tsx): Wired to real create and update task mutations.
  - [`apps/console/src/features/tasks/components/tasks-dialogs.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/tasks/components/tasks-dialogs.tsx): Wired to `useDeleteTaskMutation`.
  - [`apps/console/src/features/tasks/components/tasks-multi-delete-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/tasks/components/tasks-multi-delete-dialog.tsx): Wired to `useBulkDeleteTasksMutation`.
  - [`apps/console/src/features/tasks/components/data-table-bulk-actions.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/tasks/components/data-table-bulk-actions.tsx): Wired to bulk status and priority mutations.
- **Users Feature**:
  - [`apps/console/src/features/users/api/use-users.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/users/api/use-users.ts): TanStack Query facade for users CRUD, bulk status, and invite mutations.
  - [`apps/console/src/features/users/index.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/users/index.tsx): Replaced static user dataset with `useUsersQuery()`.
  - [`apps/console/src/features/users/components/users-action-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/users/components/users-action-dialog.tsx): Wired to `useCreateUserMutation` and `useUpdateUserMutation`.
  - [`apps/console/src/features/users/components/users-delete-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/users/components/users-delete-dialog.tsx): Wired to `useDeleteUserMutation`.
  - [`apps/console/src/features/users/components/users-invite-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/users/components/users-invite-dialog.tsx): Wired to `useInviteUserMutation`.
  - [`apps/console/src/features/users/components/users-multi-delete-dialog.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/users/components/users-multi-delete-dialog.tsx): Wired to `useBulkDeleteUsersMutation`.
- **Chats Feature**:
  - [`apps/console/src/features/chats/api/use-chats.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/chats/api/use-chats.ts): TanStack Query hooks for conversations and messages.
  - [`apps/console/src/features/chats/index.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/chats/index.tsx): Replaced static JSON import with `useChatsQuery()` and `useSendMessageMutation`.
  - [`apps/console/src/features/chats/components/new-chat.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/chats/components/new-chat.tsx): Wired to `useCreateConversationMutation`.
- **Apps Integration**:
  - [`apps/console/src/features/apps/components/facebook-connect-modal.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/apps/components/facebook-connect-modal.tsx): Wired token exchange through `springApiClient.post('/api/integrations/facebook/exchange')`.
  - [`apps/console/src/features/apps/components/tiktok-connect-modal.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/apps/components/tiktok-connect-modal.tsx): Wired token exchange through `springApiClient.post('/api/integrations/tiktok/exchange')`.
  - [`apps/console/src/features/apps/components/youtube-connect-modal.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/apps/components/youtube-connect-modal.tsx): Wired token exchange through `springApiClient.post('/api/integrations/youtube/exchange')`.
- **Unified Sandbox Platform**:
  - [`apps/console/src/core/sandbox/handlers/tasks-sandbox-handler.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/core/sandbox/handlers/tasks-sandbox-handler.ts): Multi-tenant in-memory task repository and REST handler.
  - [`apps/console/src/core/sandbox/handlers/users-sandbox-handler.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/core/sandbox/handlers/users-sandbox-handler.ts): Multi-tenant in-memory user repository and REST handler.
  - [`apps/console/src/core/sandbox/handlers/chats-sandbox-handler.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/core/sandbox/handlers/chats-sandbox-handler.ts): Stateful conversation repository and REST handler.
  - [`apps/console/src/core/sandbox/handlers/apps-sandbox-handler.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/core/sandbox/handlers/apps-sandbox-handler.ts): Social app token exchange and channel simulations.
  - [`apps/console/src/core/sandbox/adapters/axios-sandbox-adapter.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/core/sandbox/adapters/axios-sandbox-adapter.ts): Idempotent interceptor guard and URL prefix deduplication.
  - [`apps/console/src/core/sandbox/index.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/core/sandbox/index.ts): Registered new handlers.
  - [`apps/console/src/core/sandbox/ui/sandbox-dock.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/core/sandbox/ui/sandbox-dock.tsx): Wired repos to global reset.

## 4. Verification
1. **Vitest Tests**:
   - `src/core/sandbox/__tests__/phase-a-b-flow.test.ts`: 4/4 passed.
   - All console tests: 37 test files, 182/182 tests passed.
2. **Type Checking**:
   - `pnpm --filter @unipost/console exec tsc --noEmit`: 0 errors.
3. **Builds**:
   - Vite web build (`vite build`): passed cleanly.
   - Vite electron build (`vite build --config vite.electron.config.ts --mode electron`): passed cleanly.
4. **Architectural Directives Enforced**:
   - `ZERO-STUB-PROHIBITION`: Eliminated static mocks and sleep delays in UI components.
   - `NO-ORPHANED-CODE`: Every sandbox handler and mutation hook is wired to active runtime UI consumers.
   - Rule 02: Multi-tenant partitioning and central sandbox registry compliance.

## 5. Walkthrough
- Navigating to Tasks or Users now executes active HTTP requests intercepted by the multi-tenant sandbox in DEV or routed to the live backend in production.
- Creating, editing, bulk-updating, or deleting tasks and users dynamically updates the UI cache and the active tenant's dataset.
- Switching active tenant isolates tenant data completely.
