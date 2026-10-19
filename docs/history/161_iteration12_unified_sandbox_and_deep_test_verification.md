# 161. Iteration 12: Unified Sandbox Integration, Resilient SSE Reconnection & Deep Test Verification

**Date:** 2026-10-20  
**Status:** Complete  
**Scope:** `@unipost/console`, `@unipost/backend` (`unipost-fw`)  

---

## 1. Problem
During skeptical code review and adversarial test probing of the Iteration 12 implementation, four critical gaps were identified:
1. **Unified Sandbox Mandate Violation & Rogue Mocks**: `ApprovalsInbox` embedded hardcoded in-component mock data (`INITIAL_MOCK_APPROVALS`) directly in `approvals-inbox.tsx` and manipulated local React state without an API layer, violating `.agents/rules/02-unified-sandbox.md`. No approval sandbox handler was registered in `apps/console/src/core/sandbox/`.
2. **Missing SSE Reconnection Resilience**: When the SSE connection to `/api/v1/notifications/stream` was interrupted, `ApprovalsInbox` simply marked `sseConnected = false` without any automatic reconnection backoff retry.
3. **No-Any & Accessibility Violations**: `dlq-inspector-sheet.tsx` had `catch (err: any)` in override JSON parsing and unused imports, as well as a non-interactive tabIndex on a scroll region. In `approvals-inbox.tsx`, hooks were conditionally invoked and synchronous setState occurred inside an effect.
4. **Untested Backend Components**:
   - `MetadataService.seekEntityRecords()` had 0 unit test coverage.
   - `FieldLevelSecuritySerializer` had 0 unit test coverage for role-based PII redactions.
   - `NotificationSseController` had 0 unit test coverage for emitter lifecycle and heartbeat.
   - `EntityWorkflowTriggerDispatcher` had 0 unit test coverage for mutation event dispatch.

---

## 2. Plan
1. Create `approvals-sandbox-handler.ts` with `approvalTaskMockStore` implementing `SandboxRouteHandler` (`priority: 110`), wired to `sandboxResetRegistry`.
2. Register `approvalsSandboxHandler` in `apps/console/src/core/sandbox/index.ts`.
3. Add typed `useApprovalTasks()` and `useResolveApprovalTask()` hooks in `workflow-api.ts`.
4. Refactor `ApprovalsInbox` to call hooks unconditionally, derive state with `useMemo` without `set-state-in-effect`, and implement automatic SSE stream reconnection on error.
5. Fix `dlq-inspector-sheet.tsx` strict typing and accessibility issues.
6. Write unit tests for `seekEntityRecords` in `MetadataServiceTest.java`.
7. Write unit tests for `FieldLevelSecuritySerializerTest.java`, `NotificationSseControllerTest.java`, and `EntityWorkflowTriggerDispatcherTest.java`.
8. Re-verify with full clean test suites across backend and console.

---

## 3. Changes Made

### Frontend (`@unipost/console`)
- `apps/console/src/core/sandbox/handlers/approvals-sandbox-handler.ts`: Implemented `approvalsSandboxHandler` (`priority: 110`) and `approvalTaskMockStore` with tenant partitioning, reset registration, and handlers for `GET /v1/workflows/approvals` and `POST /v1/workflows/approvals/:id/resolve`.
- `apps/console/src/core/sandbox/index.ts`: Registered `approvalsSandboxHandler` in `sandboxRegistry`.
- `apps/console/src/features/workflows/api/workflow-api.ts`: Added `useApprovalTasks()` query and `useResolveApprovalTask()` mutation hooks.
- `apps/console/src/features/workflows/approvals/approvals-inbox.tsx`: Replaced rogue in-component mock array with derived state from query and mock store, optimistic resolution updates, and resilient SSE auto-reconnect with 5s backoff timer.
- `apps/console/src/features/workflows/approvals/__tests__/approvals-inbox.test.tsx`: Expanded test suite covering rendering, optimistic approval, rejection rationale dialog, search filtering, SSE task reception, and reconnection handling.
- `apps/console/src/features/dlq/components/dlq-inspector-sheet.tsx`: Fixed catch block strict typing, removed unused imports, removed non-interactive tabIndex.

### Backend (`@unipost/backend`)
- `apps/backend/unipost-fw/src/test/java/com/unipost/service/MetadataServiceTest.java`: Added 5 unit tests for `seekEntityRecords` covering first page seek, Base64 cursor seek, ISO 8601 timestamp cursor parsing, malformed cursor fallback, and entity type not found.
- `apps/backend/unipost-fw/src/test/java/com/unipost/service/metadata/serialization/FieldLevelSecuritySerializerTest.java`: Created 7 tests for ADMIN, OPERATOR, VIEWER role masking, PII pattern detection, and operator truncation.
- `apps/backend/unipost-fw/src/test/java/com/unipost/presentation/NotificationSseControllerTest.java`: Created 5 tests for SSE streaming handshake, tenant/SYSTEM broadcast, scheduled heartbeats, and emitter removal.
- `apps/backend/unipost-fw/src/test/java/com/unipost/service/workflow/EntityWorkflowTriggerDispatcherTest.java`: Created 4 tests for mutation event dispatch, approval triggers, and state change broadcasts.

---

## 4. Verification Record
- **Console Unit Suites**: `pnpm --filter @unipost/console test:run` -> **70 files passed, 327 tests passed (100% pass)**.
- **Console TypeScript Check**: `pnpm --filter @unipost/console exec tsc --noEmit` -> **0 errors**.
- **Console ESLint**: `npx eslint ...` -> **0 errors, 0 warnings**.
- **Backend Targeted Domain Tests**: `node mvnw.cjs test -pl unipost-fw` -> **90/90 tests passed (100% pass, 0 failures, 0 errors)**.
- **Backend Full Clean Suite**: `node mvnw.cjs clean test -q` -> **BUILD SUCCESS across all 10 modules**.
- **Performance Benchmark**: `CompositeQueryPerformanceBenchmarkTest` -> **67,894 req/sec, p50: 0.097ms, p99: 1.358ms, 0.00% failure rate**.
