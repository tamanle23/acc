# Implementation Plan - Phase 35.2: Medium-Frequency Task Node Types Engine

Prioritize and implement native medium-frequency task node types in `@acc/backend` based on `docs/brainstorming/workflow_task_types.md` and `docs/integration_master_plan_iteration_4.md`.

## Proposed Changes

### 1. `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskType.java`
- Added:
  - `TERMINATE`
  - `SUB_WORKFLOW`
  - `START_WORKFLOW`
  - `EVENT`
  - `DYNAMIC`
  - `LLM_CHAT_COMPLETE`

### 2. Node Evaluator Strategies
Implement dedicated strategies implementing `NodeEvaluatorStrategy`:
- `TerminateNodeStrategy.java`: Halts progression and emits `TransitionWorkflow` for immediate termination.
- `SubWorkflowStrategy.java`: Schedules sub-routine workflow execution, waiting for child completion.
- `StartWorkflowStrategy.java`: Triggers asynchronous fire-and-forget workflow, completing immediately.
- `EventNodeStrategy.java`: Publishes event to specified topic and completes.
- `DynamicTaskStrategy.java`: Resolves task type dynamically at runtime from input variables.
- `LlmChatCompleteStrategy.java`: AI chat completion node with model, prompt, tokens, and response synthesis.

### 3. Registry & Decider Updates
- Update `NodeStrategyRegistry.java` to register all 6 new strategies.
- Update `PureDecider.java` to immediately honor explicit `TransitionWorkflow` commands.

### 4. Verification
- `MediumFrequencyTaskStrategiesTest.java` in `workflow-engine`.
- Full `workflow-engine` and `acc-ms-aio` test execution.
