# Implementation Plan 19: Phase 6 - mobile-ui Zero-Data-Loss Encrypted Outbox (`useOutboxStore`)

## 1. Overview
In accordance with `docs/brainstorming/integration_master_plan_iteration_1.md` (Phase 6), implement the zero-data-loss encrypted mobile mutation outbox:
1. `useOutboxStore.ts`:
   - Enqueues mutation jobs (`OutboxMutationJob`) with per-mutation idempotency UUIDs (`idempotencyKey`), `clientTransactionId`, entity type, operation (`CREATE`, `UPDATE`, `DELETE`), payload, timestamp, retry count, and status (`PENDING`, `SYNCING`, `SYNCED`, `FAILED`, `CONFLICT`).
   - Persists queue via AsyncStorage with simulated/pluggable encryption wrapper.
   - Dispatches queued mutations sequentially or in batches when online.
   - Detects HTTP 409 concurrency conflicts and flags them as `CONFLICT`.
2. `ConflictResolutionModal.tsx`:
   - Interactive modal with Liquid Glass styling displaying:
     - Local pending mutation state vs. Remote server state.
     - Conflict diff inspection.
     - Three resolution choices: Keep Local (overwrite server), Accept Server (discard local), or Merge.
3. Wire `usePostStore.ts`:
   - Enhances record creation and updates to enqueue to `useOutboxStore` when offline or on failure, with automatic background synchronization upon online trigger.
4. Unit tests in `apps/mobile-ui/src/__tests__/outbox-store.test.ts`:
   - Tests enqueuing, sync batch processing, retry backoff, and conflict resolution modal triggering.

## 2. Target Files
- `apps/mobile-ui/src/store/useOutboxStore.ts` (new)
- `apps/mobile-ui/src/components/conflict/ConflictResolutionModal.tsx` (new)
- `apps/mobile-ui/src/store/usePostStore.ts` (updated)
- `apps/mobile-ui/src/__tests__/outbox-store.test.ts` (new)

## 3. Verification Plan
- Unit tests pass with 100% green status.
- All workspace tests pass (`mobile-ui`, `@unipost/client`, `@unipost/sandbox`, `@unipost/console`).
