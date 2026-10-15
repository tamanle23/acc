package com.unipost.workflow.core.decider;

import com.unipost.workflow.core.model.DecisionResult;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.TaskType;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class HighFrequencyTaskStrategiesTest {

    private PureDecider decider;

    @BeforeEach
    void setUp() {
        decider = new PureDecider();
    }

    @Test
    @DisplayName("SET_VARIABLE: sets workflow variables and propagates to downstream tasks in same decider pass")
    void testSetVariableStrategy() {
        TaskDefinition setVarTask = TaskDefinition.builder("init-vars")
            .taskType(TaskType.SET_VARIABLE)
            .inputParameters(Map.of(
                "tier", "PREMIUM",
                "discount", 0.20
            ))
            .build();

        TaskDefinition downstreamTask = TaskDefinition.builder("use-vars")
            .taskType(TaskType.SIMPLE)
            .inputParameters(Map.of(
                "assignedTier", "${workflow.variables.tier}",
                "rate", "${workflow.variables.discount}"
            ))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("set-var-wf")
            .tasks(List.of(setVarTask, downstreamTask))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-101", "tenant-1", "ws-1", "set-var-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        // Should update SET_VARIABLE to completed and schedule downstream task with resolved variables
        assertThat(result.commands()).hasSize(2);

        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().get(0);
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(updateCmd.output()).containsEntry("tier", "PREMIUM");

        EngineCommand.ScheduleTask scheduleCmd = (EngineCommand.ScheduleTask) result.commands().get(1);
        assertThat(scheduleCmd.referenceName()).isEqualTo("use-vars");
        assertThat(scheduleCmd.input()).containsEntry("assignedTier", "PREMIUM");
        assertThat(scheduleCmd.input()).containsEntry("rate", 0.20);
    }

    @Test
    @DisplayName("JSON_JQ_TRANSFORM: performs in-engine field extraction and projection")
    void testJsonTransformStrategy() {
        TaskDefinition transformTask = TaskDefinition.builder("reshape-payload")
            .taskType(TaskType.JSON_JQ_TRANSFORM)
            .inputParameters(Map.of(
                "input", Map.of("customer", Map.of("name", "Alice", "id", "CUST-99")),
                "queryExpression", "customer.name"
            ))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("transform-wf")
            .tasks(List.of(transformTask))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-102", "tenant-1", "ws-1", "transform-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        assertThat(result.commands()).hasSize(2); // 1 UpdateTaskStatus + 1 TransitionWorkflow COMPLETED
        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().get(0);
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(updateCmd.output()).containsEntry("result", "Alice");
    }

    @Test
    @DisplayName("INLINE: evaluates arithmetic expressions directly in engine")
    void testInlineExpressionStrategy() {
        TaskDefinition inlineTask = TaskDefinition.builder("calc-total")
            .taskType(TaskType.INLINE)
            .inputParameters(Map.of("expression", "250 * 0.08"))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("inline-wf")
            .tasks(List.of(inlineTask))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-103", "tenant-1", "ws-1", "inline-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().get(0);
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat((Double) updateCmd.output().get("result")).isEqualTo(20.0);
    }

    @Test
    @DisplayName("HUMAN: enters IN_PROGRESS and halts workflow until approval completed")
    void testHumanNodeStrategy() {
        TaskDefinition humanTask = TaskDefinition.builder("manager-approval")
            .taskType(TaskType.HUMAN)
            .inputParameters(Map.of("role", "Manager", "reason", "Large order"))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("human-wf")
            .tasks(List.of(humanTask))
            .build();

        // 1. First evaluation: enters IN_PROGRESS
        WorkflowSnapshot snap1 = new WorkflowSnapshot(
            "wf-104", "tenant-1", "ws-1", "human-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult res1 = decider.decide(def, snap1, 1000L);
        assertThat(res1.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(res1.commands()).hasSize(1);
        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) res1.commands().get(0);
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.IN_PROGRESS);

        // 2. Second evaluation when human approved externally
        TaskSnapshot completedHuman = new TaskSnapshot(
            "t-human", "manager-approval", TaskType.HUMAN, "default",
            TaskStatus.COMPLETED, 1, Map.of("role", "Manager"), Map.of("approved", true),
            null, 1000L, 0L, null
        );

        WorkflowSnapshot snap2 = new WorkflowSnapshot(
            "wf-104", "tenant-1", "ws-1", "human-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Map.of("manager-approval", completedHuman)
        );

        DecisionResult res2 = decider.decide(def, snap2, 2000L);
        assertThat(res2.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        assertThat(res2.outputPayload()).containsEntry("approved", true);
    }

    @Test
    @DisplayName("EXCLUSIVE_JOIN: completes on first completed prerequisite branch")
    void testExclusiveJoinStrategy() {
        TaskDefinition exclusiveJoin = TaskDefinition.builder("first-responder")
            .taskType(TaskType.EXCLUSIVE_JOIN)
            .joinOn(List.of("branch-a", "branch-b"))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("exclusive-join-wf")
            .tasks(List.of(exclusiveJoin))
            .build();

        // branch-a is COMPLETED, branch-b is still IN_PROGRESS
        TaskSnapshot branchA = new TaskSnapshot(
            "ta", "branch-a", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("winner", "A"),
            null, 1000L, 0L, null
        );
        TaskSnapshot branchB = new TaskSnapshot(
            "tb", "branch-b", TaskType.SIMPLE, "default",
            TaskStatus.IN_PROGRESS, 1, Collections.emptyMap(), Collections.emptyMap(),
            null, 1000L, 0L, null
        );

        WorkflowSnapshot snap = new WorkflowSnapshot(
            "wf-105", "tenant-1", "ws-1", "exclusive-join-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Map.of("branch-a", branchA, "branch-b", branchB)
        );

        DecisionResult result = decider.decide(def, snap, 1500L);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().get(0);
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(updateCmd.output()).containsEntry("winningBranch", "branch-a");
        assertThat(updateCmd.output()).containsEntry("winner", "A");
    }
}
