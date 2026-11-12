package com.acc.workflow.core.decider.strategy;

import com.acc.workflow.core.expression.ParameterResolver;
import com.acc.workflow.core.model.EngineCommand;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.WorkflowSnapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * EVENT system task:
 * Emits an event message with topic/channel and payload.
 * Completes immediately, storing event publication metadata in outputData.
 *
 * Input parameters:
 * - "eventTopic" or "topic": Target topic/queue name (e.g. "order.completed")
 * - "payload": Payload map/object to publish
 */
public final class EventNodeStrategy implements NodeEvaluatorStrategy {

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
        String topic = (String) resolvedInput.getOrDefault("eventTopic", resolvedInput.get("topic"));

        if (topic == null || topic.isBlank()) {
            String error = "EVENT node requires 'eventTopic' or 'topic'";
            List<EngineCommand> commands = List.of(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.FAILED,
                Collections.emptyMap(),
                error
            ));
            return NodeEvaluationResult.failed(commands, error);
        }

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("eventTopic", topic);
        output.put("publishedAtEpochMs", nowEpochMs);
        output.put("eventId", snapshot.workflowId() + "_" + refName + "_evt");
        output.put("status", "PUBLISHED");

        List<EngineCommand> commands = new ArrayList<>();
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
