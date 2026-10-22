# Master Integration Plan: Iteration 19
# Workflow Execution & Live Streaming Experience (Full-Stack)

## 1. Executive Summary & Objective
The objective of **Iteration 19** is to transform the **Workflow Execution & Live Streaming Experience** across `@unipost/backend` and `@unipost/console` into an enterprise-grade, real-time observability platform.

Based on our interactive design review (`/grill-me`), both frontend and backend architectural decisions have been resolved and aligned:
- **Backend Non-Blocking Dispatch (Java 21 Loom Virtual Threads)**: `ExecutionStreamBroadcaster` dispatches SSE events asynchronously via `Executors.newVirtualThreadPerTaskExecutor()`, preventing slow SSE HTTP connections from blocking worker execution and API controllers.
- **Server-Side Heartbeat & Task Step Logs**: Periodic 15s `HEARTBEAT` ping preventing proxy/TCP dropouts, plus a dedicated `POST /api/v1/workflow/tasks/{id}/log` endpoint streaming live chunked `TASK_LOG` events.
- **Frontend Split-View / Docked Drawer**: Live terminal logs, payload diffs, and variables dock at the bottom of `VisualDagStudio` in `mode="execution"` without obscuring the canvas.
- **Dynamic Viewport Auto-Tracking**: Smoothly animates the canvas viewport to follow the currently active `IN_PROGRESS` execution node across the DAG, with an on/off toggle.
- **Full Graph Historical State Rollback**: Time-travel scrubbing to step $t_k$ reverts nodes, edges, and variables to that exact historical moment, displaying an amber "HISTORICAL REPLAY" banner with a 1-click "Return to Live HEAD" button.
- **Resilient SSE Reconnect & Fallback**: Dynamic toolbar pill displaying reconnection countdowns with exponential backoff (1s, 2s, 4s, 8s), accompanied by background snapshot polling.
- **Unified Sandbox Multi-Branch Simulation**: A realistic order pipeline (Validation -> Parallel Fraud & Inventory -> Approval -> Payment -> Fulfillment) with step-by-step playback and failure triggers inside `SandboxDock`.

---

## 2. Workstreams & Implementation Breakdown

| Workstream | Scope & Deliverables | Primary Files |
| :--- | :--- | :--- |
| **WS-1: Backend Loom & SSE Broadcaster** | Non-blocking Loom virtual threads executor, 15s heartbeat scheduler, task log endpoint | `ExecutionStreamBroadcaster.java`, `TaskWorkerController.java` |
| **WS-2: Frontend SSE Streaming Engine** | Exponential backoff reconnect, heartbeat detection, buffer deduplication | `use-workflow-execution-stream.ts`, `workflow-api.ts` |
| **WS-3: Canvas Edge & Node FX** | Flow particles on active edges, branch glow, node hover card, auto-pan tracking | `dag-condition-edge.tsx`, `dag-node.tsx`, `visual-dag-studio.tsx` |
| **WS-4: Execution Drawer Console** | Status metrics, filtered terminal log viewer, variable watch, docked split-view | `execution-run-drawer.tsx`, `task-telemetry-inspector.tsx` |
| **WS-5: Time-Travel Sync** | Bi-directional scrubber rollback, variable history replay, amber replay banner | `use-dag-execution-sync.ts`, `workflow-execution-flamegraph.tsx` |
| **WS-6: Unified Sandbox Sim** | Multi-branch mock SSE generator, interactive step controls in dock | `workflows-sandbox-handler.ts`, `sandbox-dock.tsx` |

---

## 3. Verification & Quality Gates
- **Backend Sliced & Unit Tests**:
  ```bash
  ./mvnw test -q -Dtest=WorkflowEngineRestApiTest,WorkflowIteration13ControllersTest
  ```
  Target: 100% green tests covering async Loom broadcasting and log streaming.
- **Console Unit/Component Test Suites**:
  ```bash
  pnpm --filter @unipost/console test -- src/features/workflows/ src/features/workflow-executions/
  ```
  Target: 100% green tests covering SSE lifecycle, auto-pan tracking, time-travel rollback, and canvas styling.
- **TypeScript Strict Compilation**:
  ```bash
  pnpm --filter @unipost/console exec tsc --noEmit
  ```
  Target: 0 errors.
- **Monorepo Lint & Format Checks**: Clean formatting with zero ESLint/Biome violations.
