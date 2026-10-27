# History Log 059: Mobile UI Outbox Chaos Hardening & Component Testing (Phase 20)

**Date**: 2026-10-14  
**Scope**: `apps/mobile-ui`  
**Phase**: 20 (Iteration 2 Master Plan)

---

## 1. Problem Statement
The mobile client's offline outbox pipeline needed stress testing and hardening against real-world chaos conditions:
1. **Network severance during bulk mutations**: Ensuring 50+ concurrent offline actions are safely stored in durable local storage (`AsyncStorage`) without data loss or memory leaks.
2. **Thundering-herd mitigation**: The outbox previously retried failed mutations immediately on every sync cycle, lacking exponential backoff and jitter.
3. **Sequential FIFO replay**: On reconnect, all mutations must be replayed in deterministic creation order.
4. **Idempotency preservation**: Retries must preserve `Idempotency-Key` and `Client-Transaction-Id` to guarantee at-most-once processing on the server.
5. **OCC 409 conflict resolution**: Verifying the 3-way conflict modal flow (`KEEP_LOCAL`, `ACCEPT_SERVER`, `CUSTOM_MERGE`).
6. **Component test coverage**: Verifying validation, disabled states, relation pickers, and media pickers in `DynamicFieldRenderer`.

---

## 2. Plan
1. **Exponential backoff with equal jitter**:
   - Update `apps/mobile-ui/src/store/useOutboxStore.ts` with `nextRetryAt` scheduling on `FAILED` jobs.
   - Implement `computeBackoffMs(retries, random)` with equal-jitter algorithm: `exp = min(cap, base * 2^(retries - 1)); round(exp/2 + random() * exp/2)`.
   - Skip jobs still inside their backoff window during `processOutbox`.
2. **Chaos test suite (`outbox-chaos.test.ts`)**:
   - Test 1: Bounded exponential backoff growth and jitter bounds.
   - Test 2: Network severance with 50 queued mutations, verification of durable `AsyncStorage` persistence, backoff window skip, and sequential FIFO replay.
   - Test 3: Header idempotency preservation across multiple retry attempts.
   - Test 4: OCC 409 conflict interception, server state capture, and 3-way resolution (`CUSTOM_MERGE` and `ACCEPT_SERVER`).
3. **Component test expansion (`dynamic-form.test.ts`)**:
   - Hardening `DynamicFieldRenderer`, `MediaPickerInput`, and `RelationPickerBottomSheet` for validation errors, disabled states, and selection events.
4. **Verification & git commit**:
   - Run vitest suite across `mobile-ui`.
   - Stage and commit only Phase 20 files.

---

## 3. Changes Made

### `apps/mobile-ui/src/store/useOutboxStore.ts`
- Added `nextRetryAt?: number` to `OutboxMutationJob` interface.
- Exported constants `BACKOFF_BASE_MS = 1000` and `BACKOFF_CAP_MS = 300000`.
- Exported `computeBackoffMs(retries, random)` supporting testable injected pseudo-random generators.
- In `processOutbox()`:
  - Added skip check: `if (job.status === 'FAILED' && job.nextRetryAt !== undefined && job.nextRetryAt > Date.now()) continue;`.
  - On failure, updated job status to `FAILED` and calculated `nextRetryAt: Date.now() + computeBackoffMs(j.retries + 1)`.

### `apps/mobile-ui/src/__tests__/outbox-chaos.test.ts`
- Created dedicated chaos test file with 5 comprehensive test cases covering:
  - Backoff mathematical bounds and jitter range.
  - 50-mutation queue network drop, durable storage verification, and reconnect sequential replay.
  - Idempotency key preservation across retry attempts.
  - 3-way conflict merge (`CUSTOM_MERGE`) with server payload matching.
  - Server state acceptance (`ACCEPT_SERVER`) with local discarding.

### `apps/mobile-ui/src/__tests__/dynamic-form.test.ts`
- Added tests verifying:
  - `DynamicFieldRenderer` error display, disabled states, and required flags.
  - `DynamicFieldRenderer` handling of `RELATION` data types and `relation_picker` uiComponent.
  - `MediaPickerInput` disabled state, required flag, and error styling props.
  - `RelationPickerBottomSheet` empty-list rendering, search query filtering, and selection callbacks.

---

## 4. Verification
- Ran `pnpm --filter mobile-ui test`:
  - 4 test files passed (`outbox-store.test.ts`, `outbox-chaos.test.ts`, `mobile-sandbox.test.ts`, `dynamic-form.test.ts`).
  - Total 23 unit & chaos tests passed cleanly in 482ms.
- Existing pre-commit / workspace integrity maintained without modifying other ongoing workstreams.

---

## 5. Next Steps
- **Phase 21**: Electrobun Desktop Console Native Bridge & Security Hardening.
- **Phase 22**: Visual Schema Studio & Entity FSM Workflow Canvas.
