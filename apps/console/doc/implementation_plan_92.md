# Implementation Plan 92: Visual React Flow Studio, Unified Sandbox Simulator & Chaos Replay Suite (Phase 30)

## 1. Overview
Execute **Phase 30** of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/integration_master_plan_iteration_3.md):
- **Part 1: Visual Workflow Studio in `@unipost/console`**:
  - Implement Conductor node types: `SIMPLE`, `SWITCH`, `FORK_JOIN`, `WAIT`, `DO_WHILE` with multi-directional ports and Liquid Glass visual aesthetics.
  - Interactive property inspectors for input bindings, retry backoffs, and condition expressions.
  - Live execution monitoring overlay: nodes dynamically color-coded by execution state (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `TIMED_OUT`) with real-time log drawer.
  - Dagre / algorithmic auto-layout with animated layout transitions.
- **Part 2: Unified Sandbox Simulator (`@unipost/sandbox` & `@unipost/console`)**:
  - Implement `workflowSandboxHandler` registered in `sandboxRegistry`.
  - In-memory simulation of decider cycles, task leases, and mock worker polling.
  - Full integration with `SandboxDock` state resets and active tenant switching.
- **Part 3: Chaos Verification & Golden Trace Replay Suite (`apps/backend/workflow-engine`)**:
  - `GoldenTraceReplayTest.java`: Replays historical execution traces against `PureDecider` verifying deterministic outputs.
  - `ChaosWorkflowIntegrationTest.java`: 100 concurrent workflow executions with simulated random worker terminations and lease expiration recoveries.
- **Part 4: Verification Gate 30**:
  - Vitest component tests in `@unipost/console`.
  - Maven tests in `apps/backend/workflow-engine` (100% pass).
  - Clean production typecheck & lint.

## 2. Invariants Followed
- **ZERO-IO-PURE-DECIDER**: `GoldenTraceReplayTest` guarantees 100% deterministic decision outputs without system clock or I/O dependency.
- **UNIFIED-SANDBOX-PLATFORM**: Registered through `sandboxRegistry.register(workflowSandboxHandler)` with tenant isolation and `reset()` support.
- **LIQUID-GLASS-UI**: Frosted backdrop blur, specular borders, and high contrast compliant with WCAG 2.2 AA.
