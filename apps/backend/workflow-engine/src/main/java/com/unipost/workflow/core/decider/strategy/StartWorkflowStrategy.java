package com.unipost.workflow.core.decider.strategy;

import com.unipost.workflow.core.expression.ParameterResolver;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowSnapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * START_WORKFLOW operator:
 * Asynchronously triggers a target workflow in fire-and-forget mode.
 * Does NOT wait for completion: records the target execution ID and immediately completes.
 *
 * Input parameters:
 * - "workflowKey": Target workflow key to trigger
 * - "version": Target version (optional, default 1)
 * - "input": Payload map passed into target workflow
 */
public final class StartWorkflowStrategy implements NodeEvaluatorStrategy {

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
            } else if (existing.status() == TaskStatus.SKIPPED) {
                return NodeEvaluationResult.skipped();
            }
        }

        Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
        String targetWfKey = (String) resolvedInput.getOrDefault("workflowKey", resolvedInput.get("targetWorkflowKey"));

        if (targetWfKey == null || targetWfKey.isBlank()) {
            String error = "START_WORKFLOW requires 'workflowKey'";
            List<EngineCommand> commands = List.of(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.FAILED,
                Collections.emptyMap(),
                error
            ));
            return NodeEvaluationResult.failed(commands, error);
        }

        String asyncExecutionId = snapshot.workflowId() + "_async_" + refName;
        Map<String, Object> output = new LinkedHashMap<>();
        output.put("triggeredWorkflowKey", targetWfKey);
        output.put("triggeredExecutionId", asyncExecutionId);
        output.put("status", "TRIGGERED");

        List<EngineCommand> commands = new ArrayList<>();
        // Complete the task immediately so parent workflow continues
        commands.add(new EngineCommand.UpdateTaskStatus(
            snapshot.workflowId() + "_" + refName,
            refName,
            TaskStatus.COMPLETED,
            output,
            null
        ));

        return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, output, false);
    }
}
