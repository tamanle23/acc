# Walkthrough - Phase 35.1: High-Frequency Task Node Types Engine

Standardized native implementation of high-frequency workflow task node types based on `docs/brainstorming/workflow_task_types.md`.

## Changes Summary

### 1. Engine Core Model Extensions
- **`TaskType.java`**: Added `SET_VARIABLE`, `JSON_JQ_TRANSFORM`, `INLINE`, `HTTP`, `HUMAN`, `JOIN`, `EXCLUSIVE_JOIN`.
- **`WorkflowSnapshot.java`**: Added persistent `variables` map and backward-compatible constructor overload.
- **`ParameterResolver.java`**: Added `${workflow.variables.<key>}` resolution alongside existing inputs, outputs, and status.

### 2. High-Frequency Node Strategies
- **`SetVariableStrategy.java`**: Evaluates inputs, updates snapshot variables in-memory, and completes immediately.
- **`JsonTransformStrategy.java`**: Performs JSONPath/field extraction and projection templates directly in engine.
- **`InlineExpressionStrategy.java`**: Evaluates arithmetic expressions (`+`, `-`, `*`, `/`) and string/boolean literals.
- **`HttpNodeStrategy.java`**: Executes HTTP requests (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`) using Java 21 `HttpClient` without worker polling.
- **`HumanNodeStrategy.java`**: Pauses execution in `IN_PROGRESS` without lease consumption, unblocking upon manual completion.
- **`ExclusiveJoinStrategy.java`**: Fan-in convergence unblocking upon the first completed prerequisite branch.
- **`NodeStrategyRegistry.java`**: Registered all strategies in the Open/Closed strategy map.
- **`PureDecider.java`**: Enriched pass-through execution loop to propagate variables and intermediate task completions within the same cycle.

## Verification
- **`workflow-engine` Unit Tests**:
  - `HighFrequencyTaskStrategiesTest.java`: 5/5 tests passed (covering `SET_VARIABLE`, `JSON_JQ_TRANSFORM`, `INLINE`, `HUMAN`, `EXCLUSIVE_JOIN`).
  - Total `workflow-engine` suite: 32/32 tests passed (0 failures, 0 errors).
- **`unipost-ms-aio` Integration Test**:
  - `HighFrequencyTaskIntegrationTest.java`: Full pipeline test combining `SET_VARIABLE` $\to$ `INLINE` $\to$ `JSON_JQ_TRANSFORM` $\to$ worker task passed in 0.35s.
  - Existing `WorkflowEngineRestApiTest.java`: 1/1 passed.
- **TypeScript Worker Suite**:
  - `pnpm --filter @unipost/worker test`: 5/5 passed.
