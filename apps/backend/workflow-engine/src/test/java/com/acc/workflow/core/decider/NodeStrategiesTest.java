package com.acc.workflow.core.decider;

import com.acc.workflow.core.model.DecisionResult;
import com.acc.workflow.core.model.EngineCommand;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NodeStrategiesTest {

    private PureDecider decider;

    @BeforeEach
    void setUp() {
        decider = new PureDecider();
    }

    @Test
    @DisplayName("SWITCH: should branch to matching decisionCase based on dynamic input expression")
    void shouldBranchToMatchingDecisionCase() {
        TaskDefinition switchTask = TaskDefinition.builder("route-order")
            .taskType(TaskType.SWITCH)
            .inputParameters(Map.of("caseExpression", "${workflow.input.tier}"))
            .decisionCases(Map.of(
                "VIP", List.of(TaskDefinition.builder("vip-shipping").build()),
                "STANDARD", List.of(TaskDefinition.builder("standard-shipping").build())
            ))
            .defaultCase(List.of(TaskDefinition.builder("fallback-shipping").build()))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("switch-workflow")
            .tasks(List.of(switchTask))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-switch-1", "tenant-1", "ws-1", "switch-workflow", 1,
            WorkflowStatus.RUNNING,
            Map.of("tier", "VIP"),
            Collections.emptyMap(),
            null,
            Collections.emptyMap()
        );

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        assertThat(result.commands()).hasSize(2);
        // Command 1: Update SWITCH node to COMPLETED
        EngineCommand.UpdateTaskStatus update = (EngineCommand.UpdateTaskStatus) result.commands().get(0);
        assertThat(update.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(update.output()).containsEntry("selectedCase", "VIP");

        // Command 2: Schedule the VIP branch task
        EngineCommand.ScheduleTask schedule = (EngineCommand.ScheduleTask) result.commands().get(1);
        assertThat(schedule.referenceName()).isEqualTo("vip-shipping");
    }

    @Test
    @DisplayName("FORK_JOIN: should schedule all parallel branches on FORK and barrier join at JOIN")
    void shouldScheduleForkBranchesAndJoinAtBarrier() {
        TaskDefinition forkNode = TaskDefinition.builder("fork-parallel")
            .taskType(TaskType.FORK_JOIN)
            .forkTasks(List.of(
                List.of(TaskDefinition.builder("branch-inventory").build()),
                List.of(TaskDefinition.builder("branch-fraud").build())
            ))
            .build();

        TaskDefinition joinNode = TaskDefinition.builder("join-barrier")
            .taskType(TaskType.FORK_JOIN)
            .joinOn(List.of("branch-inventory", "branch-fraud"))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("fork-join-wf")
            .tasks(List.of(forkNode, joinNode))
            .build();

        // 1. Initial run: fork schedules both parallel tasks
        WorkflowSnapshot initialSnap = new WorkflowSnapshot(
            "wf-fork-1", "tenant-1", "ws-1", "fork-join-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult forkResult = decider.decide(def, initialSnap, 1000L);
        assertThat(forkResult.commands()).hasSize(3); // 1 update fork + 2 schedule branches

        // 2. Partial complete: branch-inventory is complete, branch-fraud still running -> barrier halts
        TaskSnapshot forkSnap = new TaskSnapshot("f1", "fork-parallel", TaskType.FORK_JOIN, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Collections.emptyMap(), null, 1000L, 30000L, null);
        TaskSnapshot branchInvDone = new TaskSnapshot("b1", "branch-inventory", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("invOk", true), null, 1000L, 30000L, "w1");

        WorkflowSnapshot partialSnap = new WorkflowSnapshot(
            "wf-fork-1", "tenant-1", "ws-1", "fork-join-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(), null,
            Map.of("fork-parallel", forkSnap, "branch-inventory", branchInvDone)
        );

        DecisionResult partialResult = decider.decide(def, partialSnap, 1050L);
        assertThat(partialResult.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(partialResult.commands()).isEmpty(); // Join barrier blocks progression

        // 3. Both branches completed -> barrier satisfied and workflow completes
        TaskSnapshot branchFraudDone = new TaskSnapshot("b2", "branch-fraud", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("fraudScore", 0.05), null, 1000L, 30000L, "w2");
        WorkflowSnapshot fullSnap = new WorkflowSnapshot(
            "wf-fork-1", "tenant-1", "ws-1", "fork-join-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(), null,
            Map.of("fork-parallel", forkSnap, "branch-inventory", branchInvDone, "branch-fraud", branchFraudDone)
        );

        DecisionResult fullResult = decider.decide(def, fullSnap, 1100L);
        assertThat(fullResult.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
    }

    @Test
    @DisplayName("WAIT: should hold task invisible until epoch timestamp elapses")
    void shouldHoldWaitNodeUntilEpochTimestamp() {
        TaskDefinition waitTask = TaskDefinition.builder("delay-step")
            .taskType(TaskType.WAIT)
            .inputParameters(Map.of("waitUntilEpochMs", 1728900050000L))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("wait-wf")
            .tasks(List.of(waitTask))
            .build();

        // 1. Current time is before wait timestamp -> schedule with visibleAtEpochMs set to future
        WorkflowSnapshot initialSnap = new WorkflowSnapshot(
            "wf-wait-1", "tenant-1", "ws-1", "wait-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult r1 = decider.decide(def, initialSnap, 1728900010000L);
        assertThat(r1.commands()).hasSize(1);
        EngineCommand.ScheduleTask waitSchedule = (EngineCommand.ScheduleTask) r1.commands().get(0);
        assertThat(waitSchedule.visibleAtEpochMs()).isEqualTo(1728900050000L);

        // 2. Later execution when current time exceeds wait timestamp -> complete wait node
        TaskSnapshot waitTaskSnap = new TaskSnapshot(
            "wf-wait-1_delay-step_wait", "delay-step", TaskType.WAIT, "default",
            TaskStatus.SCHEDULED, 1, Collections.emptyMap(), Collections.emptyMap(), null,
            1728900050000L, 86400000L, null
        );
        WorkflowSnapshot laterSnap = new WorkflowSnapshot(
            "wf-wait-1", "tenant-1", "ws-1", "wait-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(), null,
            Map.of("delay-step", waitTaskSnap)
        );

        DecisionResult r2 = decider.decide(def, laterSnap, 1728900055000L);
        assertThat(r2.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
    }

    @Test
    @DisplayName("DYNAMIC_FORK: should expand array input into parallel dynamic task instances")
    void shouldExpandDynamicForkTasks() {
        TaskDefinition dynamicFork = TaskDefinition.builder("process-batches")
            .taskType(TaskType.DYNAMIC_FORK)
            .inputParameters(Map.of("dynamicForkTasksInput", List.of(
                Map.of("batchId", "B1"),
                Map.of("batchId", "B2"),
                Map.of("batchId", "B3")
            )))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("dyn-wf")
            .tasks(List.of(dynamicFork))
            .build();

        WorkflowSnapshot snap = new WorkflowSnapshot(
            "wf-dyn-1", "tenant-1", "ws-1", "dyn-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result = decider.decide(def, snap, 1000L);

        // 3 dynamic tasks scheduled + 1 update to DYNAMIC_FORK node setting it IN_PROGRESS
        assertThat(result.commands()).hasSize(4);
        long scheduleCommandsCount = result.commands().stream()
            .filter(c -> c instanceof EngineCommand.ScheduleTask)
            .count();
        assertThat(scheduleCommandsCount).isEqualTo(3);

        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().stream()
            .filter(c -> c instanceof EngineCommand.UpdateTaskStatus)
            .findFirst()
            .orElseThrow();
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.IN_PROGRESS);
        assertThat(updateCmd.output()).containsEntry("dynamicCount", 3);
    }

    @Test
    @DisplayName("DYNAMIC_FORK: completes barrier and aggregates child outputs when all dynamic child tasks complete")
    void shouldCompleteBarrierAndAggregateChildOutputs() {
        TaskDefinition dynamicFork = TaskDefinition.builder("process-batches")
            .taskType(TaskType.DYNAMIC_FORK)
            .inputParameters(Map.of("dynamicForkTasksInput", List.of(
                Map.of("batchId", "B1"),
                Map.of("batchId", "B2")
            )))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("dyn-wf")
            .tasks(List.of(dynamicFork))
            .build();

        // 1. Snapshot with parent IN_PROGRESS and both child tasks COMPLETED
        TaskSnapshot parentSnap = new TaskSnapshot(
            "wf-dyn-1_process-batches", "process-batches", TaskType.DYNAMIC_FORK, "default",
            TaskStatus.IN_PROGRESS, 1, Collections.emptyMap(),
            Map.of("dynamicCount", 2, "dynamicRefs", List.of("process-batches_0", "process-batches_1")),
            null, 1000L, 0L, null
        );
        TaskSnapshot child1 = new TaskSnapshot(
            "c1", "process-batches_0", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("processed", 10),
            null, 1000L, 0L, null
        );
        TaskSnapshot child2 = new TaskSnapshot(
            "c2", "process-batches_1", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("processed", 20),
            null, 1000L, 0L, null
        );

        WorkflowSnapshot snap = new WorkflowSnapshot(
            "wf-dyn-1", "tenant-1", "ws-1", "dyn-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(), null,
            Map.of("process-batches", parentSnap, "process-batches_0", child1, "process-batches_1", child2)
        );

        DecisionResult result = decider.decide(def, snap, 2000L);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().stream()
            .filter(c -> c instanceof EngineCommand.UpdateTaskStatus)
            .findFirst()
            .orElseThrow();
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(updateCmd.output()).containsEntry("dynamicCount", 2);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> results = (List<Map<String, Object>>) updateCmd.output().get("results");
        assertThat(results).hasSize(2);
        assertThat(results.get(0)).containsEntry("processed", 10);
        assertThat(results.get(1)).containsEntry("processed", 20);
    }

    @Test
    @DisplayName("DYNAMIC_FORK: fail-fast halts workflow progression when any dynamic child task fails")
    void shouldFailFastDynamicForkOnChildFailure() {
        TaskDefinition dynamicFork = TaskDefinition.builder("process-batches")
            .taskType(TaskType.DYNAMIC_FORK)
            .inputParameters(Map.of("dynamicForkTasksInput", List.of(
                Map.of("batchId", "B1"),
                Map.of("batchId", "B2")
            )))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("dyn-wf")
            .tasks(List.of(dynamicFork))
            .build();

        TaskSnapshot parentSnap = new TaskSnapshot(
            "wf-dyn-1_process-batches", "process-batches", TaskType.DYNAMIC_FORK, "default",
            TaskStatus.IN_PROGRESS, 1, Collections.emptyMap(),
            Map.of("dynamicCount", 2, "dynamicRefs", List.of("process-batches_0", "process-batches_1")),
            null, 1000L, 0L, null
        );
        TaskSnapshot child1 = new TaskSnapshot(
            "c1", "process-batches_0", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("processed", 10),
            null, 1000L, 0L, null
        );
        TaskSnapshot child2 = new TaskSnapshot(
            "c2", "process-batches_1", TaskType.SIMPLE, "default",
            TaskStatus.FAILED, 1, Collections.emptyMap(), Collections.emptyMap(),
            "Out of memory error in batch B2", 1000L, 0L, null
        );

        WorkflowSnapshot snap = new WorkflowSnapshot(
            "wf-dyn-1", "tenant-1", "ws-1", "dyn-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(), null,
            Map.of("process-batches", parentSnap, "process-batches_0", child1, "process-batches_1", child2)
        );

        DecisionResult result = decider.decide(def, snap, 2000L);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.FAILED);
        assertThat(result.failureReason()).contains("Dynamic fork barrier failed at child 'process-batches_1'");
    }
}
