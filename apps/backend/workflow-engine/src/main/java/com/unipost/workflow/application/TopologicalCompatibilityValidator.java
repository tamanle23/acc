package com.unipost.workflow.application;

import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Validates topological compatibility when performing Policy B: Hot Migration
 * on an in-flight workflow execution from v1 to v2.
 */
public class TopologicalCompatibilityValidator {

    public record MigrationValidationReport(
        boolean compatible,
        String sourceVersion,
        String targetVersion,
        List<String> completedTasksPreserved,
        List<String> activeFrontierTasks,
        List<String> addedDownstreamTasks,
        List<String> removedTasks,
        List<String> issues
    ) {}

    public MigrationValidationReport validate(
        WorkflowDefinition sourceDef,
        WorkflowDefinition targetDef,
        WorkflowSnapshot currentExecution
    ) {
        List<String> issues = new ArrayList<>();

        if (!sourceDef.workflowKey().equals(targetDef.workflowKey())) {
            issues.add("Workflow key mismatch: source is '" + sourceDef.workflowKey() + "' but target is '" + targetDef.workflowKey() + "'");
        }

        if (currentExecution.status() != WorkflowStatus.RUNNING) {
            issues.add("Cannot hot-migrate execution in non-RUNNING state: " + currentExecution.status());
        }

        Map<String, TaskDefinition> targetTaskMap = targetDef.tasks().stream()
            .collect(Collectors.toMap(TaskDefinition::taskReferenceName, t -> t, (a, b) -> a));

        Map<String, TaskDefinition> sourceTaskMap = sourceDef.tasks().stream()
            .collect(Collectors.toMap(TaskDefinition::taskReferenceName, t -> t, (a, b) -> a));

        List<String> completedTasksPreserved = new ArrayList<>();
        List<String> activeFrontierTasks = new ArrayList<>();

        // 1. Verify all completed tasks in source exist in target
        for (Map.Entry<String, TaskSnapshot> entry : currentExecution.tasksByRef().entrySet()) {
            String refName = entry.getKey();
            TaskSnapshot task = entry.getValue();

            if (task.status().isTerminal()) {
                if (!targetTaskMap.containsKey(refName)) {
                    issues.add("Critical: Completed task '" + refName + "' does not exist in target version " + targetDef.version());
                } else {
                    completedTasksPreserved.add(refName);
                }
            } else {
                // In-flight or frontier task
                if (!targetTaskMap.containsKey(refName)) {
                    issues.add("Critical: In-flight frontier task '" + refName + "' is absent in target version " + targetDef.version());
                } else {
                    activeFrontierTasks.add(refName);
                }
            }
        }

        // 2. Identify added and removed tasks
        Set<String> sourceRefs = sourceTaskMap.keySet();
        Set<String> targetRefs = targetTaskMap.keySet();

        List<String> addedDownstreamTasks = targetRefs.stream()
            .filter(r -> !sourceRefs.contains(r))
            .collect(Collectors.toList());

        List<String> removedTasks = sourceRefs.stream()
            .filter(r -> !targetRefs.contains(r))
            .collect(Collectors.toList());

        boolean isCompatible = issues.isEmpty();

        return new MigrationValidationReport(
            isCompatible,
            "v" + sourceDef.version(),
            "v" + targetDef.version(),
            completedTasksPreserved,
            activeFrontierTasks,
            addedDownstreamTasks,
            removedTasks,
            issues
        );
    }
}
