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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DeciderEnhancementSuiteTest {

    private PureDecider decider;

    @BeforeEach
    void setUp() {
        decider = new PureDecider();
    }

    @Test
    @DisplayName("DAG: root-level independent tasks with joinOn should be scheduled concurrently in the same decision pass")
    void testConcurrentDagBranchScheduling() {
        TaskDefinition start = TaskDefinition.builder("start-node")
            .taskType(TaskType.SIMPLE)
            .build();

        TaskDefinition branchA = TaskDefinition.builder("branch-a")
            .taskType(TaskType.SIMPLE)
            .joinOn(List.of("start-node"))
            .build();

        TaskDefinition branchB = TaskDefinition.builder("branch-b")
            .taskType(TaskType.SIMPLE)
            .joinOn(List.of("start-node"))
            .build();

        TaskDefinition join = TaskDefinition.builder("join-node")
            .taskType(TaskType.JOIN)
            .joinOn(List.of("branch-a", "branch-b"))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("dag-parallel-wf")
            .tasks(List.of(start, branchA, branchB, join))
            .build();

        // 1. Pass 1: Start node scheduled
        WorkflowSnapshot s0 = new WorkflowSnapshot(
            "wf_dag_1", "acme", "default", "dag-parallel-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            null, Collections.emptyMap()
        );
        DecisionResult d0 = decider.decide(def, s0, 1000L);
        assertThat(d0.commands()).hasSize(1);
        EngineCommand.ScheduleTask startCmd = (EngineCommand.ScheduleTask) d0.commands().get(0);
        assertThat(startCmd.referenceName()).isEqualTo("start-node");

        // 2. Pass 2: Start completed -> BOTH Branch A AND Branch B scheduled concurrently
        TaskSnapshot startDone = new TaskSnapshot(
            startCmd.taskId(), "start-node", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("init", true),
            null, 1000L, 30000L, "w1"
        );
        WorkflowSnapshot s1 = new WorkflowSnapshot(
            "wf_dag_1", "acme", "default", "dag-parallel-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            null, Map.of("start-node", startDone)
        );

        DecisionResult d1 = decider.decide(def, s1, 2000L);
        assertThat(d1.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);

        // Crucial verification: BOTH branches are scheduled concurrently!
        List<EngineCommand.ScheduleTask> scheduled = d1.commands().stream()
            .filter(c -> c instanceof EngineCommand.ScheduleTask)
            .map(c -> (EngineCommand.ScheduleTask) c)
            .toList();

        assertThat(scheduled).hasSize(2);
        List<String> refNames = scheduled.stream().map(EngineCommand.ScheduleTask::referenceName).toList();
        assertThat(refNames).containsExactlyInAnyOrder("branch-a", "branch-b");

        // 3. Pass 3: Branch A finishes, Branch B still running -> Join barrier must wait
        TaskSnapshot branchADone = new TaskSnapshot(
            "wf_dag_1_branch-a", "branch-a", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("resultA", 10),
            null, 2000L, 30000L, "w1"
        );
        TaskSnapshot branchBRunning = new TaskSnapshot(
            "wf_dag_1_branch-b", "branch-b", TaskType.SIMPLE, "default",
            TaskStatus.IN_PROGRESS, 1, Collections.emptyMap(), Collections.emptyMap(),
            null, 2000L, 30000L, "w2"
        );
        WorkflowSnapshot s2 = new WorkflowSnapshot(
            "wf_dag_1", "acme", "default", "dag-parallel-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            null, Map.of("start-node", startDone, "branch-a", branchADone, "branch-b", branchBRunning)
        );

        DecisionResult d2 = decider.decide(def, s2, 3000L);
        assertThat(d2.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(d2.commands()).isEmpty(); // Join waiting

        // 4. Pass 4: Branch B also completes -> Join node completes workflow
        TaskSnapshot branchBDone = new TaskSnapshot(
            "wf_dag_1_branch-b", "branch-b", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("resultB", 20),
            null, 2000L, 30000L, "w2"
        );
        WorkflowSnapshot s3 = new WorkflowSnapshot(
            "wf_dag_1", "acme", "default", "dag-parallel-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            null, Map.of("start-node", startDone, "branch-a", branchADone, "branch-b", branchBDone)
        );

        DecisionResult d3 = decider.decide(def, s3, 4000L);
        assertThat(d3.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
    }

    @Test
    @DisplayName("FORK_JOIN: multi-task parallel branches advance sequentially within each branch to completion")
    void testMultiTaskForkJoinBranches() {
        TaskDefinition forkNode = TaskDefinition.builder("fork-multi")
            .taskType(TaskType.FORK_JOIN)
            .forkTasks(List.of(
                List.of(
                    TaskDefinition.builder("branch1-step1").build(),
                    TaskDefinition.builder("branch1-step2").build()
                ),
                List.of(
                    TaskDefinition.builder("branch2-step1").build(),
                    TaskDefinition.builder("branch2-step2").build()
                )
            ))
            .build();

        TaskDefinition joinNode = TaskDefinition.builder("join-multi")
            .taskType(TaskType.JOIN)
            .joinOn(List.of("branch1-step2", "branch2-step2"))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("fork-multi-wf")
            .tasks(List.of(forkNode, joinNode))
            .build();

        // 1. Initial run: schedules branch1-step1 and branch2-step1
        WorkflowSnapshot s0 = new WorkflowSnapshot(
            "wf_fork_m", "acme", "default", "fork-multi-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            null, Collections.emptyMap()
        );

        DecisionResult d0 = decider.decide(def, s0, 1000L);
        assertThat(d0.commands()).hasSize(3); // Update fork + schedule branch1-step1 + schedule branch2-step1
        List<String> scheduledStep1s = d0.commands().stream()
            .filter(c -> c instanceof EngineCommand.ScheduleTask)
            .map(c -> ((EngineCommand.ScheduleTask) c).referenceName())
            .toList();
        assertThat(scheduledStep1s).containsExactlyInAnyOrder("branch1-step1", "branch2-step1");

        // 2. branch1-step1 finishes -> advances to branch1-step2 while branch2-step1 is still running
        TaskSnapshot forkSnap = new TaskSnapshot("f_m", "fork-multi", TaskType.FORK_JOIN, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("forkedBranches", 2), null, 1000L, 0L, null);
        TaskSnapshot b1s1Done = new TaskSnapshot("b1s1", "branch1-step1", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("s1_ok", true), null, 1000L, 0L, null);
        TaskSnapshot b2s1Running = new TaskSnapshot("b2s1", "branch2-step1", TaskType.SIMPLE, "default", TaskStatus.IN_PROGRESS, 1, Collections.emptyMap(), Collections.emptyMap(), null, 1000L, 0L, null);

        WorkflowSnapshot s1 = new WorkflowSnapshot(
            "wf_fork_m", "acme", "default", "fork-multi-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            null, Map.of("fork-multi", forkSnap, "branch1-step1", b1s1Done, "branch2-step1", b2s1Running)
        );

        DecisionResult d1 = decider.decide(def, s1, 2000L);
        assertThat(d1.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(d1.commands()).hasSize(1);
        EngineCommand.ScheduleTask step2Schedule = (EngineCommand.ScheduleTask) d1.commands().get(0);
        assertThat(step2Schedule.referenceName()).isEqualTo("branch1-step2");

        // 3. branch2-step1 and branch1-step2 finish -> schedule branch2-step2
        TaskSnapshot b1s2Done = new TaskSnapshot("b1s2", "branch1-step2", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("s2_ok", true), null, 2000L, 0L, null);
        TaskSnapshot b2s1Done = new TaskSnapshot("b2s1", "branch2-step1", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("b2s1_ok", true), null, 1000L, 0L, null);

        WorkflowSnapshot s2 = new WorkflowSnapshot(
            "wf_fork_m", "acme", "default", "fork-multi-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            null, Map.of("fork-multi", forkSnap, "branch1-step1", b1s1Done, "branch1-step2", b1s2Done, "branch2-step1", b2s1Done)
        );

        DecisionResult d2 = decider.decide(def, s2, 3000L);
        assertThat(d2.commands()).hasSize(1);
        EngineCommand.ScheduleTask b2s2Schedule = (EngineCommand.ScheduleTask) d2.commands().get(0);
        assertThat(b2s2Schedule.referenceName()).isEqualTo("branch2-step2");

        // 4. All final branch tasks finish -> Join barrier satisfies and workflow completes
        TaskSnapshot b2s2Done = new TaskSnapshot("b2s2", "branch2-step2", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("b2s2_ok", true), null, 3000L, 0L, null);

        WorkflowSnapshot s3 = new WorkflowSnapshot(
            "wf_fork_m", "acme", "default", "fork-multi-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            null, Map.of("fork-multi", forkSnap, "branch1-step1", b1s1Done, "branch1-step2", b1s2Done, "branch2-step1", b2s1Done, "branch2-step2", b2s2Done)
        );

        DecisionResult d3 = decider.decide(def, s3, 4000L);
        assertThat(d3.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
    }

    @Test
    @DisplayName("SWITCH: multi-task decision case branch advances sequentially to completion")
    void testMultiTaskSwitchBranch() {
        TaskDefinition switchTask = TaskDefinition.builder("switch-node")
            .taskType(TaskType.SWITCH)
            .inputParameters(Map.of("caseExpression", "${workflow.input.tier}"))
            .decisionCases(Map.of(
                "VIP", List.of(
                    TaskDefinition.builder("vip-step1-discount").build(),
                    TaskDefinition.builder("vip-step2-concierge").build()
                )
            ))
            .build();

        TaskDefinition followUp = TaskDefinition.builder("follow-up")
            .taskType(TaskType.SIMPLE)
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("switch-multi-wf")
            .tasks(List.of(switchTask, followUp))
            .build();

        // 1. Pass 1: Switch evaluates case -> schedules vip-step1-discount
        WorkflowSnapshot s0 = new WorkflowSnapshot(
            "wf_sw_m", "acme", "default", "switch-multi-wf", 1,
            WorkflowStatus.RUNNING, Map.of("tier", "VIP"), Collections.emptyMap(),
            null, Collections.emptyMap()
        );

        DecisionResult d0 = decider.decide(def, s0, 1000L);
        assertThat(d0.commands()).hasSize(2);
        EngineCommand.ScheduleTask firstSchedule = (EngineCommand.ScheduleTask) d0.commands().stream()
            .filter(c -> c instanceof EngineCommand.ScheduleTask)
            .findFirst()
            .orElseThrow();
        assertThat(firstSchedule.referenceName()).isEqualTo("vip-step1-discount");

        // 2. Pass 2: vip-step1 completes -> advances to vip-step2-concierge
        TaskSnapshot swSnap = new TaskSnapshot("sw1", "switch-node", TaskType.SWITCH, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("selectedCase", "VIP"), null, 1000L, 0L, null);
        TaskSnapshot s1Done = new TaskSnapshot("s1", "vip-step1-discount", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("discount", 0.25), null, 1000L, 0L, null);

        WorkflowSnapshot s1 = new WorkflowSnapshot(
            "wf_sw_m", "acme", "default", "switch-multi-wf", 1,
            WorkflowStatus.RUNNING, s0.inputPayload(), Collections.emptyMap(),
            null, Map.of("switch-node", swSnap, "vip-step1-discount", s1Done)
        );

        DecisionResult d1 = decider.decide(def, s1, 2000L);
        assertThat(d1.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(d1.commands()).hasSize(1);
        EngineCommand.ScheduleTask secondSchedule = (EngineCommand.ScheduleTask) d1.commands().get(0);
        assertThat(secondSchedule.referenceName()).isEqualTo("vip-step2-concierge");

        // 3. Pass 3: vip-step2 completes -> entire switch branch is complete, decider advances to follow-up
        TaskSnapshot s2Done = new TaskSnapshot("s2", "vip-step2-concierge", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("assigned", "VIP-Desk"), null, 2000L, 0L, null);

        WorkflowSnapshot s2 = new WorkflowSnapshot(
            "wf_sw_m", "acme", "default", "switch-multi-wf", 1,
            WorkflowStatus.RUNNING, s0.inputPayload(), Collections.emptyMap(),
            null, Map.of("switch-node", swSnap, "vip-step1-discount", s1Done, "vip-step2-concierge", s2Done)
        );

        DecisionResult d2 = decider.decide(def, s2, 3000L);
        assertThat(d2.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(d2.commands()).hasSize(1);
        EngineCommand.ScheduleTask followUpSchedule = (EngineCommand.ScheduleTask) d2.commands().get(0);
        assertThat(followUpSchedule.referenceName()).isEqualTo("follow-up");
    }

    @Test
    @DisplayName("DO_WHILE: executes multi-task loop iteratively until condition is false")
    void testDoWhileMultiTaskAndMultiIterationLoop() {
        TaskDefinition loopNode = TaskDefinition.builder("poll-status-loop")
            .taskType(TaskType.DO_WHILE)
            .inputParameters(Map.of("continueCondition", "${workflow.variables.continueLoop}"))
            .loopOver(List.of(
                TaskDefinition.builder("fetchStatus").build(),
                TaskDefinition.builder("validateStatus").build()
            ))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("dowhile-wf")
            .tasks(List.of(loopNode))
            .build();

        // 1. Initial pass: starts iteration 1, schedules fetchStatus (iter 1)
        WorkflowSnapshot s0 = new WorkflowSnapshot(
            "wf_loop_1", "acme", "default", "dowhile-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Map.of("continueLoop", true), null, Collections.emptyMap()
        );

        DecisionResult d0 = decider.decide(def, s0, 1000L);
        assertThat(d0.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        EngineCommand.ScheduleTask s0Cmd = (EngineCommand.ScheduleTask) d0.commands().stream()
            .filter(c -> c instanceof EngineCommand.ScheduleTask)
            .findFirst()
            .orElseThrow();
        assertThat(s0Cmd.referenceName()).isEqualTo("fetchStatus");
        assertThat(s0Cmd.attempt()).isEqualTo(1);

        // 2. fetchStatus (iter 1) completes -> advances to validateStatus (iter 1)
        TaskSnapshot loopSnapIter1 = new TaskSnapshot("lp1", "poll-status-loop", TaskType.DO_WHILE, "default", TaskStatus.IN_PROGRESS, 1, Collections.emptyMap(), Collections.emptyMap(), null, 1000L, 0L, null);
        TaskSnapshot fetchDoneIter1 = new TaskSnapshot("f1", "fetchStatus", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("status", "PENDING"), null, 1000L, 0L, null);

        WorkflowSnapshot s1 = new WorkflowSnapshot(
            "wf_loop_1", "acme", "default", "dowhile-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Map.of("continueLoop", true), null,
            Map.of("poll-status-loop", loopSnapIter1, "fetchStatus", fetchDoneIter1)
        );

        DecisionResult d1 = decider.decide(def, s1, 2000L);
        assertThat(d1.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        EngineCommand.ScheduleTask s1Cmd = (EngineCommand.ScheduleTask) d1.commands().stream()
            .filter(c -> c instanceof EngineCommand.ScheduleTask)
            .findFirst()
            .orElseThrow();
        assertThat(s1Cmd.referenceName()).isEqualTo("validateStatus");
        assertThat(s1Cmd.attempt()).isEqualTo(1);

        // 3. validateStatus (iter 1) completes with continueLoop=false -> loop terminates at finalIteration=1
        TaskSnapshot valDoneIter1 = new TaskSnapshot("v1", "validateStatus", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(), Map.of("verified", true), null, 2000L, 0L, null);

        WorkflowSnapshot s2 = new WorkflowSnapshot(
            "wf_loop_1", "acme", "default", "dowhile-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Map.of("continueLoop", false), null,
            Map.of("poll-status-loop", loopSnapIter1, "fetchStatus", fetchDoneIter1, "validateStatus", valDoneIter1)
        );

        DecisionResult d2 = decider.decide(def, s2, 3000L);
        assertThat(d2.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        assertThat(d2.outputPayload()).containsEntry("finalIteration", 1);
    }
}
