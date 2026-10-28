# 358: Workflow Decider Engine Enterprise Enhancements

## Problem
In `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/`, the pure decider engine (`PureDecider`) and its 21 execution strategies were audited for correctness, determinism, and enterprise resilience. The audit uncovered four critical architectural defects:
1. **DAG Parallel Branch Serialization**: In workflows with explicit `joinOn` dependencies or DAG topology, `PureDecider` broke out of its task evaluation loop upon encountering any in-flight task (`shouldHaltProgression = true`), inadvertently serializing independent parallel root branches across multiple decider ticks instead of scheduling them concurrently.
2. **Compound Multi-Task FORK Branch Drop-off**: `ForkJoinStrategy` only scheduled the initial task (`branch.get(0)`) in each fork branch and prematurely completed the `FORK_JOIN` node, leaving subsequent sequential tasks in the branch unreached.
3. **Compound Multi-Task SWITCH Branch Drop-off**: `SwitchNodeStrategy` scheduled only `selectedBranch.get(0)`, omitting progression for multi-step decision branches and reversing the command emission order expected by consumers.
4. **DO_WHILE Iterative Multi-Step Execution & State Sync**: `DoWhileStrategy` failed to track sequential tasks within loop iterations and did not emit `UpdateTaskStatus` commands on iteration boundaries, resulting in state desynchronization in snapshot state machines.
5. **Dangling Network Imports in Pure Decider Strategies**: Unused `java.net.http.*` imports were present in `HttpNodeStrategy`, `CallMcpToolStrategy`, and `LlmChatCompleteStrategy`, violating the pure decoupling constraint of the hexagonal decider core.

## Plan
1. **Decider DAG Readiness & Parallel Branch Scheduling**:
   - Introduce `isTaskReadyToStart` DAG dependency evaluation in `PureDecider` that verifies all `joinOn` prerequisite tasks are `COMPLETED` before scheduling.
   - Maintain full backward compatibility for sequential pipelines when no explicit `joinOn` is present.
   - In DAG workflows (`hasAnyExplicitJoinOn == true`), continue evaluating and scheduling independent parallel root tasks concurrently in the same decision pass.
   - Gate breakpoint detection on DAG dependency satisfaction so breakpoints only fire when their dependencies are resolved.
2. **Multi-Task Branch Progression in FORK_JOIN**:
   - Upgrade `ForkJoinStrategy` to walk multi-task branches sequentially (`b = 0..N`), scheduling subsequent tasks once previous tasks reach `COMPLETED` or `SKIPPED`.
   - Prevent rescheduling initial tasks when `existing != null` (fork node already dispatched).
3. **Multi-Task Decision Branch Progression in SWITCH**:
   - Advance sequential tasks in `selectedBranch` sequentially, ensuring `UpdateTaskStatus` for the SWITCH node is emitted as command 0 on dispatch.
4. **Resilient DO_WHILE Iteration Engine**:
   - Enable multi-step loop execution per iteration, evaluate loop conditions dynamically at iteration boundaries, and emit `UpdateTaskStatus` commands to persist iteration state into snapshots.
5. **Comprehensive Verification**:
   - Build a formal unit and integration test suite (`DeciderEnhancementSuiteTest`) covering DAG parallel concurrency, multi-task FORK joins, multi-task SWITCH branches, and multi-iteration DO_WHILE loops.
   - Run full regression suites across `workflow-engine` and `acc-ms-aio`.

## Changes
- **Core Decider**:
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/PureDecider.java`: Implemented DAG prerequisite readiness checks, concurrent independent root scheduling, and prerequisite-guarded breakpoint evaluation.
- **Strategies**:
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/ForkJoinStrategy.java`: Added multi-task branch traversal and idempotent branch scheduling.
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/SwitchNodeStrategy.java`: Added multi-task branch traversal and ordered `UpdateTaskStatus` dispatch.
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/DoWhileStrategy.java`: Added multi-step loop support, iteration state updates, and condition evaluation.
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/HttpNodeStrategy.java`: Removed unused HTTP client imports.
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/CallMcpToolStrategy.java`: Removed unused HTTP client imports.
  - `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/LlmChatCompleteStrategy.java`: Removed unused HTTP client imports.
- **Tests**:
  - `apps/backend/workflow-engine/src/test/java/com/acc/workflow/core/decider/DeciderEnhancementSuiteTest.java`: Added 4 comprehensive test scenarios covering concurrent DAG branch scheduling, multi-task fork-join branches, multi-task switch cases, and multi-iteration do-while loops.

## Verification
- `mvnw test -pl workflow-engine`: 69 tests executed, 0 failures, 0 errors.
- `mvnw test -pl acc-ms-aio -am -Dtest=*Workflow*Test`: Full workflow suite executed cleanly with 0 regressions.
- All golden trace replays (`GoldenTraceReplayTest`) verified with bit-identical determinism.

## Walkthrough
- Submitting a DAG workflow with root tasks A and B (with no dependencies) schedules both A and B simultaneously in Pass 1.
- Submitting a FORK_JOIN with multi-step branches `[TaskA1 -> TaskA2]` and `[TaskB1 -> TaskB2]` schedules A1 and B1 initially, followed by A2 and B2 upon completion of their respective precursors, joining cleanly at the barrier.
- DO_WHILE loops cleanly cycle through sequential subtasks across iterations up to condition termination.

## Tasks
- [x] Audit `PureDecider` and all 21 strategies
- [x] Implement DAG readiness and concurrent branch evaluation
- [x] Fix multi-task branches in FORK_JOIN and SWITCH
- [x] Implement multi-step DO_WHILE iteration state updates
- [x] Clean unused network imports
- [x] Add `DeciderEnhancementSuiteTest`
- [x] Verify with Maven tests (exit code 0)
- [x] Register history and commit

## Enhancement
- Future iterations can integrate dynamic DAG cycle detection caching and worker queue backpressure signals into the external scheduler middleware.
