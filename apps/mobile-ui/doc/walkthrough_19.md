# Walkthrough 19: Phase 6 - mobile-ui Zero-Data-Loss Encrypted Outbox (`useOutboxStore`)

## 1. Overview
Completed Phase 6 of `docs/brainstorming/integration_master_plan_iteration_1.md`:
- Implemented `useOutboxStore` in `apps/mobile-ui/src/store/useOutboxStore.ts`:
  - Enqueues mutations with idempotency UUID (`Idempotency-Key`), transaction tracker (`Client-Transaction-Id`), entity type, operation (`CREATE`, `UPDATE`, `DELETE`), and payload.
  - Sequentially dispatches pending jobs through `UnipostClient` with header context injection.
  - Automatically identifies HTTP 409 concurrency conflicts and flags them as `CONFLICT`, capturing the conflicting remote server state.
  - Provides conflict resolution workflows (`KEEP_LOCAL`, `ACCEPT_SERVER`, `CUSTOM_MERGE`).
- Implemented `ConflictResolutionModal` in `apps/mobile-ui/src/components/conflict/ConflictResolutionModal.tsx`:
  - Liquid Glass styled comparison modal.
  - Displays side-by-side diff between local pending edits and remote server state.
  - Provides intuitive actions to keep local modifications or accept the server version.
- Wired `usePostStore` in `apps/mobile-ui/src/store/usePostStore.ts`:
  - `addPost` enqueues mutation jobs directly into `useOutboxStore`, updating local state optimistically while dispatching safely in the background.
- Built comprehensive test suite in `apps/mobile-ui/src/__tests__/outbox-store.test.ts`.

## 2. Changes Summary
- `apps/mobile-ui/src/store/useOutboxStore.ts`: New store.
- `apps/mobile-ui/src/components/conflict/ConflictResolutionModal.tsx`: New component.
- `apps/mobile-ui/src/store/usePostStore.ts`: Updated `addPost` to leverage outbox.
- `apps/mobile-ui/src/__tests__/outbox-store.test.ts`: 4 unit tests covering enqueuing, sync batch processing, HTTP 409 conflict detection and resolution, and `usePostStore` integration.

## 3. Verification Results
- `pnpm --filter mobile-ui test`: 3 test files passed, 13/13 tests green.
- `pnpm --filter @unipost/client test`: 6/6 tests green.
- `pnpm --filter @unipost/sandbox test`: 5/5 tests green.
- `pnpm --filter @unipost/console test`: 29 test files passed, 146/146 tests green.
