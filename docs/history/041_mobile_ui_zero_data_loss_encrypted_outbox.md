# 041: mobile-ui Zero-Data-Loss Encrypted Outbox (Integration Master Plan Phase 6)

## Problem
In accordance with `docs/brainstorming/integration_master_plan_iteration_1.md` (Phase 6), mobile operators operating on intermittent cellular connections were susceptible to mutation drops, unhandled network failures, and silent last-write-wins collisions when editing records.

## Plan
1. Create `useOutboxStore.ts` to manage offline mutation queuing with per-mutation idempotency UUIDs (`Idempotency-Key`) and `Client-Transaction-Id`.
2. Support handling HTTP 409 concurrency conflicts with local/server resolution (`resolveConflict`).
3. Create `ConflictResolutionModal.tsx` with Liquid Glass styling displaying local vs. server state.
4. Wire `usePostStore.ts` to enqueue mutations into `useOutboxStore`.
5. Add unit test suite in `apps/mobile-ui/src/__tests__/outbox-store.test.ts`.
6. Verify multi-tier workspace tests.

## Changes
- `apps/mobile-ui/src/store/useOutboxStore.ts`: Created zero-data-loss mutation outbox store.
- `apps/mobile-ui/src/components/conflict/ConflictResolutionModal.tsx`: Created 3-way conflict resolution modal with Liquid Glass styling.
- `apps/mobile-ui/src/store/usePostStore.ts`: Wired record creation and mutations to outbox pipeline.
- `apps/mobile-ui/src/__tests__/outbox-store.test.ts`: Added unit tests covering enqueuing, sync execution, OCC 409 conflict resolution, and post store integration.
- `apps/mobile-ui/doc/implementation_plan_19.md` & `apps/mobile-ui/doc/walkthrough_19.md`: Documented paired plan and walkthrough.

## Verification
- `pnpm --filter mobile-ui test`: Passed (13/13 tests across 3 test files).
- `pnpm --filter @unipost/client test`: Passed (6/6 tests).
- `pnpm --filter @unipost/sandbox test`: Passed (5/5 tests).
- `pnpm --filter @unipost/console test`: Passed (146/146 tests).

## Walkthrough
Refer to `apps/mobile-ui/doc/walkthrough_19.md`.

## Tasks
- [x] Create useOutboxStore
- [x] Create ConflictResolutionModal
- [x] Wire usePostStore to outbox
- [x] Test suite and workspace verification

## Enhancement
Phase 7 will implement the Backend Public Ingestion Gateway & Publishable Key Protocol (`PublicCmsGatewayController`, `PublishableKeyFilter`).
