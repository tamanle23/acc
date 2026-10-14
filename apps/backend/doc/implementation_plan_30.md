# Implementation Plan 30: Submodule Setup, Canonical Workflow IR & Zero-I/O PureDecider (Phase 26)

## 1. Overview
Implement Phase 26 of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/integration_master_plan_iteration_3.md):
- Set up `apps/backend/workflow-engine/` as a dedicated Maven submodule under `apps/backend/`.
- Define Canonical Workflow Intermediate Representation (IR) schema and Jackson mappings.
- Implement immutable domain models (`WorkflowDefinition`, `WorkflowSnapshot`, `TaskSnapshot`, `TaskStatus`, `WorkflowStatus`, `DecisionResult`).
- Implement Java 21 sealed `EngineCommand` hierarchy (`ScheduleTask`, `UpdateTaskStatus`, `DeferTaskCallback`, `TransitionWorkflow`).
- Implement zero-I/O, deterministic `PureDecider.decide()` core state machine.

## 2. Invariants Followed
- **ZERO-I/O FUNCTIONAL CORE**: Zero JDBC, Spring, thread pools, or system clock calls in `core`. Explicit `nowEpochMs` and deterministic task IDs passed in.
- **MEMENTO DEFINITION IMMUTABILITY**: Definition snapshotting format ready for frozen execution.
- **ZERO-STUB-PROHIBITION**: Real pure Java domain classes tested with zero synthetic mocks.

## 3. Proposed Changes

### 3.1 Maven Submodule Configuration
- Update [`apps/backend/pom.xml`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/pom.xml):
  - Add `<module>./workflow-engine</module>` to `<modules>`.
  - Add `workflow-engine` to `<dependencyManagement>`.
- Create `apps/backend/workflow-engine/pom.xml` inheriting `com.unipost:unipost:1.0.0-SNAPSHOT` with dependencies:
  - `com.fasterxml.jackson.core:jackson-databind`
  - `org.slf4j:slf4j-api`
  - `org.junit.jupiter:junit-jupiter` (test)
  - `org.assertj:assertj-core` (test)

### 3.2 Canonical Workflow IR & Models (`core/model/`)
- `TaskType.java`: Enum (`SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, `DO_WHILE`).
- `TaskStatus.java`: Enum (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `TIMED_OUT`, `SKIPPED`).
- `WorkflowStatus.java`: Enum (`RUNNING`, `COMPLETED`, `FAILED`, `TERMINATED`, `PAUSED`).
- `TaskDefinition.java`: Immutable record (taskReferenceName, taskType, domain, timeoutSeconds, retryCount, retryDelaySeconds, backoffRate, inputParameters, defaultCase, decisionCases).
- `WorkflowDefinition.java`: Immutable record (workflowKey, version, name, description, tasks, layoutMetadata).
- `TaskSnapshot.java`: Immutable record (taskId, taskReferenceName, taskType, domain, status, attempt, inputData, outputData, errorMessage, visibleAtEpochMs, workerId).
- `WorkflowSnapshot.java`: Immutable record (workflowId, tenantId, workspaceId, workflowKey, version, status, inputPayload, outputPayload, tasksByRef).
- `EngineCommand.java`: Sealed interface permitting `ScheduleTask`, `UpdateTaskStatus`, `DeferTaskCallback`, `TransitionWorkflow`.
- `DecisionResult.java`: Immutable record (workflowStatus, commands, outputPayload).

### 3.3 Zero-I/O Functional Decider Core (`core/decider/`)
- `PureDecider.java`:
  - `decide(WorkflowDefinition definition, WorkflowSnapshot snapshot, long nowEpochMs)`
  - Evaluates tasks in definition order.
  - Schedules next eligible tasks whose dependencies/preceding tasks are satisfied.
  - Transitions workflow to `COMPLETED` when all terminal tasks are done.
  - Transitions workflow to `FAILED` when any task fails permanently.

### 3.4 Verification
- `PureDeciderTest.java`: Pure JUnit 5 record-in / command-out unit test suite executing in <1ms without mocks or Spring context.
- Run `mvn test -pl workflow-engine` and verify 100% pass.
