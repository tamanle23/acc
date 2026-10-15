package com.unipost.workflow.core.decider.strategy;

import com.unipost.workflow.core.expression.ParameterResolver;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * TERMINATE operator:
 * Explicitly terminates the workflow immediately upon reaching this node.
 * Input parameters:
 * - "terminationStatus": "COMPLETED" or "FAILED" (defaults to "COMPLETED")
 * - "terminationReason": human-readable string reason
 * - "output": optional output payload to associate with workflow termination
 */
public final class TerminateNodeStrategy implements NodeEvaluatorStrategy {

    @Override
    public NodeEvaluationResult evaluate(
        TaskDefinition taskDef,
        WorkflowSnapshot snapshot,
        long nowEpochMs,
        ParameterResolver resolver
    ) {
        String refName = taskDef.taskReferenceName();
        TaskSnapshot existing = snapshot.tasksByRef().get(refName);

        if (existing != null) {
            if (existing.status() == TaskStatus.COMPLETED) {
                return NodeEvaluationResult.completed(existing.outputData());
            } else if (existing.status() == TaskStatus.FAILED) {
                return NodeEvaluationResult.failed(Collections.emptyList(), existing.errorMessage());
            }
        }

        Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
        String statusStr = (String) resolvedInput.getOrDefault("terminationStatus", "COMPLETED");
        String reason = (String) resolvedInput.getOrDefault("terminationReason", "Workflow terminated by TERMINATE task: " + refName);

        @SuppressWarnings("unchecked")
        Map<String, Object> terminationOutput = resolvedInput.get("output") instanceof Map<?, ?> outMap
            ? (Map<String, Object>) outMap
            : resolvedInput;

        boolean isFailed = "FAILED".equalsIgnoreCase(statusStr);
        WorkflowStatus targetWfStatus = isFailed ? WorkflowStatus.FAILED : WorkflowStatus.COMPLETED;
        TaskStatus taskStatus = isFailed ? TaskStatus.FAILED : TaskStatus.COMPLETED;

        List<EngineCommand> commands = new ArrayList<>();
        // 1. Mark the terminate task
        commands.add(new EngineCommand.UpdateTaskStatus(
            snapshot.workflowId() + "_" + refName,
            refName,
            taskStatus,
            terminationOutput,
            isFailed ? reason : null
        ));

        // 2. Transition the entire workflow immediately
        commands.add(new EngineCommand.TransitionWorkflow(
            targetWfStatus,
            terminationOutput,
            reason
        ));

        if (isFailed) {
            return NodeEvaluationResult.failed(commands, reason);
        } else {
            return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, terminationOutput, true);
        }
    }
}
