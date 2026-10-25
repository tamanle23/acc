# Implementation Plan - Phase 35.1: High-Frequency Task Node Types Engine

Prioritize and implement the core native high-frequency task node types in `@acc/backend` (`workflow-engine` and `acc-ms-aio`) based on `docs/brainstorming/workflow_task_types.md` and updated `docs/integration_master_plan_iteration_4.md`.

## Proposed Changes

### 1. `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskType.java`
- Expand `TaskType` enum with high-frequency types:
  - `SET_VARIABLE`
  - `JSON_JQ_TRANSFORM`
  - `INLINE`
  - `HTTP`
  - `HUMAN`
  - `JOIN`
  - `EXCLUSIVE_JOIN`

### 2. `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowSnapshot.java` & `ParameterResolver.java`
- Add `variables` (or `workflowVariables`) map to `WorkflowSnapshot` so variables set via `SET_VARIABLE` persist across decider cycles.
- Extend `ParameterResolver` to resolve `${workflow.variables.<varName>}` seamlessly alongside `${workflow.input.*}` and `${<taskRef>.output.*}`.

### 3. High-Frequency Node Evaluator Strategies
Implement dedicated strategies implementing `NodeEvaluatorStrategy`:
- `SetVariableStrategy.java`:
  - Resolves input expressions and writes variables to task output / workflow state.
  - Completes immediately in a single decider cycle without scheduling worker leases.
- `JsonTransformStrategy.java`:
  - Extracts and transforms JSON input payloads using JSONPath/expression evaluation (e.g., query, filter, mapping).
  - Completes immediately with transformed output.
- `InlineExpressionStrategy.java`:
  - Evaluates lightweight in-memory mathematical / logical / string expressions without worker polling.
  - Completes immediately with evaluated output.
- `HttpNodeStrategy.java`:
  - Schedules an HTTP execution task or executes synchronous/virtual-thread HTTP request (GET/POST/PUT/DELETE) via Java 21 `HttpClient`.
  - Captures `statusCode`, `body`, `headers`.
- `HumanNodeStrategy.java`:
  - Pauses execution: transitions task to `IN_PROGRESS` without scheduling worker queue leases.
  - Completes when human approval is submitted via task ack API.
- `ExclusiveJoinStrategy.java`:
  - Completes as soon as any one of the incoming branches is `COMPLETED`, skipping/canceling others.

### 4. `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/NodeStrategyRegistry.java`
- Register the new strategies in `registerDefaultStrategies()`.

### 5. Automated Tests
- `apps/backend/workflow-engine/src/test/java/com/acc/workflow/core/decider/HighFrequencyTaskStrategiesTest.java`:
  - Test `SET_VARIABLE` setting and passing state via `${workflow.variables.*}`.
  - Test `JSON_JQ_TRANSFORM` reshaping payloads.
  - Test `INLINE` evaluating dynamic expressions.
  - Test `HUMAN` pausing until manual completion.
  - Test `EXCLUSIVE_JOIN` completing on first branch completion.
- `apps/backend/acc-ms-aio/src/test/java/com/acc/aio/controller/workflow/HighFrequencyTaskIntegrationTest.java`:
  - Integration test verifying end-to-end execution of a workflow featuring these high-frequency system tasks.

## Verification Plan
1. Unit tests: `cd apps/backend; ./mvnw.cmd test -pl workflow-engine -Dtest=HighFrequencyTaskStrategiesTest`
2. Full engine tests: `cd apps/backend; ./mvnw.cmd test -pl workflow-engine`
3. Integration tests: `cd apps/backend; ./mvnw.cmd test -pl acc-ms-aio -Dtest=HighFrequencyTaskIntegrationTest`
