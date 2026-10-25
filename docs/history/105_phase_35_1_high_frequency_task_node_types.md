# 105. Phase 35.1: High-Frequency Task Node Types Engine

**Date:** 2026-10-15  
**Scope:** `apps/backend/workflow-engine`, `apps/backend/acc-ms-aio`  
**Status:** Completed  

---

## 1. Problem
Workflows previously relied almost exclusively on `SIMPLE` worker tasks for business logic, requiring boilerplate external workers even for basic state assignments (`SET_VARIABLE`), JSON reshaping (`JSON_JQ_TRANSFORM`), arithmetic expressions (`INLINE`), manual review gates (`HUMAN`), or HTTP calls (`HTTP`). Based on `docs/brainstorming/workflow_task_types.md`, native built-in system tasks were required in prioritized order (starting with High Frequency) to minimize worker polling latency and streamline DAG authoring.

## 2. Plan
1. Extend `TaskType` enum with high-frequency types: `SET_VARIABLE`, `JSON_JQ_TRANSFORM`, `INLINE`, `HTTP`, `HUMAN`, `JOIN`, `EXCLUSIVE_JOIN`.
2. Add `variables` map to `WorkflowSnapshot` and `${workflow.variables.*}` support to `ParameterResolver`.
3. Implement dedicated zero-I/O strategies (`SetVariableStrategy`, `JsonTransformStrategy`, `InlineExpressionStrategy`, `HumanNodeStrategy`, `ExclusiveJoinStrategy`) and the virtual-thread `HttpNodeStrategy`.
4. Register strategies in `NodeStrategyRegistry` and update `PureDecider` to propagate intermediate completions and variables in the same decider cycle.
5. Verify via unit tests in `workflow-engine` and an integration test in `acc-ms-aio`.

## 3. Changes
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskType.java`**:
  - Added new task types.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowSnapshot.java`**:
  - Added `variables` map and backward-compatible constructor overload.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/expression/ParameterResolver.java`**:
  - Supported `${workflow.variables.<key>}` resolution.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/`**:
  - Created `SetVariableStrategy.java`, `JsonTransformStrategy.java`, `InlineExpressionStrategy.java`, `HumanNodeStrategy.java`, `ExclusiveJoinStrategy.java`, and `HttpNodeStrategy.java`.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/NodeStrategyRegistry.java`**:
  - Registered all new strategies in default mapping.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/PureDecider.java`**:
  - Dynamically updated in-flight `snapshot` with completed task output and variable merges.
- **Tests & Artifacts**:
  - Created `HighFrequencyTaskStrategiesTest.java` in `workflow-engine`.
  - Created `HighFrequencyTaskIntegrationTest.java` in `acc-ms-aio`.
  - Created `apps/backend/doc/implementation_plan_35.md` and `apps/backend/doc/walkthrough_35.md`.

## 4. Verification
- `cd apps/backend; ./mvnw.cmd test -pl workflow-engine`: 32/32 tests passed (including all 5 new high-frequency strategy tests).
- `cd apps/backend; ./mvnw.cmd test -pl acc-ms-aio -Dtest=HighFrequencyTaskIntegrationTest`: passed in 0.357s.
- `pnpm --filter @acc/worker test`: 5/5 tests passed.

## 5. Walkthrough
- Tested pipeline chaining `SET_VARIABLE` $\to$ `INLINE` $\to$ `JSON_JQ_TRANSFORM` $\to$ `SIMPLE` worker task.
- All three system tasks resolved instantaneously within the first decider iteration.
- Downstream worker task polled and received resolved parameters `${compute-total.output.result}` and `${extract-customer.output.result}`.
- Completing worker task transitioned workflow directly to `COMPLETED`.

## 6. Tasks
- [x] Extend `TaskType` enum and `WorkflowSnapshot` with variables.
- [x] Implement high-frequency node evaluator strategies.
- [x] Register strategies in `NodeStrategyRegistry`.
- [x] Pass unit and integration tests.
- [x] Document implementation plan, walkthrough, and history entry.

## 7. Next Steps
- Implement Sub-phase 35.2: Medium-Frequency Task Node Types (`TERMINATE`, `SUB_WORKFLOW`, `START_WORKFLOW`, `EVENT`, `DYNAMIC`, `LLM_CHAT_COMPLETE`).
