package com.acc.workflow.core.graph;

import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AcyclicityGuardTest {

    private AcyclicityGuard guard;

    @BeforeEach
    void setUp() {
        guard = new AcyclicityGuard();
    }

    @Test
    @DisplayName("Should validate and sort an acyclic DAG correctly")
    void shouldValidateAcyclicDag() {
        WorkflowDefinition def = WorkflowDefinition.builder("valid-dag")
            .tasks(List.of(
                TaskDefinition.builder("task-a").build(),
                TaskDefinition.builder("task-b").joinOn(List.of("task-a")).build(),
                TaskDefinition.builder("task-c").joinOn(List.of("task-a")).build(),
                TaskDefinition.builder("task-d").joinOn(List.of("task-b", "task-c")).build()
            ))
            .build();

        List<String> order = guard.validateAndSort(def);

        assertThat(order).contains("task-a", "task-b", "task-c", "task-d");
        assertThat(order.indexOf("task-a")).isLessThan(order.indexOf("task-b"));
        assertThat(order.indexOf("task-a")).isLessThan(order.indexOf("task-c"));
        assertThat(order.indexOf("task-b")).isLessThan(order.indexOf("task-d"));
        assertThat(order.indexOf("task-c")).isLessThan(order.indexOf("task-d"));
    }

    @Test
    @DisplayName("Should detect direct 2-node cycle and throw exception with cycle path")
    void shouldDetectDirectCycle() {
        WorkflowDefinition def = WorkflowDefinition.builder("cyclic-dag")
            .tasks(List.of(
                TaskDefinition.builder("task-a").joinOn(List.of("task-b")).build(),
                TaskDefinition.builder("task-b").joinOn(List.of("task-a")).build()
            ))
            .build();

        assertThatThrownBy(() -> guard.validateAndSort(def))
            .isInstanceOf(WorkflowCycleDetectedException.class)
            .hasMessageContaining("Cycle detected")
            .satisfies(ex -> {
                WorkflowCycleDetectedException cycleEx = (WorkflowCycleDetectedException) ex;
                assertThat(cycleEx.getCyclePath()).contains("task-a", "task-b");
            });
    }

    @Test
    @DisplayName("Should detect multi-node transitive cycle")
    void shouldDetectTransitiveCycle() {
        WorkflowDefinition def = WorkflowDefinition.builder("transitive-cycle")
            .tasks(List.of(
                TaskDefinition.builder("node-1").joinOn(List.of("node-3")).build(),
                TaskDefinition.builder("node-2").joinOn(List.of("node-1")).build(),
                TaskDefinition.builder("node-3").joinOn(List.of("node-2")).build()
            ))
            .build();

        assertThatThrownBy(() -> guard.validateAndSort(def))
            .isInstanceOf(WorkflowCycleDetectedException.class)
            .hasMessageContaining("Cycle detected");
    }

    @Test
    @DisplayName("Should reject workflow with multiple start nodes")
    void shouldRejectMultipleStartNodes() {
        WorkflowDefinition def = WorkflowDefinition.builder("multi-start")
            .tasks(List.of(
                TaskDefinition.builder("start-1").build(),
                TaskDefinition.builder("start-2").build(),
                TaskDefinition.builder("end-task").joinOn(List.of("start-1", "start-2")).build()
            ))
            .build();

        assertThatThrownBy(() -> guard.validateAndSort(def))
            .isInstanceOf(WorkflowTopologyException.class)
            .hasMessageContaining("Workflow definition must have exactly one start node, found 2");
    }

    @Test
    @DisplayName("Should reject workflow with multiple end nodes")
    void shouldRejectMultipleEndNodes() {
        WorkflowDefinition def = WorkflowDefinition.builder("multi-end")
            .tasks(List.of(
                TaskDefinition.builder("start-task").build(),
                TaskDefinition.builder("end-1").joinOn(List.of("start-task")).build(),
                TaskDefinition.builder("end-2").joinOn(List.of("start-task")).build()
            ))
            .build();

        assertThatThrownBy(() -> guard.validateAndSort(def))
            .isInstanceOf(WorkflowTopologyException.class)
            .hasMessageContaining("Workflow definition must have exactly one end node, found 2");
    }

    @Test
    @DisplayName("Should allow single-node workflow (which is both start and end)")
    void shouldAllowSingleNodeWorkflow() {
        WorkflowDefinition def = WorkflowDefinition.builder("single-node")
            .tasks(List.of(
                TaskDefinition.builder("solo-task").build()
            ))
            .build();

        List<String> order = guard.validateAndSort(def);
        assertThat(order).containsExactly("solo-task");
    }

    @Test
    @DisplayName("Should reject workflow with FORK_JOIN but missing JOIN task")
    void shouldRejectForkWithoutJoin() {
        WorkflowDefinition def = WorkflowDefinition.builder("unconverged-fork")
            .tasks(List.of(
                TaskDefinition.builder("start-task").build(),
                TaskDefinition.builder("fork-task").taskType(TaskType.FORK_JOIN).joinOn(List.of("start-task")).build(),
                TaskDefinition.builder("branch-1").joinOn(List.of("fork-task")).build(),
                TaskDefinition.builder("end-task").joinOn(List.of("branch-1")).build()
            ))
            .build();

        assertThatThrownBy(() -> guard.validateAndSort(def))
            .isInstanceOf(WorkflowTopologyException.class)
            .hasMessageContaining("Workflow contains FORK_JOIN task but no matching JOIN barrier task");
    }

    @Test
    @DisplayName("Should accept valid FORK_JOIN and JOIN pairing")
    void shouldAcceptValidForkJoinPair() {
        WorkflowDefinition def = WorkflowDefinition.builder("valid-fork-join")
            .tasks(List.of(
                TaskDefinition.builder("start-task").build(),
                TaskDefinition.builder("fork-task").taskType(TaskType.FORK_JOIN).joinOn(List.of("start-task")).build(),
                TaskDefinition.builder("b1").joinOn(List.of("fork-task")).build(),
                TaskDefinition.builder("b2").joinOn(List.of("fork-task")).build(),
                TaskDefinition.builder("join-barrier").taskType(TaskType.JOIN).joinOn(List.of("b1", "b2")).build(),
                TaskDefinition.builder("end-task").joinOn(List.of("join-barrier")).build()
            ))
            .build();

        List<String> order = guard.validateAndSort(def);
        assertThat(order).contains("start-task", "fork-task", "b1", "b2", "join-barrier", "end-task");
    }
}
