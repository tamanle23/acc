package com.acc.workflow.core.decider.strategy;

import com.acc.workflow.core.expression.ParameterResolver;
import com.acc.workflow.core.model.EngineCommand;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.WorkflowSnapshot;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * HTTP system task strategy:
 * Executes HTTP/REST calls directly within the engine (using Java HttpClient on Virtual Threads)
 * without requiring external worker polling queues.
 *
 * Configurable inputs:
 * - "url" or "uri": The target endpoint (e.g. "https://api.example.com/orders")
 * - "method": HTTP verb (GET, POST, PUT, DELETE, PATCH). Defaults to GET.
 * - "headers": Map of header keys and values
 * - "body": Payload string or object (serialized to string)
 * - "readTimeoutMs": Request timeout in milliseconds (default 10,000)
 */
public final class HttpNodeStrategy implements NodeEvaluatorStrategy {

    public HttpNodeStrategy() {
    }

    public HttpNodeStrategy(java.net.http.HttpClient httpClient) {
        // Preserved for constructor backward compatibility
    }

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
            String url = (String) resolvedInput.getOrDefault("url", resolvedInput.get("uri"));
            if (url == null || url.isBlank()) {
                String errorMsg = "HTTP node requires 'url' or 'uri' input parameter";
                List<EngineCommand> commands = List.of(new EngineCommand.UpdateTaskStatus(
                    snapshot.workflowId() + "_" + refName,
                    refName,
                    TaskStatus.FAILED,
                    Collections.emptyMap(),
                    errorMsg
                ));
                return NodeEvaluationResult.failed(commands, errorMsg);
            }

            String taskId = snapshot.workflowId() + "_" + refName + "_att1";
            long timeoutMs = 10000L;
            if (resolvedInput.get("readTimeoutMs") instanceof Number num) {
                timeoutMs = num.longValue();
            } else if (taskDef.timeoutSeconds() > 0) {
                timeoutMs = (long) taskDef.timeoutSeconds() * 1000L;
            }

            String domain = (taskDef.domain() != null && !taskDef.domain().isBlank() && !"default".equals(taskDef.domain()))
                ? taskDef.domain()
                : "system:http";

            EngineCommand.ScheduleTask scheduleCmd = new EngineCommand.ScheduleTask(
                taskId,
                "HTTP",
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
                long timeoutMs = taskDef.timeoutSeconds() > 0 ? (long) taskDef.timeoutSeconds() * 1000L : 10000L;
                Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
                String domain = (taskDef.domain() != null && !taskDef.domain().isBlank() && !"default".equals(taskDef.domain()))
                    ? taskDef.domain()
                    : "system:http";

                EngineCommand.ScheduleTask retryCmd = new EngineCommand.ScheduleTask(
                    nextTaskId,
                    "HTTP",
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
