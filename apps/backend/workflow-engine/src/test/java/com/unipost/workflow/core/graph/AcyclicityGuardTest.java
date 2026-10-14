package com.unipost.workflow.core.graph;

import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskType;
import com.unipost.workflow.core.model.WorkflowDefinition;
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
}
