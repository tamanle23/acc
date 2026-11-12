package com.acc.workflow.application;

import com.acc.workflow.core.model.MigrationTier;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Validates topological compatibility and classifies in-flight executions into 3 heuristic tiers
 * when performing Policy B: Hot Migration on an execution from v1 to v2.
 */
public class TopologicalCompatibilityValidator {

    public record MigrationValidationReport(
        boolean compatible,
        MigrationTier tier,
        String sourceVersion,
        String targetVersion,
        List<String> completedTasksPreserved,
        List<String> activeFrontierTasks,
        List<String> addedDownstreamTasks,
        List<String> removedTasks,
        List<String> issues,
        List<String> warnings
    ) {
        public MigrationValidationReport(
            boolean compatible,
            String sourceVersion,
            String targetVersion,
            List<String> completedTasksPreserved,
            List<String> activeFrontierTasks,
            List<String> addedDownstreamTasks,
            List<String> removedTasks,
            List<String> issues
        ) {
            this(
                compatible,
                compatible ? MigrationTier.FULLY_COMPATIBLE : MigrationTier.INCOMPATIBLE_BLOCK,
                sourceVersion,
                targetVersion,
                completedTasksPreserved,
                activeFrontierTasks,
                addedDownstreamTasks,
                removedTasks,
                issues,
                List.of()
            );
        }
    }

    public MigrationValidationReport validate(
        WorkflowDefinition sourceDef,
        WorkflowDefinition targetDef,
        WorkflowSnapshot currentExecution
    ) {
        List<String> issues = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (!sourceDef.workflowKey().equals(targetDef.workflowKey())) {
            issues.add("Workflow key mismatch: source is '" + sourceDef.workflowKey() + "' but target is '" + targetDef.workflowKey() + "'");
        }

        // Strict Terminal Prohibition: terminal executions cannot be migrated
        if (currentExecution.status().isTerminal()) {
            issues.add("Cannot hot-migrate execution in terminal state: " + currentExecution.status());
        } else if (currentExecution.status() != WorkflowStatus.RUNNING && currentExecution.status() != WorkflowStatus.PAUSED) {
            issues.add("Cannot hot-migrate execution in non-active state: " + currentExecution.status());
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
                    // Check if task definition modified for active task
                    TaskDefinition sourceTaskDef = sourceTaskMap.get(refName);
                    TaskDefinition targetTaskDef = targetTaskMap.get(refName);
                    if (sourceTaskDef != null && targetTaskDef != null) {
                        if (sourceTaskDef.taskType() != targetTaskDef.taskType()) {
                            warnings.add("Active task '" + refName + "' changed taskType from " + sourceTaskDef.taskType() + " to " + targetTaskDef.taskType());
                        }
                    }
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

        // Any removed unexecuted tasks are warnings if not completed
        for (String rem : removedTasks) {
            if (!currentExecution.tasksByRef().containsKey(rem)) {
                warnings.add("Unexecuted task '" + rem + "' was removed from definition in target version");
            }
        }

        // Check newly added tasks for input parameters that might require review
        for (String added : addedDownstreamTasks) {
            TaskDefinition addedDef = targetTaskMap.get(added);
            if (addedDef != null && !addedDef.inputParameters().isEmpty()) {
                warnings.add("Newly added task '" + added + "' introduces " + addedDef.inputParameters().size() + " parameter bindings");
            }
        }

        boolean isCompatible = issues.isEmpty();
        MigrationTier tier;
        if (!isCompatible) {
            tier = MigrationTier.INCOMPATIBLE_BLOCK;
        } else if (!warnings.isEmpty()) {
            tier = MigrationTier.CONDITIONAL_REQUIRES_MANUAL_REVIEW;
        } else {
            tier = MigrationTier.FULLY_COMPATIBLE;
        }

        return new MigrationValidationReport(
            isCompatible,
            tier,
            "v" + sourceDef.version(),
            "v" + targetDef.version(),
            completedTasksPreserved,
            activeFrontierTasks,
            addedDownstreamTasks,
            removedTasks,
            issues,
            warnings
        );
    }
}

