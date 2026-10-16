package com.unipost.workflow.application;

import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.TaskType;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TopologicalCompatibilityValidatorTest {

    private final TopologicalCompatibilityValidator validator = new TopologicalCompatibilityValidator();

    @Test
    @DisplayName("Should approve migration when target has added downstream tasks and all completed tasks exist")
    void shouldApproveValidMigration() {
        TaskDefinition t1 = TaskDefinition.builder("step1").taskType(TaskType.SIMPLE).build();
        TaskDefinition t2 = TaskDefinition.builder("step2").taskType(TaskType.SIMPLE).build();
        TaskDefinition t3 = TaskDefinition.builder("step3_new").taskType(TaskType.SIMPLE).build();

        WorkflowDefinition v1 = WorkflowDefinition.builder("order-flow").version(1).tasks(List.of(t1, t2)).build();
        WorkflowDefinition v2 = WorkflowDefinition.builder("order-flow").version(2).tasks(List.of(t1, t2, t3)).build();

        TaskSnapshot snap1 = new TaskSnapshot(
            "task_1", "step1", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1,
            Map.of(), Map.of(), null, 0, 30000, "w1"
        );
        TaskSnapshot snap2 = new TaskSnapshot(
            "task_2", "step2", TaskType.SIMPLE, "default", TaskStatus.IN_PROGRESS, 1,
            Map.of(), Map.of(), null, 0, 30000, "w1"
        );

        WorkflowSnapshot execution = new WorkflowSnapshot(
            "wf-1", "tenant-1", "default", "order-flow", 1, WorkflowStatus.RUNNING,
            Map.of(), Map.of(), null, Map.of("step1", snap1, "step2", snap2)
        );

        TopologicalCompatibilityValidator.MigrationValidationReport report = validator.validate(v1, v2, execution);

        assertThat(report.compatible()).isTrue();
        assertThat(report.issues()).isEmpty();
        assertThat(report.completedTasksPreserved()).containsExactly("step1");
        assertThat(report.activeFrontierTasks()).containsExactly("step2");
        assertThat(report.addedDownstreamTasks()).containsExactly("step3_new");
    }

    @Test
    @DisplayName("Should reject hot migration when completed task was removed in target version")
    void shouldRejectWhenCompletedTaskRemoved() {
        TaskDefinition t1 = TaskDefinition.builder("step1").taskType(TaskType.SIMPLE).build();
        TaskDefinition t2 = TaskDefinition.builder("step2").taskType(TaskType.SIMPLE).build();

        WorkflowDefinition v1 = WorkflowDefinition.builder("order-flow").version(1).tasks(List.of(t1, t2)).build();
        WorkflowDefinition v2 = WorkflowDefinition.builder("order-flow").version(2).tasks(List.of(t2)).build(); // step1 deleted!

        TaskSnapshot snap1 = new TaskSnapshot(
            "task_1", "step1", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1,
            Map.of(), Map.of(), null, 0, 30000, "w1"
        );

        WorkflowSnapshot execution = new WorkflowSnapshot(
            "wf-1", "tenant-1", "default", "order-flow", 1, WorkflowStatus.RUNNING,
            Map.of(), Map.of(), null, Map.of("step1", snap1)
        );

        TopologicalCompatibilityValidator.MigrationValidationReport report = validator.validate(v1, v2, execution);

        assertThat(report.compatible()).isFalse();
        assertThat(report.issues()).anyMatch(issue -> issue.contains("Completed task 'step1' does not exist in target version 2"));
    }
}
