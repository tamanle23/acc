# 193 - Iteration 20: Enterprise Workflow Orchestration Engine Resilience

## Problem
The workflow orchestration engine required hardening across 5 critical dimensions to attain enterprise-grade resilience:
1. Pure Decider Zero-I/O Violation: Decider strategies were executing synchronous I/O, HTTP requests, and direct DB queries within the decider evaluation loop.
2. Dynamic Fork Fan-In Join: Dynamic forks did not enforce a barrier join on all dynamic children, risking premature workflow progression.
3. DLQ Interactive Replay: Failed tasks in the Dead Letter Queue could not be interactively repaired in-place and re-dispatched while preserving `executionId`.
4. Visual DAG Auto-Layout: The studio canvas only had a basic topological grid layout without professional layered (Dagre) or high-density compaction (ELK) strategy options.
5. Verification & Parity: Automated tests and Unified Sandbox offline simulation handlers needed full parity for in-place replays.

## Plan
Execute all 5 workstreams of `docs/integration_master_plan_iteration20.md`:
- Workstream 1: Purge I/O from decider strategies to reserved system queues (`system:http`, `system:mcp`, `system:llm`, `system:jdbc`, `system:kafka`). Build `SystemTaskWorkerPool` using Java 21 Loom virtual threads.
- Workstream 2: Implement barrier synchronization in `DynamicForkStrategy`, setting parent to `IN_PROGRESS` until all dynamic child tasks terminate, with fail-fast propagation and child output aggregation.
- Workstream 3: Implement backend `/replay` endpoint preserving `executionId`. Build frontend `TaskRepairReplayDialog` with `VisualJsonEditor` and integrate with `ExecutionRunDrawer` and `TaskTelemetryInspector`.
- Workstream 4: Implement `DagLayoutEngineStrategy` supporting `DagreRankLayoutStrategy` and `ElkCompactLayoutStrategy` with toolbar switcher in `dag-header-command-bar.tsx`.
- Workstream 5: Automated test coverage, typechecks, and Unified Sandbox route handler parity.

## Changes
- **Backend Core Decider**:
  - `HttpNodeStrategy.java`, `CallMcpToolStrategy.java`, `LlmChatCompleteStrategy.java`, `JdbcNodeStrategy.java`, `KafkaPublishStrategy.java`: Purged synchronous I/O; now pure schedulers targeting system domain queues.
  - `DynamicForkStrategy.java`: Barrier synchronization, fail-fast child error handling, output aggregation.
  - `PureDecider.java`: Error reason propagation from child task failure.
  - `InMemoryPersistenceAdapter.java`: Wildcard `*` taskType matching support.
  - `WorkflowExecutionController.java`: Mapped `/tasks/{taskId}/replay` and `/tasks/{taskRef}/rerun`.
  - `SystemTaskWorkerPool.java`: Loom virtual-thread worker fleet polling and executing system tasks.
- **Frontend Console & Visual Studio**:
  - `apps/console/src/features/workflows/components/studio/utils/layout/`: `dag-layout-strategy.ts`, `dagre-rank-layout-strategy.ts`, `elk-compact-layout-strategy.ts`, `index.ts`.
  - `use-dag-studio-state.ts`: Strategy-driven auto-layout state & delegation.
  - `dag-header-command-bar.tsx`: Split button with dropdown for layout algorithm and direction selection.
  - `visual-dag-studio.tsx`: Wired layout selection and inspector replay handlers.
  - `task-repair-replay-dialog.tsx`: Modal dialog with `VisualJsonEditor` for DLQ interactive repair & replay.
  - `execution-run-drawer.tsx`: Added DLQ action banner for failed tasks.
  - `task-telemetry-inspector.tsx`: Added direct DLQ replay action in failure banner.
  - `workflow-api.ts`: Exported `useReplayWorkflowTask`.
- **Unified Sandbox**:
  - `packages/sandbox/src/handlers/workflow-handler.ts`: Supported both `/rerun` and `/replay` with synthesized snapshot fallback.

## Verification
- Backend tests: `PureDeciderTest,NodeStrategiesTest,MediumFrequencyTaskStrategiesTest,LowFrequencyTaskStrategiesTest,SystemTaskWorkerPoolTest` -> Exited 0 (All passed).
- Frontend tests: `dag-layout-strategy.test.ts` (7/7 passed), `execution-run-drawer.test.tsx` (6/6 passed).
- Sandbox tests: `workflow-sandbox-handler.test.ts` (94/94 passed).
- TypeScript: `pnpm --filter @acc/console exec tsc --noEmit` -> 0 errors.
- Sandbox TypeScript: `pnpm --filter @acc/sandbox exec tsc --noEmit` -> 0 errors.

## Walkthrough
Refer to `apps/console/doc/walkthrough_151.md` for full implementation walkthrough and screenshots/behavioral blueprints.

## Tasks
- [x] Workstream 1: Pure Zero-I/O Decider & Loom System Task Worker Fleet
- [x] Workstream 2: Dynamic Fork Barrier Synchronization & Fan-In Join
- [x] Workstream 3: End-to-End DLQ Interactive Replay & Partial Task Reruns
- [x] Workstream 4: Studio Auto-DAG Layout Strategy Pattern & High-Density Compaction
- [x] Workstream 5: Verification, Sliced Testcontainers & Dual-Mode E2E Compatibility

## Enhancement
Future iterations may expose custom weight parameters in the ELK compaction algorithm for hierarchical clustering and multi-parent grouping.
