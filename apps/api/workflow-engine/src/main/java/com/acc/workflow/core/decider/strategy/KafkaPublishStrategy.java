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

        if (existing == null) {
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

            String taskId = snapshot.workflowId() + "_" + refName + "_att1";
            long timeoutMs = taskDef.timeoutSeconds() > 0 ? (long) taskDef.timeoutSeconds() * 1000L : 15000L;
            String domain = (taskDef.domain() != null && !taskDef.domain().isBlank() && !"default".equals(taskDef.domain()))
                ? taskDef.domain()
                : "system:kafka";

            EngineCommand.ScheduleTask scheduleCmd = new EngineCommand.ScheduleTask(
                taskId,
                "KAFKA_PUBLISH",
                refName,
                domain,
                resolvedInput,
                1,
                nowEpochMs,
                timeoutMs
            );
            return NodeEvaluationResult.scheduled(List.of(scheduleCmd));
        }

        TaskStatus status = existing.status();
        if (status == TaskStatus.COMPLETED) {
            return NodeEvaluationResult.completed(existing.outputData());
        } else if (status == TaskStatus.SKIPPED) {
            return NodeEvaluationResult.skipped();
        } else if (status == TaskStatus.IN_PROGRESS || status == TaskStatus.SCHEDULED) {
            return NodeEvaluationResult.inProgress();
        } else if (status == TaskStatus.FAILED || status == TaskStatus.TIMED_OUT) {
            if (existing.attempt() < taskDef.retryCount()) {
                int nextAttempt = existing.attempt() + 1;
                String nextTaskId = snapshot.workflowId() + "_" + refName + "_att" + nextAttempt;
                long backoffDelayMs = (long) (taskDef.retryDelaySeconds() * Math.pow(taskDef.backoffRate(), existing.attempt() - 1)) * 1000L;
                long nextVisibleAtEpochMs = nowEpochMs + backoffDelayMs;
                long timeoutMs = taskDef.timeoutSeconds() > 0 ? (long) taskDef.timeoutSeconds() * 1000L : 15000L;
                Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
                String domain = (taskDef.domain() != null && !taskDef.domain().isBlank() && !"default".equals(taskDef.domain()))
                    ? taskDef.domain()
                    : "system:kafka";

                EngineCommand.ScheduleTask retryCmd = new EngineCommand.ScheduleTask(
                    nextTaskId,
                    "KAFKA_PUBLISH",
                    refName,
                    domain,
                    resolvedInput,
                    nextAttempt,
                    nextVisibleAtEpochMs,
                    timeoutMs
                );
                return NodeEvaluationResult.scheduled(List.of(retryCmd));
            }
            return NodeEvaluationResult.failed(Collections.emptyList(), existing.errorMessage());
        }

        return NodeEvaluationResult.inProgress();
    }
}
