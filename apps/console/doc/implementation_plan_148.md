# Implementation Plan - Workstream 6: Unified Sandbox Multi-Branch Execution Simulation

Interactive multi-branch workflow execution simulation for `@unipost/console` and `@unipost/sandbox`. Generates realistic order pipeline execution traces with step-by-step playback, failure injection scenarios (Happy Path, Fraud Rejection, Payment Gateway Timeout, Human Approval Escalation), and live SSE telemetry streaming through browser `EventSource` simulation.

## User-Aligned Architectural Decisions
1. **Trigger & UI Modal**: Dedicated "Simulate Execution" button in `DagHeaderCommandBar` opening `WorkflowSimulationModal` with scenario selection, execution speed controls (1x, 2x, 5x, manual step), and live playback controls.
2. **Unified Sandbox Parity**: Simulation engine hooks and scenario reset registered with `SandboxDock` and `sandboxResetRegistry`.
3. **EventSource Interceptor**: Browser-level `EventSource` interceptor for `sim_order_*` execution streams delivering authentic SSE frames to `useWorkflowExecutionStream`.
4. **DAG Logic Node Compliance**: Normal nodes strictly adhere to single input/output; branching and convergence strictly utilize `FORK_JOIN` and `JOIN` logic nodes.

## Proposed Changes

### 1. Multi-Branch Order Blueprint & Scenario Definition
- Define realistic multi-branch order pipeline in `packages/sandbox/src/handlers/data/simulation-blueprints.ts`:
  - `workflow_start` (START)
  - `->` `validate_order` (SIMPLE)
  - `->` `fork_risk_inventory` (FORK_JOIN)
    - Branch 1: `fraud_check` (SIMPLE)
    - Branch 2: `reserve_inventory` (SIMPLE)
  - `->` `join_risk_inventory` (JOIN)
  - `->` `manager_approval` (HUMAN)
  - `->` `charge_card` (SIMPLE)
  - `->` `dispatch_warehouse` (SIMPLE)
  - `->` `workflow_end` (END)

### 2. Mock EventSource & Simulation Stream Generator
- Create `apps/console/src/features/workflows/sandbox/workflow-simulation-engine.ts`:
  - Intercepts `EventSource` for execution IDs matching `sim_*`.
  - Emits `CONNECTED`, `WORKFLOW_STARTED`, `TASK_IN_PROGRESS`, `TASK_LOG`, `TASK_COMPLETED`, `TASK_FAILED`, `WORKFLOW_COMPLETED`.
  - Supports automated playback with configurable speed and step-by-step stepping.
  - Seamlessly handles Happy Path, Fraud Failure (branch A fails -> join skipped -> execution fails), Payment Timeout, and Manager Approval pause.

### 3. Studio Header & Simulation Modal
- Create `apps/console/src/features/workflows/components/studio/modals/workflow-simulation-modal.tsx`:
  - Liquid Glass modal dialog accessible via WCAG 2.2 AA.
  - Scenario picker with badges and descriptions.
  - Speed selector (`1x`, `2x`, `5x`, `Step-by-Step`).
  - Action buttons: "Start Simulation", "Next Step", "Reset".
- Update `DagHeaderCommandBar.tsx` to add "Simulate" CTA button.
- Wire modal into `visual-dag-studio.tsx`.

### 4. SandboxDock Integration
- Update `apps/console/src/core/sandbox/ui/sandbox-dock.tsx` to include workflow simulation quick-triggers.
- Register reset callback with `sandboxResetRegistry`.

### 5. Automated Verification & Tests
- Write `workflow-simulation-engine.test.ts` covering all scenarios and SSE event dispatches.
- Write `workflow-simulation-modal.test.tsx` verifying UI interactions.
- Run typecheck and full workflow test suite.

## Verification Plan
- `pnpm --filter @unipost/console exec tsc --noEmit`
- `pnpm --filter @unipost/console test -- src/features/workflows`
- Commit with Conventional Commit: `feat(workflows): [190] unified sandbox multi-branch live execution generator`.
