package com.unipost.workflow.core.decider.strategy;

import com.unipost.workflow.core.expression.ParameterResolver;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowSnapshot;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * DYNAMIC operator:
 * Dynamically resolves the actual task type or task name from upstream input at runtime.
 *
 * Input parameters:
 * - "dynamicTaskType" or "taskType": String task type name (e.g. "order-vip-dispatch")
 * - "input": Payload passed to the dynamic task
 */
public final class DynamicTaskStrategy implements NodeEvaluatorStrategy {

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
            String dynamicType = (String) resolvedInput.getOrDefault("dynamicTaskType", resolvedInput.get("taskType"));

            if (dynamicType == null || dynamicType.isBlank()) {
                String error = "DYNAMIC task requires 'dynamicTaskType' or 'taskType'";
                List<EngineCommand> commands = List.of(new EngineCommand.UpdateTaskStatus(
                    snapshot.workflowId() + "_" + refName,
                    refName,
                    TaskStatus.FAILED,
                    Collections.emptyMap(),
                    error
                ));
                return NodeEvaluationResult.failed(commands, error);
            }

            String taskId = snapshot.workflowId() + "_" + refName + "_att1";
            EngineCommand.ScheduleTask scheduleCmd = new EngineCommand.ScheduleTask(
                taskId,
                dynamicType,
                refName,
                taskDef.domain(),
                resolvedInput,
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

        return NodeEvaluationResult.inProgress();
    }
}
