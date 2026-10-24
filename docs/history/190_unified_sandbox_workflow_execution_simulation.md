# 190. Unified Sandbox Multi-Branch Simulation & Live Execution Generator

## Problem
In offline sandbox mode or local developer environments without an active Spring Boot backend, developers and QA teams need realistic multi-branch workflow execution traces to evaluate DAG canvas edge flows, node telemetry cards, the telemetry drawer, and time-travel replay. Normal task nodes must strictly maintain single-input and single-output invariants, reserving branch splitting and convergence exclusively for logic nodes (`FORK_JOIN` and `JOIN`).

## Plan
1. Design multi-branch order fulfillment blueprint with strict logic node invariants.
2. Define simulation scenario configurations (`HAPPY_PATH`, `FRAUD_REJECTED`, `PAYMENT_TIMEOUT`, `APPROVAL_ESCALATION`).
3. Build `WorkflowSimulationEngine` with browser `EventSource` interceptor and transparent fall-through.
4. Build `WorkflowSimulationModal` with Liquid Glass tokens and wire into `VisualDagStudio` and `DagHeaderCommandBar`.
5. Integrate simulation triggers and reset registry into `SandboxDock` and `src/core/sandbox/index.ts`.
6. Verify topology, degree invariants, and stream event dispatches with comprehensive automated unit tests.

## Changes

### 1. Multi-Branch Order Blueprint
- `apps/console/src/features/workflows/sandbox/simulation-blueprints.ts`: Created `MULTI_BRANCH_ORDER_NODES` and `MULTI_BRANCH_ORDER_EDGES` connecting `validateOrder` -> `forkRiskAndInventory` -> `[fraudCheck, reserveInventory]` -> `joinRiskAndInventory` -> `managerApproval` -> `chargePayment` -> `dispatchWarehouse` -> `workflow_end`.

### 2. Simulation Scenarios & Mock Engine
- `apps/console/src/features/workflows/sandbox/simulation-scenarios.ts`: Defined 4 execution traces with realistic SSE telemetry event payloads and worker IDs.
- `apps/console/src/features/workflows/sandbox/workflow-simulation-engine.ts`: Built singleton simulation engine intercepting `EventSource` for `sim_*` URLs with automated timer intervals, playback speed multipliers, and manual stepping.

### 3. Studio Header & Simulation Modal
- `apps/console/src/features/workflows/components/studio/modals/workflow-simulation-modal.tsx`: Created Liquid Glass modal dialog for scenario selection and live playback controls.
- `apps/console/src/features/workflows/components/studio/toolbar/dag-header-command-bar.tsx`: Added `onSimulate` prop and "Simulate" CTA button.
- `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`: Integrated simulation modal, loading multi-branch blueprint nodes on launch.

### 4. Sandbox Platform Integration
- `apps/console/src/core/sandbox/ui/sandbox-dock.tsx`: Added "Workflows" tab to `SandboxDock` with scenario quick-triggers, reset, and step actions.
- `apps/console/src/core/sandbox/index.ts`: Exported `workflowSimulationEngine` and installed interceptor on dev boot.

### 5. Automated Verification
- `apps/console/src/features/workflows/__tests__/workflow-simulation-engine.test.ts`: Added unit tests for Kahn topology verification, in/out degree logic node validation, SSE event emission, and pause/resume.
- `apps/console/src/features/workflows/__tests__/workflow-simulation-modal.test.tsx`: Added tests for scenario options and simulation launch.

## Verification
- `pnpm --filter @unipost/console exec tsc --noEmit`: 0 errors.
- `pnpm --filter @unipost/console test -- src/features/workflows src/core/sandbox`: 33 test files, 165 tests passed (100% green).

## Walkthrough
- Documented in `apps/console/doc/walkthrough_148.md`.
