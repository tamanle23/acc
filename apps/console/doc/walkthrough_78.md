# Walkthrough 78: Phase A & Phase B — Purged Rogue Mocks, Wired End-to-End Flows & Unified Sandbox Platform

## 1. Executive Summary

In adherence to Monorepo Architecture Directives, **Rule 00 (`ZERO-STUB-PROHIBITION` & `NO-ORPHANED-CODE`)**, and **Rule 02 (`UNIFIED SANDBOX PLATFORM INTEGRATION MANDATE`)**, we executed Phase A and Phase B to:
1. Purge all rogue in-component static data structures and ad-hoc mutations across `@acc/console` (`features/tasks`, `features/users`, `features/chats`, and `features/apps`).
2. Implement typed TanStack Query hook facades and wire all UI views, drawers, and modal dialogs directly to real HTTP network routes (`/api/tasks`, `/api/users`, `/api/chats`, `/api/integrations`) via `springApiClient`.
3. Re-architect orphaned sandbox handlers (`tasks-sandbox-handler`, `users-sandbox-handler`) with dynamic multi-tenant partitioning (`activeTenantId`).
4. Centralize conversations and third-party social integrations into `chats-sandbox-handler` and `apps-sandbox-handler`, registered in `sandboxRegistry` with master state reset support in `SandboxDock`.
5. Harden the Axios sandbox adapter with idempotent interceptor registration and transparent path normalization.

---

## 2. Key Changes Made

### Phase A: End-to-End API Wiring & Rogue Mock Elimination
- **`features/tasks/api/use-tasks.ts` [NEW]**:
  - TanStack Query hooks: `useTasksQuery`, `useCreateTaskMutation`, `useUpdateTaskMutation`, `useDeleteTaskMutation`, `useBulkDeleteTasksMutation`, `useBulkUpdateTasksStatusMutation`, `useBulkUpdateTasksPriorityMutation`.
- **`features/tasks/index.tsx` & Dialogs**:
  - Replaced static `import { tasks }` with reactive `useTasksQuery()`.
  - Wired `tasks-mutate-drawer.tsx` to `useCreateTaskMutation` and `useUpdateTaskMutation`.
  - Wired `tasks-dialogs.tsx` and `tasks-multi-delete-dialog.tsx` to `useDeleteTaskMutation` and `useBulkDeleteTasksMutation`.
  - Wired `data-table-bulk-actions.tsx` to bulk status/priority mutations.
- **`features/users/api/use-users.ts` [NEW]**:
  - TanStack Query hooks: `useUsersQuery`, `useCreateUserMutation`, `useUpdateUserMutation`, `useDeleteUserMutation`, `useBulkDeleteUsersMutation`, `useBulkUpdateUsersStatusMutation`, `useInviteUserMutation`.
- **`features/users/index.tsx` & Dialogs**:
  - Replaced static mock list with `useUsersQuery()`.
  - Wired `users-action-dialog.tsx` to `useCreateUserMutation` and `useUpdateUserMutation`.
  - Wired `users-delete-dialog.tsx` and `users-multi-delete-dialog.tsx` to real delete mutations.
  - Wired `users-invite-dialog.tsx` and `data-table-bulk-actions.tsx` to invite/bulk status mutations.
- **`features/chats/api/use-chats.ts` [NEW]**:
  - TanStack Query hooks: `useChatsQuery`, `useSendMessageMutation`, `useCreateConversationMutation`.
- **`features/chats/index.tsx` & `new-chat.tsx`**:
  - Replaced raw JSON read with `useChatsQuery()` and wired message composer to `useSendMessageMutation`.
- **`features/apps/components/*-connect-modal.tsx`**:
  - Converted Facebook, TikTok, and YouTube modal authentication from synthetic timeouts to real network exchanges: `springApiClient.post('/api/integrations/<provider>/exchange')`.

### Phase B: Sandbox Platform Alignment & Multi-Tenant Isolation
- **`core/sandbox/handlers/tasks-sandbox-handler.ts`**:
  - Replaced monolithic array with `tenantTasks: Map<string, Task[]>`, seeded per tenant (`SYSTEM`, `tenant-acme`, `tenant-us-east-1`).
  - Added full REST handler matching `/api/tasks` and `/api/tasks/:id` (GET, POST, PATCH, PUT, DELETE).
- **`core/sandbox/handlers/users-sandbox-handler.ts`**:
  - Replaced monolithic array with `tenantUsers: Map<string, User[]>`, seeded per tenant.
  - Added full REST handler matching `/api/users` and `/api/users/:id`.
- **`core/sandbox/handlers/chats-sandbox-handler.ts` [NEW]**:
  - Implemented `ChatsSandboxRepository` with stateful conversation message appending.
  - Handled `/api/chats` and `/api/chats/:id`.
- **`core/sandbox/handlers/apps-sandbox-handler.ts` [NEW]**:
  - Implemented `AppsSandboxRepository` with OAuth token exchanges and channel queries for Facebook, TikTok, and YouTube.
- **`core/sandbox/adapters/axios-sandbox-adapter.ts`**:
  - Hardened with idempotent interceptor guard `__sandbox_interceptor_attached__` to prevent duplicate interceptor stacking across repeated initializations.
  - Added duplicate `/api` prefix elimination when `baseURL` and request URL both specify `/api`.
- **`core/sandbox/index.ts` & `core/sandbox/ui/sandbox-dock.tsx`**:
  - Registered `chatsSandboxHandler` and `appsSandboxHandler`.
  - Wired `chatsSandboxRepo.reset()` and `appsSandboxRepo.reset()` into `handleResetAllData()`.

---

## 3. Verification & Results

1. **Automated Test Suite**:
   - `src/core/sandbox/__tests__/phase-a-b-flow.test.ts`: 4/4 tests passed (covering Tasks CRUD & tenant isolation, Users CRUD & status mutations, Chats message appending, and Social Apps OAuth token exchanges).
   - Entire Console test suite: **37 test files, 182 tests passing (100% green)**.
2. **TypeScript Compilation**:
   - `pnpm --filter @acc/console exec tsc --noEmit` exited cleanly with code 0.
3. **Production & Electron Builds**:
   - `vite build` completed cleanly generating web bundle artifacts in `dist/web/`.
   - `vite build --config vite.electron.config.ts --mode electron` completed cleanly generating desktop assets in `dist/electron-web/`.
