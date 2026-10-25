# Walkthrough 30: Submodule Setup, Canonical Workflow IR & Zero-I/O PureDecider (Phase 26)

## 1. Overview
Executed **Phase 26** of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/acc/docs/integration_master_plan_iteration_3.md):
- Established `apps/backend/workflow-engine/` as a dedicated Maven submodule under `apps/backend/`.
- Authored canonical workflow IR schema: `src/main/resources/schemas/workflow-ir-schema-v1.json`.
- Implemented pure domain models: `TaskType`, `TaskStatus`, `WorkflowStatus`, `TaskDefinition`, `WorkflowDefinition`, `TaskSnapshot`, `WorkflowSnapshot`.
- Implemented sealed commands: `EngineCommand` (`ScheduleTask`, `UpdateTaskStatus`, `DeferTaskCallback`, `TransitionWorkflow`).
- Implemented `DecisionResult` and zero-I/O `PureDecider`.
- Verified 100% test pass on `PureDeciderTest.java`.

## 2. Changes Made

### 2.1 Maven Submodule Configuration
- [`apps/backend/pom.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/pom.xml): Registered `<module>./workflow-engine</module>` and added to `<dependencyManagement>`.
- [`apps/backend/workflow-engine/pom.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/pom.xml): Submodule inheriting backend parent with Jackson, SLF4J, JUnit 5, and AssertJ.

### 2.2 Canonical Workflow IR & Models
- [`workflow-ir-schema-v1.json`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/resources/schemas/workflow-ir-schema-v1.json): Draft-07 JSON Schema for versioned workflow definitions.
- [`TaskType.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskType.java): Enum for `SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, `DO_WHILE`.
- [`TaskStatus.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskStatus.java): `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `TIMED_OUT`, `SKIPPED`.
- [`WorkflowStatus.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowStatus.java): `RUNNING`, `COMPLETED`, `FAILED`, `TERMINATED`, `PAUSED`.
- [`TaskDefinition.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskDefinition.java): Immutable record with builder pattern.
- [`WorkflowDefinition.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowDefinition.java): Immutable record with builder pattern.
- [`TaskSnapshot.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskSnapshot.java): Point-in-time task execution state.
- [`WorkflowSnapshot.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowSnapshot.java): Point-in-time workflow snapshot with tenant context.
- [`EngineCommand.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/EngineCommand.java): Sealed interface permitting 4 deterministic engine side-effect commands.
- [`DecisionResult.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/DecisionResult.java): Immutable decider evaluation outcome.

### 2.3 Zero-I/O Pure Decider
- [`PureDecider.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/PureDecider.java):
  - 100% pure, deterministic evaluation: `decide(definition, snapshot, nowEpochMs)`.
  - Zero imports of `java.sql.*`, thread pools, Spring, or system clocks.
  - Generates deterministic task IDs: `{workflowId}_{refName}_att{attempt}`.
  - Automatically calculates exponential retry backoff delays.

## 3. Verification Results
- Ran `mvn test -pl workflow-engine`:
  - `PureDeciderTest`: **6 tests run, 0 failures, 0 errors, 0 skipped**.
  - Verified:
    1. Immediate first-task scheduling.
    2. Sequential task progression.
    3. Workflow completion with aggregated output.
    4. Exponential backoff delay calculation.
    5. Terminal failure when retries are exhausted.
    6. Memento JSON round-trip serialization and schema fidelity.
