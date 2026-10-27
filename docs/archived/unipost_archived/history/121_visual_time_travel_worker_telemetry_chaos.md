# History Log 121: Visual Time-Travel Execution Replay, Worker Fleet Telemetry & Chaos Verification

**Date:** 2026-10-16  
**Phase:** Phase 40 (Master Plan Iteration 5)  
**Status:** Completed  
**Author:** Lead Systems Architect & Full-Stack Engineer  

---

## 1. Problem Statement
Distributed DAG workflows running in production are notoriously difficult to debug after terminal failure:
- Inspecting thousands of lines of execution logs obscures the exact point of failure and variable mutations.
- Prior to Phase 40, operators had no visual slider mechanism to step backward in time to inspect earlier node states and memory snapshots without re-executing non-idempotent tasks.
- The platform lacked a centralized, real-time telemetry dashboard to monitor polyglot worker instances (Java 21 Virtual Threads and Node.js `@acc/worker` hosts), their active lease loads, and health states.
- High-concurrency resilience under worker crashes and cascading Saga rollbacks had not been empirically validated under extreme load (1,000 parallel executions).

---

## 2. Plan & Architecture
1. **Visual Time-Travel Replay (`ExecutionTimeTravelScrubber`)**:
   - Provide discrete microsecond slider controls ($0.5\times, 1.0\times, 2.0\times, 5.0\times$, step forward/back).
   - Buffer incoming live SSE events in the background when scrubbing backward on active runs (`● N new events · Jump to Live`).
   - Project historical states dynamically to canvas nodes (`COMPLETED`, `IN_PROGRESS`, `FAILED`, `PENDING`).
2. **Variable & Payload Diff Inspector (`PayloadDiffViewer`)**:
   - Mount as a dedicated "Variable Diff" tab in `ExecutionRunDrawer`.
   - Calculate added (emerald), modified with before/after (amber), and removed (rose) keys between Step $N$ and $N-1$.
   - Provide toggle between "Show Only Changes" and "Show Full Snapshot".
3. **Polyglot Worker Fleet Dashboard (`/system/workers`)**:
   - Mount under Sovereign Custody with `ROOT` badge.
   - Real-time telemetry monitoring Java Virtual Thread and Node.js workers.
   - Metrics tiles: Total Workers, Active Leases, Throughput, Health breakdown.
   - Graceful "Drain Worker" action.
   - Unified Sandbox Platform parity with `workerSandboxHandler` and stateful reset.
4. **1,000-Concurrent Chaos Engineering Test Suite**:
   - JUnit 5 stress test executing 1,000 concurrent workflows.
   - Worker crash mid-lease simulation: assert lease sweeper reclaims tasks without dropped executions.
   - Cascading Saga fault injection on 200 runs: assert reverse topological compensation order.

---

## 3. Changes
- `apps/console/src/features/workflows/components/execution-time-travel-scrubber.tsx`: Visual timeline scrubber with live event buffer badge.
- `apps/console/src/features/workflows/components/payload-diff-viewer.tsx`: Side-by-side variable and payload diff inspector.
- `apps/console/src/features/workflows/components/execution-run-drawer.tsx`: Added "Variable Diff" tab.
- `apps/console/src/features/workers/`: Worker Fleet Dashboard feature, metrics, worker card, chaos panel, and API client.
- `apps/console/src/routes/_authenticated/system.workers.tsx`: TanStack route definition for `/system/workers`.
- `apps/console/src/components/layout/data/sidebar-data.ts`: Registered Worker Fleet in Sovereign Custody navigation.
- `apps/console/src/locales/en/console.json` & `vi/console.json`: Added `workerFleet` translation keys.
- `apps/console/src/core/sandbox/handlers/worker-sandbox-handler.ts`: Unified Sandbox route handler.
- `apps/console/src/core/sandbox/index.ts`: Registered handler in `sandboxRegistry`.
- `apps/backend/acc-ms-aio/.../workflow/WorkerRegistry.java`: Thread-safe worker registry with heartbeat aging.
- `apps/backend/acc-ms-aio/.../workflow/WorkerFleetController.java`: REST API for worker fleet querying, heartbeats, and drain.
- `apps/console/src/features/workflows/components/__tests__/execution-time-travel-scrubber.test.tsx`: Vitest suite for scrubber.
- `apps/console/src/features/workflows/components/__tests__/payload-diff-viewer.test.tsx`: Vitest suite for diff viewer.
- `apps/console/src/features/workers/__tests__/worker-fleet.test.tsx`: Vitest suite for worker fleet dashboard and sandbox.
- `apps/backend/acc-ms-aio/.../workflow/WorkerFleetControllerTest.java`: Backend JUnit 5 test for worker endpoints.
- `apps/backend/acc-ms-aio/.../workflow/WorkflowChaosStressVerificationTest.java`: 1,000-concurrent stress test suite.

---

## 4. Verification
- **Vitest Suite**: 11/11 tests passing across scrubber, diff viewer, and worker fleet components.
- **TypeScript Typecheck**: `pnpm --filter @acc/console exec tsc --noEmit` exited 0 with zero errors.
- **Backend Test Suite**: 5/5 JUnit 5 tests passing in `acc-ms-aio` (including 1,000 concurrent executions with worker crash lease reclamation and 200 cascading Saga rollbacks).

---

## 5. Walkthrough
- [apps/console/doc/walkthrough_109.md](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/walkthrough_109.md)

---

## 6. Tasks & Enhancements
- Next iteration: Phase 41 / Iteration 5 wrap-up and end-to-end telemetry federation.
