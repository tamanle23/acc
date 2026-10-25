# Master Integration Plan: Iteration 19
# Workflow Execution & Live Streaming Experience (Full-Stack)

## 1. Executive Summary & Objective
The objective of **Iteration 19** is to transform the **Workflow Execution & Live Streaming Experience** across `@acc/backend` and `@acc/console` into an enterprise-grade, real-time observability platform.

Based on our interactive design review (`/grill-me`), both frontend and backend architectural decisions have been resolved and aligned:
- **Backend Non-Blocking Dispatch (Java 21 Loom Virtual Threads)** [COMPLETED]: `ExecutionStreamBroadcaster` dispatches SSE events asynchronously via `Executors.newVirtualThreadPerTaskExecutor()`, preventing slow SSE HTTP connections from blocking worker execution and API controllers.
- **Server-Side Heartbeat & Task Step Logs** [COMPLETED]: Periodic 15s `HEARTBEAT` ping preventing proxy/TCP dropouts, plus a dedicated `POST /api/v1/workflow/tasks/{id}/log` endpoint streaming live chunked `TASK_LOG` events.
- **Frontend Real-Time SSE Stream & State Sync (WS-2)**:
  - Connection health state machine (`IDLE` -> `CONNECTING` -> `LIVE` -> `RECONNECTING` -> `POLLING_FALLBACK` -> `DISCONNECTED`), tracking `retryAttempt` (1..5), `nextRetryDelayMs`, and `lastHeartbeatTimestamp`.
  - Structured ingestion of `TASK_LOG` events (`workerId`, `taskReferenceName`, `taskId`, `level`, `message`, `raw`, `timestamp`).
  - High-performance in-memory circular ring buffer (up to 1,000 items) with `requestAnimationFrame` micro-batching (50ms window) to prevent React frame drops, with async IndexedDB/sessionStorage spooling for full session history.
- **Dynamic Viewport Auto-Tracking**: Smoothly animates the canvas viewport to follow the currently active `IN_PROGRESS` execution node across the DAG, with an on/off toggle.
- **Full Graph Historical State Rollback**: Time-travel scrubbing to step $t_k$ reverts nodes, edges, and variables to that exact historical moment, displaying an amber "HISTORICAL REPLAY" banner with a 1-click "Return to Live HEAD" button.
- **Unified Sandbox Multi-Branch Simulation**: A realistic order pipeline (Validation -> Parallel Fraud & Inventory -> Approval -> Payment -> Fulfillment) with step-by-step playback and failure triggers inside `SandboxDock`.

---

## 2. Workstreams & Implementation Breakdown

| Workstream | Scope & Deliverables | Primary Files | Status |
| :--- | :--- | :--- | :--- |
| **WS-1: Backend Loom & SSE Broadcaster** | Non-blocking Loom virtual threads executor, 15s heartbeat scheduler, task log endpoint | `ExecutionStreamBroadcaster.java`, `TaskWorkerController.java` | **COMPLETED** (Commit `[a22f145]`) |
| **WS-2: Frontend SSE Streaming Engine** | Exponential backoff reconnect, rAF micro-batching, structured ring buffer, heartbeat detection | `use-workflow-execution-stream.ts`, `workflow-api.ts` | **READY FOR EXECUTION** |
| **WS-3: Canvas Edge & Node FX** | Flow particles on active edges, branch glow, node hover card, auto-pan tracking | `dag-condition-edge.tsx`, `dag-node.tsx`, `visual-dag-studio.tsx` | Pending |
| **WS-4: Execution Drawer Console** | Status metrics, filtered terminal log viewer, variable watch, docked split-view | `execution-run-drawer.tsx`, `task-telemetry-inspector.tsx` | Pending |
| **WS-5: Time-Travel Sync** | Bi-directional scrubber rollback, variable history replay, amber replay banner | `use-dag-execution-sync.ts`, `workflow-execution-flamegraph.tsx` | Pending |
| **WS-6: Unified Sandbox Sim** | Multi-branch mock SSE generator, interactive step controls in dock | `workflows-sandbox-handler.ts`, `sandbox-dock.tsx` | Pending |

---

## 3. Verification & Quality Gates
- **Backend Sliced & Unit Tests**:
  ```bash
  node ./apps/backend/mvnw.cjs test -pl acc-ms-aio -Dtest=WorkflowEngineRestApiTest,WorkflowIteration13ControllersTest
  ```
  Target: 100% green tests (3/3 passed).
- **Console Unit/Component Test Suites**:
  ```bash
  pnpm --filter @acc/console test -- src/features/workflows/ src/features/workflow-executions/
  ```
  Target: 100% green tests covering SSE lifecycle, auto-pan tracking, time-travel rollback, and canvas styling.
- **TypeScript Strict Compilation**:
  ```bash
  pnpm --filter @acc/console exec tsc --noEmit
  ```
  Target: 0 errors.
- **Monorepo Lint & Format Checks**: Clean formatting with zero ESLint/Biome violations.
