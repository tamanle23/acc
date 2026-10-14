# 085: Submodule Setup, Canonical Workflow IR & Zero-I/O PureDecider (Phase 26)

**Date**: 2026-10-14  
**Author**: Lead Systems Architect  
**Category**: feat(backend)  
**Scope**: `apps/backend/workflow-engine`

---

## 1. Problem Statement
Iteration 3 of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/integration_master_plan_iteration_3.md) initiates the Distributed Workflow Orchestration Engine. Phase 26 requires:
1. Creating a dedicated Maven submodule (`workflow-engine`) within `apps/backend/`.
2. Defining the Canonical Workflow Intermediate Representation (IR) schema and Jackson mappings.
3. Implementing immutable domain models (`WorkflowDefinition`, `WorkflowSnapshot`, `TaskSnapshot`, `TaskStatus`, `WorkflowStatus`).
4. Modeling side-effects as Java 21 sealed `EngineCommand`s.
5. Implementing the 100% pure, deterministic, zero-I/O `PureDecider` state machine.

---

## 2. Plan
1. Configure `workflow-engine/pom.xml` and register it in `apps/backend/pom.xml`.
2. Author Draft-07 JSON Schema `workflow-ir-schema-v1.json`.
3. Implement pure immutable records and sealed interfaces in `com.unipost.workflow.core.model`.
4. Implement `PureDecider.decide(definition, snapshot, nowEpochMs)` with deterministic task ID generation and exponential retry backoff delay calculation.
5. Write `PureDeciderTest.java` verifying scheduling, progression, completion, exponential retry backoff, and Jackson Memento round-trip.

---

## 3. Changes Made
- [`apps/backend/pom.xml`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/pom.xml): Registered module and dependency management entry for `workflow-engine`.
- [`apps/backend/workflow-engine/pom.xml`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/pom.xml): Submodule configuration.
- [`apps/backend/workflow-engine/src/main/resources/schemas/workflow-ir-schema-v1.json`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/resources/schemas/workflow-ir-schema-v1.json): Canonical JSON schema.
- [`TaskType.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/TaskType.java), [`TaskStatus.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/TaskStatus.java), [`WorkflowStatus.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/WorkflowStatus.java): Core lifecycle enums.
- [`TaskDefinition.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/TaskDefinition.java), [`WorkflowDefinition.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/WorkflowDefinition.java): Immutable definition records with builders.
- [`TaskSnapshot.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/TaskSnapshot.java), [`WorkflowSnapshot.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/WorkflowSnapshot.java): Immutable execution state snapshots.
- [`EngineCommand.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/EngineCommand.java): Sealed interface for `ScheduleTask`, `UpdateTaskStatus`, `DeferTaskCallback`, `TransitionWorkflow`.
- [`DecisionResult.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/model/DecisionResult.java): Immutable decider result record.
- [`PureDecider.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/decider/PureDecider.java): Zero-I/O deterministic decider.
- [`PureDeciderTest.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/test/java/com/unipost/workflow/core/PureDeciderTest.java): JUnit 5 & AssertJ test suite.
- Artifacts: [`apps/backend/doc/implementation_plan_30.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/doc/implementation_plan_30.md) & [`apps/backend/doc/walkthrough_30.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/doc/walkthrough_30.md).

---

## 4. Verification
- `mvn test -pl workflow-engine`: **6/6 tests passing (0.234s)**.
