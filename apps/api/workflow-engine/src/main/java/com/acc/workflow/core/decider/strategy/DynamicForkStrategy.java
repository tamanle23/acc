package com.acc.workflow.core.decider.strategy;

import com.acc.workflow.core.expression.ParameterResolver;
import com.acc.workflow.core.model.EngineCommand;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.WorkflowSnapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * DYNAMIC_FORK strategy:
 * Reads a dynamic collection from input parameters and expands into parallel sub-tasks dynamically.
 */
public final class DynamicForkStrategy implements NodeEvaluatorStrategy {

    @Override
    public NodeEvaluationResult evaluate(
        TaskDefinition taskDef,
        WorkflowSnapshot snapshot,
        long nowEpochMs,
        ParameterResolver resolver
    ) {
        String refName = taskDef.taskReferenceName();
        TaskSnapshot existing = snapshot.tasksByRef().get(refName);

        Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
        Object rawItems = resolvedInput.get("dynamicForkTasksInput");

        List<?> items = rawItems instanceof List<?> list ? list : Collections.emptyList();

        if (existing == null) {
            List<EngineCommand> commands = new ArrayList<>();
            Map<String, Object> forkOutput = new java.util.LinkedHashMap<>();
            List<String> subTaskRefs = new ArrayList<>();

            for (int i = 0; i < items.size(); i++) {
                Object item = items.get(i);
                String subTaskRef = refName + "_" + i;
                subTaskRefs.add(subTaskRef);
                String subTaskId = snapshot.workflowId() + "_" + subTaskRef + "_att1";

                @SuppressWarnings("unchecked")
                Map<String, Object> subInput = item instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of("item", item);

                commands.add(new EngineCommand.ScheduleTask(
                    subTaskId,
                    "SIMPLE",
                    subTaskRef,
                    taskDef.domain(),
                    subInput,
                    1,
                    nowEpochMs,
                    (long) taskDef.timeoutSeconds() * 1000L
                ));
            }

            forkOutput.put("dynamicCount", items.size());
            forkOutput.put("dynamicRefs", subTaskRefs);

            if (items.isEmpty()) {
                forkOutput.put("results", Collections.emptyList());
                commands.add(new EngineCommand.UpdateTaskStatus(
                    snapshot.workflowId() + "_" + refName,
                    refName,
                    TaskStatus.COMPLETED,
                    forkOutput,
                    null
                ));
                return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, forkOutput, false);
            }

            // Parent enters IN_PROGRESS barrier state; halts progression until all dynamic children finish
            commands.add(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.IN_PROGRESS,
                forkOutput,
                null
            ));

            return new NodeEvaluationResult(TaskStatus.IN_PROGRESS, commands, forkOutput, true);
        }

        if (existing.status() == TaskStatus.COMPLETED) {
            return NodeEvaluationResult.completed(existing.outputData());
        } else if (existing.status() == TaskStatus.SKIPPED) {
            return NodeEvaluationResult.skipped();
        } else if (existing.status() == TaskStatus.FAILED) {
            return NodeEvaluationResult.failed(Collections.emptyList(), existing.errorMessage());
        }

        // Barrier synchronization: check state of all dynamically spawned child tasks
        List<?> dynamicRefs = existing.outputData() != null && existing.outputData().get("dynamicRefs") instanceof List<?> r
            ? r : Collections.emptyList();

        if (dynamicRefs.isEmpty()) {
            return NodeEvaluationResult.completed(existing.outputData() != null ? existing.outputData() : Collections.emptyMap());
        }

        boolean allCompleted = true;
        Map<String, Object> aggregated = new java.util.LinkedHashMap<>();
        aggregated.put("dynamicCount", dynamicRefs.size());
        List<Map<String, Object>> childOutputs = new ArrayList<>();

        for (Object refObj : dynamicRefs) {
            String childRef = String.valueOf(refObj);
            TaskSnapshot childSnap = snapshot.tasksByRef().get(childRef);

            if (childSnap == null) {
                allCompleted = false;
                break;
            }

            if (childSnap.status() == TaskStatus.FAILED || childSnap.status() == TaskStatus.TIMED_OUT) {
                // Fail-Fast: halt workflow progression immediately upon any child failure
                String childError = childSnap.errorMessage() != null ? childSnap.errorMessage() : "Dynamic child task failed";
                String failureReason = "Dynamic fork barrier failed at child '" + childRef + "': " + childError;
                List<EngineCommand> failCmds = List.of(new EngineCommand.UpdateTaskStatus(
                    snapshot.workflowId() + "_" + refName,
                    refName,
                    TaskStatus.FAILED,
                    Map.of("failedChild", childRef, "error", failureReason),
                    failureReason
                ));
                return NodeEvaluationResult.failed(failCmds, failureReason);
            }

            if (childSnap.status() != TaskStatus.COMPLETED) {
                allCompleted = false;
                break;
            }

            childOutputs.add(childSnap.outputData() != null ? childSnap.outputData() : Collections.emptyMap());
        }

        if (allCompleted) {
            aggregated.put("results", childOutputs);
            List<EngineCommand> completeCmds = List.of(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.COMPLETED,
                aggregated,
                null
            ));
            return new NodeEvaluationResult(TaskStatus.COMPLETED, completeCmds, aggregated, false);
        }

        // Barrier not yet satisfied: continue waiting in IN_PROGRESS
        return NodeEvaluationResult.inProgress();
    }
}
