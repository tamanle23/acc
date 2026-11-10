# Walkthrough 165 - Workflow Engine Decider & Worker Output Schema Enforcement with DLQ Protection

## 1. Executive Summary
We implemented zero-trust output schema validation across the workflow engine runtime. When tasks complete, worker output payloads are strictly validated against the task definition's `outputSchema` before state transitions and decider progressions occur, automatically quarantining contract breaches to the Dead Letter Queue (DLQ).

---

## 2. Key Architecture & Implemented Components

### A. Post-Completion Worker Output Gate (`WorkflowEngineService.java`)
- In `reportTaskResult(...)`, when a worker reports `completed == true`, the service looks up the task definition in `definition.tasks()`.
- If `taskDef.outputSchema()` is present and non-empty:
  - Invokes `WorkflowSchemaValidator.validate(output, taskDef.outputSchema())`.
  - If validation fails, overrides `nextStatus = TaskStatus.FAILED` and records `effectiveError = "Task output payload violates outputSchema: " + error.message()`.
  - Automatically enqueues the poisoned task to the Dead Letter Queue (`TaskDlqRecord`) and triggers distributed Saga compensation if the workflow fails.

### B. Decider Defensive Evaluation Gate (`SimpleTaskStrategy.java`)
- In `evaluate(...)`, when processing `existing.status() == TaskStatus.COMPLETED`:
  - Runs defensive check validating `existing.outputData()` against `taskDef.outputSchema()`.
  - If output violates schema, emits `UpdateTaskStatus(FAILED)` and `TransitionWorkflow(FAILED)` commands, preventing corrupted data from cascading into downstream nodes.

---

## 3. Verification Results

- `SimpleTaskStrategyValidationTest.java`:
  - `testInputSchemaValidationPass`: Passed.
  - `testInputSchemaValidationFail`: Passed.
  - `testOutputSchemaValidationPass`: Passed.
  - `testOutputSchemaValidationFail`: Passed.
- Full `workflow-engine` Maven test suite: 100% passed (Java 21 / Maven 3.9.9).
- Sandbox offline parity: 109/109 passed across 12 suites (`pnpm --filter @acc/sandbox test`).
