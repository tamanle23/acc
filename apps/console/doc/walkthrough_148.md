# Walkthrough - Workstream 6: Unified Sandbox Multi-Branch Execution Simulator

Interactive multi-branch workflow execution simulation engine, high-fidelity browser `EventSource` stream interceptor, and Liquid Glass simulation modal dialog for `@unipost/console` and `@unipost/sandbox`.

## Changes Summary

### 1. Multi-Branch Order Blueprint with Strict Logic Nodes
- Created `apps/console/src/features/workflows/sandbox/simulation-blueprints.ts`.
- Implemented `MULTI_BRANCH_ORDER_NODES` and `MULTI_BRANCH_ORDER_EDGES`:
  - `validateOrder` (SIMPLE) -> `forkRiskAndInventory` (**FORK_JOIN** logic node).
  - Parallel Branch A: `fraudCheck` (SIMPLE AI Risk Screening).
  - Parallel Branch B: `reserveInventory` (SIMPLE Warehouse Stock Reservation).
  - Convergence: `joinRiskAndInventory` (**JOIN** logic barrier).
  - Downstream: `managerApproval` (HUMAN) -> `chargePayment` (SIMPLE) -> `dispatchWarehouse` (SIMPLE) -> `workflow_end` (END).
  - Invariant strictly upheld: normal tasks have exactly 1 input and 1 output; branch splitting and convergence only use logic nodes.

### 2. Simulation Scenario Configuration
- Created `apps/console/src/features/workflows/sandbox/simulation-scenarios.ts` with 4 comprehensive execution traces:
  1. **HAPPY_PATH**: Full order fulfillment through parallel branches and completion.
  2. **FRAUD_REJECTED**: AI fraud check anomaly detection failing the join barrier and terminating execution.
  3. **PAYMENT_TIMEOUT**: Gateway timeout during card authorization with retry exhaustion.
  4. **APPROVAL_ESCALATION**: Halts at human approval step with polite waiting status.

### 3. High-Fidelity Mock EventSource & Stream Generator
- Created `apps/console/src/features/workflows/sandbox/workflow-simulation-engine.ts`:
  - Intercepts `EventSource` for execution URLs matching `/workflow/executions/(sim_[^/]+)/events`.
  - Transparent fall-through: unmocked endpoints pass through to native `EventSource`.
  - Emits typed SSE events (`CONNECTED`, `WORKFLOW_STARTED`, `TASK_IN_PROGRESS`, `TASK_LOG`, `TASK_COMPLETED`, `TASK_FAILED`, `WORKFLOW_PAUSED`, `WORKFLOW_COMPLETED`, `WORKFLOW_TERMINATED`).
  - Supports automated playback at `1x`, `2x`, `5x` speeds and manual step-by-step dispatch.
  - Automatically wired into `sandboxResetRegistry` to reset state cleanly.

### 4. UI Modals & Studio Integration
- Created `apps/console/src/features/workflows/components/studio/modals/workflow-simulation-modal.tsx`:
  - Accessible Liquid Glass dialog conforming to WCAG 2.2 AA.
  - Interactive scenario picker with visual badges and descriptions.
  - Cadence selector (`1x`, `2x`, `5x`, `Manual Step`).
  - Playback controls (`Reset`, `Pause/Resume`, `Step Next`, `Start Simulation`).
- Enhanced `DagHeaderCommandBar.tsx` with dedicated **Simulate** CTA button.
- Integrated `WorkflowSimulationModal` into `VisualDagStudio.tsx` (`visual-dag-studio.tsx`), mounting the multi-branch blueprint upon launch.

### 5. Unified SandboxDock Integration
- Updated `apps/console/src/core/sandbox/ui/sandbox-dock.tsx` with dedicated **Workflows** simulation tab.
- Allows developers to trigger scenarios directly or step events manually from the global sandbox dock.
- Exported and wired interceptors in `apps/console/src/core/sandbox/index.ts`.

## Verification Results

### Automated Tests
- `workflow-simulation-engine.test.ts` (5 tests passed): Topology validation, logic node degree checks, SSE stream emission, pause/resume, and reset.
- `workflow-simulation-modal.test.tsx` (3 tests passed): Rendering scenarios, launching simulation, and manual stepping.
- Full suite `pnpm --filter @unipost/console test -- src/features/workflows src/core/sandbox`: **33 test files, 165 tests passed (100% green)**.
- Typecheck `pnpm --filter @unipost/console exec tsc --noEmit`: **0 errors**.
