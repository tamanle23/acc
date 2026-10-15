package com.unipost.workflow.core.decider.strategy;

import com.unipost.workflow.core.expression.ParameterResolver;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowSnapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * SUB_WORKFLOW operator:
 * Executes a child workflow synchronously as a sub-routine.
 *
 * Input parameters:
 * - "subWorkflowKey" or "workflowKey": Target workflow key to execute
 * - "version": Target version (optional, defaults to 1)
 * - "input": Payload map passed into the child workflow
 *
 * State flow:
 * 1. When first evaluated: generates a ScheduleTask command for the SUB_WORKFLOW
 *    with a child workflow execution ID. Transitions to IN_PROGRESS and halts progression.
 * 2. When sub-workflow completes: the engine acknowledges the task with the child's outputData.
 *    The decider completes the SUB_WORKFLOW task with that output and resumes execution.
 */
public final class SubWorkflowStrategy implements NodeEvaluatorStrategy {

    @Override
    public NodeEvaluationResult evaluate(
        TaskDefinition taskDef,
        WorkflowSnapshot snapshot,
        long nowEpochMs,
        ParameterResolver resolver
    ) {
        String refName = taskDef.taskReferenceName();
        TaskSnapshot existing = snapshot.tasksByRef().get(refName);

        if (existing == null) {
            Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
            String subWfKey = (String) resolvedInput.getOrDefault("subWorkflowKey", resolvedInput.get("workflowKey"));

            if (subWfKey == null || subWfKey.isBlank()) {
                String error = "SUB_WORKFLOW requires 'subWorkflowKey' or 'workflowKey'";
                List<EngineCommand> commands = List.of(new EngineCommand.UpdateTaskStatus(
                    snapshot.workflowId() + "_" + refName,
                    refName,
                    TaskStatus.FAILED,
                    Collections.emptyMap(),
                    error
                ));
                return NodeEvaluationResult.failed(commands, error);
            }

            String childWorkflowId = snapshot.workflowId() + "_sub_" + refName;
            Map<String, Object> taskInput = new HashMap<>(resolvedInput);
            taskInput.put("subWorkflowId", childWorkflowId);

            String taskId = snapshot.workflowId() + "_" + refName + "_att1";
            EngineCommand.ScheduleTask scheduleCmd = new EngineCommand.ScheduleTask(
                taskId,
                taskDef.taskType().name(),
                refName,
                taskDef.domain(),
                taskInput,
                1,
                nowEpochMs,
                (long) taskDef.timeoutSeconds() * 1000L
            );

            return NodeEvaluationResult.scheduled(List.of(scheduleCmd));
        }

        TaskStatus status = existing.status();
        if (status == TaskStatus.COMPLETED) {
            return NodeEvaluationResult.completed(existing.outputData());
        } else if (status == TaskStatus.SKIPPED) {
            return NodeEvaluationResult.skipped();
        } else if (status == TaskStatus.FAILED || status == TaskStatus.TIMED_OUT) {
            return NodeEvaluationResult.failed(Collections.emptyList(), existing.errorMessage());
        }

        // Sub-workflow still running
        return NodeEvaluationResult.inProgress();
    }
}
