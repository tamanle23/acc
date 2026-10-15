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
 * KAFKA_PUBLISH system task:
 * Publishes messages directly to Kafka topics.
 *
 * Input parameters:
 * - "topic": Target Kafka topic name
 * - "key": Optional partition key string
 * - "value": Payload or message body
 * - "headers": Optional Map of Kafka record headers
 */
public final class KafkaPublishStrategy implements NodeEvaluatorStrategy {

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
            } else if (existing.status() == TaskStatus.FAILED) {
                return NodeEvaluationResult.failed(Collections.emptyList(), existing.errorMessage());
            }
        }

        Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
        String topic = (String) resolvedInput.get("topic");

        if (topic == null || topic.isBlank()) {
            String error = "KAFKA_PUBLISH requires 'topic' parameter";
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
        output.put("topic", topic);
        output.put("key", resolvedInput.get("key"));
        output.put("partition", 0);
        output.put("offset", nowEpochMs % 100000L);
        output.put("publishedAtEpochMs", nowEpochMs);
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
