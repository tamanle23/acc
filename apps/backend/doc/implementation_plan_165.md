# Backend Implementation Plan - Iteration 165
# Workflow Engine Decider & Worker Output Schema Enforcement with DLQ Protection

## 1. Executive Summary
This companion implementation plan details the Backend changes for Iteration 79 (Master Plan `docs/iterations/master_implementation_plan_iteration_79.md`). It hardens the Workflow Engine runtime by establishing zero-trust validation on worker outputs:
1. Enforcing `outputSchema` validation in `WorkflowEngineService.reportTaskResult(...)` when a worker reports a task as completed.
2. Defensively validating task output in `SimpleTaskStrategy.evaluate(...)` when processing `TaskStatus.COMPLETED`.
3. Routing schema contract breaches to the Dead Letter Queue (`TaskDlqRecord`) and triggering distributed Saga compensation.

---

## 2. Technical Details & Component Signatures

### 2.1 Post-Completion Output Schema Gate
- **File**: `apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/WorkflowEngineService.java`
- **Method**: `reportTaskResult(...)`
- **Logic**:
  - When `completed == true`, check if the associated task in the workflow definition has an `outputSchema`.
  - Validate `output` payload against `taskDef.outputSchema()` using `WorkflowSchemaValidator`.
  - If invalid:
    - Set `nextStatus = TaskStatus.FAILED`.
    - Set `error = "Task output payload violates outputSchema: " + error.message()`.
    - Enqueue a `TaskDlqRecord` with error classification `SCHEMA_VALIDATION_BREACH`.

### 2.2 Decider Strategy Defensive Output Gate
- **File**: `apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/SimpleTaskStrategy.java`
- **Method**: `evaluate(...)`
- **Logic**:
  - In `if (status == TaskStatus.COMPLETED)`:
    - If `taskDef.outputSchema()` is present and non-empty:
      - Validate `existing.outputData()`.
      - If invalid, transition to FAILED and return `NodeEvaluationResult.failed(...)`.

### 2.3 Unified Sandbox Parity
- **File**: `packages/sandbox/src/handlers/workflow-handler.ts`
- **Logic**: Mirror output schema validation when simulated tasks finish.

---

## 3. Verification Plan
- Unit test: `SimpleTaskStrategyValidationTest.java` - Test invalid output payloads are caught and marked FAILED.
- Unit test: `WorkflowEngineServiceTest.java` - Test invalid worker completion is quarantined to DLQ.
- Sandbox test: `pnpm --filter @acc/sandbox test` - Verify parity across all suites.
