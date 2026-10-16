# Implementation Plan - Phase 40: Visual Time-Travel Execution Replay, Worker Fleet Telemetry & Chaos Verification

Deliver full operational transparency and high-concurrency resilience for Unipost Workflows through a strictly read-only visual time-travel execution replay engine with microsecond state projection, a side-by-side variable diff inspector, a Sovereign Polyglot Worker Fleet Dashboard (`/system/workers`), and a 1,000-concurrent chaos engineering test suite.

---

## 1. User Review Required

> [!NOTE]
> - **Strictly Read-Only Time-Travel**: Time-Travel is designed purely for zero-risk inspection, post-mortem audits, and root-cause debugging. Mutation actions (like forking or editing runtime state) are decoupled and excluded from this phase.
> - **Live SSE Concurrency**: When an operator scrubs backward on an actively running execution, historical inspection freezes at the selected microsecond while incoming SSE events buffer in the background with a floating badge (`● N new events · Jump to Live`).
> - **Sovereign System Route**: The Worker Fleet Dashboard is mounted at `/system/workers` under Sovereign Custody (`_authenticated/system.workers.tsx`), alongside `/system/dlq`, styled with Liquid Glass tokens and full Unified Sandbox mock parity.
> - **Worker Fleet Telemetry & Drain**: Polyglot workers (Java Virtual Threads and Node.js) register and heartbeat at `POST /api/v1/workflow/workers/heartbeat`. Operators can trigger a graceful Drain action.

---

## 2. Proposed Changes & Architecture

### Backend (`apps/backend/unipost-ms-aio` & `workflow-engine`)

#### Worker Registry & Telemetry Service
- **`com.unipost.aio.worker.WorkerRegistry`**:
  - In-memory thread-safe registry tracking active worker nodes (with automatic transition if heartbeat age > 15s `DEGRADED`, > 30s `OFFLINE`).
  - Worker entity: `workerId`, `hostIp`, `runtime` (`JAVA_VIRTUAL_THREADS`, `NODEJS_WORKER`), `pollDomains`, `concurrencyLimit`, `activeLeases`, `tasksCompletedCount`, `errorCount`, `uptimeSeconds`, `lastHeartbeatEpochMs`, `status` (`HEALTHY`, `DEGRADED`, `OFFLINE`, `DRAINING`).
- **`com.unipost.aio.controller.workflow.WorkerFleetController`**:
  - `GET /api/v1/workflow/workers`: Query registered workers with status and runtime filtering.
  - `POST /api/v1/workflow/workers/heartbeat`: Register or refresh worker heartbeat telemetry.
  - `POST /api/v1/workflow/workers/{workerId}/drain`: Request graceful worker drain (stop polling new tasks, allow active leases up to 30s grace).

#### Chaos & Stress Verification Test Suite
- **`com.unipost.workflow.chaos.WorkflowChaosStressVerificationTest`**:
  - Uses Java 21 Virtual Threads (`Executors.newVirtualThreadPerTaskExecutor()`).
  - Runs 1,000 concurrent workflow executions through the PureDecider and task queue.
  - Injects simulated worker crash mid-lease: asserts lease sweeper reclaims tasks without state corruption.
  - Injects downstream node failures on 200 runs: asserts reverse Saga compensation executes in strict reverse topological order for 100% of affected executions.
  - Verifies append-only SHA-256 audit ledger hash chain integrity for all 1,000 executions.

---

### Frontend (`apps/console`)

#### Visual Time-Travel Scrubber & Canvas Illumination
- **`apps/console/src/features/workflows/components/execution-time-travel-scrubber.tsx`**:
  - Mounted along the bottom edge of the DAG canvas during execution inspection.
  - Controls: Slider bar, step forward/backward buttons, play/pause controls ($0.5\times, 1.0\times, 2.0\times, 5.0\times$), microsecond timestamps.
  - Live buffer indicator: `● N new events · Jump to Live` floating pill when viewing history on active executions.
  - Canvas illumination controller: dynamically projects node status (`COMPLETED`, `IN_PROGRESS`, `PENDING`, `FAILED`) corresponding to the selected historical millisecond.

#### Side-by-Side Variable Diff Inspector
- **`apps/console/src/features/workflows/components/payload-diff-viewer.tsx`**:
  - Integrated as a dedicated tab inside `ExecutionRunDrawer` (`apps/console/src/features/workflows/components/execution-run-drawer.tsx`).
  - Compares Step $N$ vs Step $N-1$ variable snapshots.
  - Features a toggle:
    - **"Show Only Changes"**: Compact view showing only added keys (emerald), mutated values (amber with before/after), and removed keys (rose).
    - **"Show Full Snapshot"**: Complete JSON tree with inline highlight badges on modified fields.

#### Polyglot Worker Fleet Dashboard (`/system/workers`)
- **`apps/console/src/features/workers/`**:
  - `index.tsx`: Sovereign Custody view with Liquid Glass styling and `ROOT` badge.
  - `components/worker-fleet-grid.tsx`: Metric summary cards (Total Workers, Active Leases, Throughput Tasks/sec, Healthy/Degraded/Offline counts).
  - `components/worker-card.tsx`: Individual worker cards with live heartbeat indicator, runtime badge (`Java Virtual Threads` vs `Node.js Worker`), CPU/queue meters, and Drain action.
  - `components/worker-chaos-panel.tsx`: Interactive chaos injection triggers in dev/sandbox mode (Simulate Dropout, Inject Latency, Trigger Poison Burst).
  - `hooks/use-worker-fleet.ts`: Auto-polling/SSE hook for worker telemetry.
  - `api/worker-fleet-api.ts`: Typed REST client.
- **`apps/console/src/routes/_authenticated/system.workers.tsx`**:
  - TanStack router definition for `/system/workers`.
- **Navigation & i18n Synchronization**:
  - Register `/system/workers` in `sidebar-data.ts`.
  - Add translations in `packages/i18n/src/locales/en/common.json` and `packages/i18n/src/locales/vi/common.json`.

#### Unified Sandbox Parity
- **`apps/console/src/core/sandbox/handlers/worker-sandbox-handler.ts`**:
  - Implements `SandboxRouteHandler` for `GET /api/v1/workflow/workers`, `POST /api/v1/workflow/workers/heartbeat`, `POST /api/v1/workflow/workers/:id/drain`.
  - Registered in `apps/console/src/core/sandbox/index.ts` with initial polyglot worker fleet mock data.

---

## 3. Verification Plan

### Automated Tests
1. **Frontend Vitest Suite**:
   - `pnpm --filter @unipost/console test -- run src/features/workflows/components/__tests__/execution-time-travel-scrubber.test.tsx`
   - `pnpm --filter @unipost/console test -- run src/features/workflows/components/__tests__/payload-diff-viewer.test.tsx`
   - `pnpm --filter @unipost/console test -- run src/features/workers/__tests__/worker-fleet.test.tsx`
2. **Backend JUnit / Maven Suite**:
   - `mvn test -pl apps/backend/unipost-ms-aio -Dtest=WorkerFleetControllerTest,WorkflowChaosStressVerificationTest -q`
3. **End-to-End Build & Lint Integrity**:
   - `pnpm --filter @unipost/console check-types`
   - `pnpm --filter @unipost/console build`
