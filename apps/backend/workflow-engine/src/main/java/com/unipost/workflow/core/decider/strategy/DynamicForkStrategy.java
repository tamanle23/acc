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
            Map<String, Object> forkOutput = new HashMap<>();

            for (int i = 0; i < items.size(); i++) {
                Object item = items.get(i);
                String subTaskRef = refName + "_" + i;
                String subTaskId = snapshot.workflowId() + "_" + subTaskRef + "_att1";

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
            commands.add(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.COMPLETED,
                forkOutput,
                null
            ));

            return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, forkOutput, false);
        }

        return NodeEvaluationResult.completed(existing.outputData());
    }
}
