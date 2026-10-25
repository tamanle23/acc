# Implementation Plan 31: Conductor Node Strategies, Topological Frontiers & Parameter Resolver (Phase 27)

## 1. Overview
Execute **Phase 27** of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/acc/docs/integration_master_plan_iteration_3.md):
- Implement `ParameterResolver` supporting JSONPath-style expressions: `${workflow.input.x}` and `${<taskRef>.output.y}` across nested Maps and Lists.
- Implement Open/Closed `NodeEvaluatorStrategy` interface and `NodeStrategyRegistry`.
- Implement concrete node strategies:
  - `SimpleTaskStrategy`: Dispatches tasks, computes retry backoffs, evaluates completion/terminal failure.
  - `SwitchNodeStrategy`: Evaluates dynamic condition or expression, branches to `decisionCases[case]` or `defaultCase`.
  - `ForkJoinStrategy`: Concurrently schedules parallel branch tasks and enforces a fan-in barrier at `JOIN` until all branches reach `COMPLETED`.
  - `DynamicForkStrategy`: Dynamically expands parallel task instances based on runtime collection inputs.
  - `WaitNodeStrategy`: Halts execution until `waitUntilEpochMs` timestamp or external resume signal.
  - `DoWhileStrategy`: Loops child tasks until condition evaluates to false or max iteration ceiling is reached.
- Implement `AcyclicityGuard` using Kahn's algorithm ($O(V+E)$) and Tarjan's SCC algorithm for cycle path detection.
- Refactor `PureDecider` to delegate node evaluations to `NodeStrategyRegistry` and resolve parameters dynamically.

## 2. Invariants Followed
- **ZERO-I/O FUNCTIONAL CORE**: Zero database, thread pools, or system clock calls in strategies and parameter resolution.
- **OPEN/CLOSED NODE EVALUATION**: No monolithic `switch/if-else` blocks in `PureDecider`.
- **ZERO-STUB-PROHIBITION**: Real pure Java domain classes tested with zero synthetic mocks.

## 3. Proposed Changes

### 3.1 Expression Engine (`core/expression/`)
- `ParameterResolver.java`:
  - Resolves String templates and nested Objects containing `${workflow.input.path}` and `${<taskRef>.output.path}`.
  - Supports deep object path traversal (e.g. `user.address.city`, `items[0].price`).

### 3.2 Topological Cycle Guard (`core/graph/`)
- `AcyclicityGuard.java`:
  - `validate(WorkflowDefinition definition)`
  - Builds adjacency list and indegree map.
  - Kahn's algorithm for topological sorting and cycle detection.
  - If cyclic, Tarjan SCC extracts cycle path list and throws `WorkflowCycleDetectedException`.

### 3.3 Strategy Pattern Engine (`core/decider/`)
- `NodeEvaluatorStrategy.java`:
  - `EvaluationResult evaluate(TaskDefinition taskDef, WorkflowSnapshot snapshot, long nowEpochMs, ParameterResolver resolver)`
- `NodeStrategyRegistry.java`:
  - Maps `TaskType` to registered `NodeEvaluatorStrategy`.
- Strategies in `core/decider/strategy/`:
  - `SimpleTaskStrategy.java`
  - `SwitchNodeStrategy.java`
  - `ForkJoinStrategy.java`
  - `DynamicForkStrategy.java`
  - `WaitNodeStrategy.java`
  - `DoWhileStrategy.java`

### 3.4 Decider Refactoring (`core/decider/PureDecider.java`)
- Wire `NodeStrategyRegistry` and `ParameterResolver`.
- Support branching, fan-out/fan-in, and loop iterations.

### 3.5 Verification Suite
- `ParameterResolverTest.java`: Deep path resolution, workflow input/task output substitution, edge cases.
- `AcyclicityGuardTest.java`: Acyclic graph acceptance, cycle rejection with exact cycle path traces.
- `NodeStrategiesTest.java`: Switch branching, Fork/Join concurrency and barrier join, Wait node wakeups, Do/While loop iterations.
- Run `mvn test -pl workflow-engine` verifying 100% pass.
