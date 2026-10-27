# [189] Visual DAG Studio — Time-Travel State Rollback, Replay Banner & Flamegraph Sync

## Problem
In Workflow Execution Mode, time-travel scrubbing previously only updated a step index counter without full system state rollback:
1. Workflow variables and task output payloads remained stuck at the live HEAD, giving misleading information during historical review.
2. The user had no persistent floating notification that the canvas was currently displaying a historical replay rather than live real-time execution.
3. Returning to the live execution head required scrubbing all the way back to the slider tail or closing the session.
4. The Concurrency Flamegraph / Waterfall was static and decoupled from the scrubber slider, meaning clicking on task executions did not navigate the DAG canvas to that moment in time.
5. Telemetry logs in the console showed future events that had not yet occurred at the historical step being scrubbed.

## Solution & Architecture
Implemented **Workstream 5: Time-Travel Historical Replay & Flamegraph Sync** adhering to Liquid Glass design standards and WCAG 2.2 AA accessibility:
1. **Full Graph Historical State Rollback (`useDagExecutionSync`)**:
   - Reconstructs cumulative workflow variables and step outputs up to step $t_k$ (`replayedVariables`).
   - Propagates rolled-back variables into the Studio's variable watch and `ExecutionRunDrawer` payload diffing.
   - Computes temporal log window (`historicalLogs`) filtering out events with `timestamp > currentStepTimestamp`.

2. **Liquid Glass Historical Replay Floating Banner**:
   - Appears centered below the top command bar whenever `!isLiveHead`.
   - Styled with Liquid Glass amber tokens (`backdrop-blur-2xl bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 shadow-xl shadow-amber-500/10`).
   - Displays a clock icon with subtle animation, current step counter (`Step N/M`), timestamp of step $t_k$, and a 1-click **"Return to Live HEAD"** button with a pulsing emerald radio indicator (`data-testid="dag-return-to-live-btn"`).

3. **Bi-Directional Flamegraph Synchronization (`WorkflowExecutionFlamegraph`)**:
   - Clicking any task interval in the Flamegraph automatically jumps the time-travel scrubber to that task's completion or dispatch event index, rolling back both the DAG canvas and variables to that exact historical moment.
   - Renders a real-time vertical playhead needle line (`flamegraph-playhead-line`) showing the current scrubber cursor position across the concurrency waterfall.
   - Shows a "Scrubbed: Step N" badge in the flamegraph header when viewing historical steps.

## Verification
- **TypeScript**: `pnpm --filter @acc/console exec tsc --noEmit` passed with 0 errors.
- **Unit & Integration Tests**:
  - `workflow-execution-flamegraph.test.tsx` (3/3 passed).
  - Full workflow test suite: 21 test files, 92 passed (`pnpm --filter @acc/console test -- src/features/workflows`).
