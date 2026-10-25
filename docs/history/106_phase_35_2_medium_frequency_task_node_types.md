# 106. Phase 35.2: Medium-Frequency Task Node Types Engine

**Date:** 2026-10-15  
**Scope:** `apps/backend/workflow-engine`, `apps/backend/acc-ms-aio`  
**Status:** Completed  

---

## 1. Problem
Workflows required standard orchestration patterns for workflow lifecycle termination (`TERMINATE`), hierarchical composition (`SUB_WORKFLOW`), fire-and-forget background execution (`START_WORKFLOW`), domain event publishing (`EVENT`), dynamic task resolution (`DYNAMIC`), and generative AI completions (`LLM_CHAT_COMPLETE`). Without built-in engine strategies for these medium-frequency task types from `docs/brainstorming/workflow_task_types.md`, applications had to rely on custom glue code and ad-hoc worker implementations.

## 2. Plan
1. Add `TERMINATE`, `SUB_WORKFLOW`, `START_WORKFLOW`, `EVENT`, `DYNAMIC`, `LLM_CHAT_COMPLETE` to `TaskType`.
2. Implement dedicated zero-I/O strategies (`TerminateNodeStrategy`, `SubWorkflowStrategy`, `StartWorkflowStrategy`, `EventNodeStrategy`, `DynamicTaskStrategy`) and `LlmChatCompleteStrategy`.
3. Register all 6 strategies in `NodeStrategyRegistry`.
4. Update `PureDecider` to immediately return explicit `TransitionWorkflow` commands (allowing `TERMINATE` to short-circuit workflow execution immediately with specified status and reason).
5. Verify via unit tests in `workflow-engine` and full module test passes.

## 3. Changes
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskType.java`**:
  - Added medium-frequency task types.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/PureDecider.java`**:
  - Honored immediate `TransitionWorkflow` commands from strategies.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/`**:
  - Created `TerminateNodeStrategy.java`, `SubWorkflowStrategy.java`, `StartWorkflowStrategy.java`, `EventNodeStrategy.java`, `DynamicTaskStrategy.java`, `LlmChatCompleteStrategy.java`.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/NodeStrategyRegistry.java`**:
  - Registered all 6 strategies.
- **Tests & Artifacts**:
  - Created `MediumFrequencyTaskStrategiesTest.java` in `workflow-engine`.
  - Created `apps/backend/doc/implementation_plan_36.md` and `apps/backend/doc/walkthrough_36.md`.

## 4. Verification
- `cd apps/backend; ./mvnw.cmd test -pl workflow-engine`: 38/38 tests passed (including all 6 new medium-frequency tests).
- `cd apps/backend; ./mvnw.cmd test -pl acc-ms-aio`: 4/4 test suites passed.
- `pnpm --filter @acc/worker test`: 5/5 tests passed.

## 5. Walkthrough
- `TERMINATE`: halted workflow progression and immediately failed/completed execution with specified reason without executing downstream tasks.
- `SUB_WORKFLOW`: generated sub-routine execution with `subWorkflowId`, waited in `IN_PROGRESS`, and completed upon child result.
- `START_WORKFLOW`: fired async workflow in background and continued parent execution without blocking.
- `EVENT`: published event payload to target topic with timestamp and event ID.
- `DYNAMIC`: resolved target worker task type dynamically from input parameters.
- `LLM_CHAT_COMPLETE`: generated AI completion structure with model and token counts.

## 6. Tasks
- [x] Extend `TaskType` with medium-frequency types.
- [x] Implement node strategies for `TERMINATE`, `SUB_WORKFLOW`, `START_WORKFLOW`, `EVENT`, `DYNAMIC`, `LLM_CHAT_COMPLETE`.
- [x] Wire into `NodeStrategyRegistry` and `PureDecider`.
- [x] Pass unit and integration tests.
- [x] Document implementation plan, walkthrough, and history entry.

## 7. Next Steps
- Implement Sub-phase 35.3: Low-Frequency Task Node Types (`NOOP`, `JDBC`, `KAFKA_PUBLISH`, `CALL_MCP_TOOL`).
