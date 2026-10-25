# Walkthrough 31: Conductor Node Strategies, Topological Frontiers & Parameter Resolver (Phase 27)

## 1. Overview
Executed **Phase 27** of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/acc/docs/integration_master_plan_iteration_3.md):
- Implemented `ParameterResolver` supporting JSONPath-style expressions (`${workflow.input.x}`, `${taskRef.output.y}`, array indexing `items[0].sku`, and string interpolation).
- Implemented `AcyclicityGuard` mathematically enforcing graph acyclicity using Kahn's algorithm ($O(V+E)$) and Tarjan's strongly connected components algorithm to extract exact cycle paths.
- Built Open/Closed `NodeStrategyRegistry` and strategies for all Conductor node types:
  - `SimpleTaskStrategy`: Task dispatch, exponential retry backoff, and terminal failure handling.
  - `SwitchNodeStrategy`: Case expression evaluation and dynamic branch scheduling.
  - `ForkJoinStrategy`: Parallel branch dispatch and fan-in synchronization barrier.
  - `DynamicForkStrategy`: Dynamic expansion of collection payloads into parallel tasks.
  - `WaitNodeStrategy`: Time-based wait until future epoch timestamp.
  - `DoWhileStrategy`: Iterative loop execution with safety iteration ceiling.
- Refactored `PureDecider` to delegate node evaluations cleanly without hardcoded conditionals.
- Verified 100% test pass on all 16 test cases across the test suites.

## 2. Changes Made

### 2.1 Expression Engine
- [`ParameterResolver.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/expression/ParameterResolver.java): Pure deterministic parameter resolution for workflow input, output, and prior task outputs.

### 2.2 Topological & Cycle Detection
- [`AcyclicityGuard.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/graph/AcyclicityGuard.java): Kahn's algorithm topological sorter with DFS cycle path tracer.
- [`WorkflowCycleDetectedException.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/graph/WorkflowCycleDetectedException.java): Typed exception carrying the exact circular dependency cycle path.

### 2.3 Node Evaluator Strategies (`core/decider/strategy/`)
- [`NodeEvaluatorStrategy.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/NodeEvaluatorStrategy.java): Base strategy contract.
- [`SimpleTaskStrategy.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/SimpleTaskStrategy.java): Standard task lifecycle.
- [`SwitchNodeStrategy.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/SwitchNodeStrategy.java): Dynamic conditional branching.
- [`ForkJoinStrategy.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/ForkJoinStrategy.java): Parallel fork & barrier join.
- [`DynamicForkStrategy.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/DynamicForkStrategy.java): Array-driven dynamic task generation.
- [`WaitNodeStrategy.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/WaitNodeStrategy.java): Epoch delay scheduling.
- [`DoWhileStrategy.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/DoWhileStrategy.java): Bounded iteration loop.
- [`NodeStrategyRegistry.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/NodeStrategyRegistry.java): EnumMap strategy registry.
- [`PureDecider.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/PureDecider.java): Updated decider coordinator.

### 2.4 Verification Suite
- [`ParameterResolverTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/test/java/com/acc/workflow/core/expression/ParameterResolverTest.java): 3 tests passing.
- [`AcyclicityGuardTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/test/java/com/acc/workflow/core/graph/AcyclicityGuardTest.java): 3 tests passing.
- [`NodeStrategiesTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/test/java/com/acc/workflow/core/decider/NodeStrategiesTest.java): 4 tests passing.
- [`PureDeciderTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/test/java/com/acc/workflow/core/PureDeciderTest.java): 6 tests passing.

## 3. Verification Results
- Ran `mvn test -pl workflow-engine`:
  - **16/16 tests passing in 1.84s with 0 failures, 0 errors, and 0 skipped**.
