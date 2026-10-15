package com.unipost.workflow.core.decider.strategy;

import com.unipost.workflow.core.expression.ParameterResolver;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowSnapshot;

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

    private final HttpClient httpClient;

    public HttpNodeStrategy() {
        this(HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build());
    }

    public HttpNodeStrategy(HttpClient httpClient) {
        this.httpClient = httpClient;
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

        String method = ((String) resolvedInput.getOrDefault("method", "GET")).toUpperCase();
        long timeoutMs = 10000L;
        if (resolvedInput.get("readTimeoutMs") instanceof Number num) {
            timeoutMs = num.longValue();
        }

        try {
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMillis(timeoutMs));

            // Set headers if provided
            Object headersObj = resolvedInput.get("headers");
            if (headersObj instanceof Map<?, ?> headersMap) {
                for (Map.Entry<?, ?> entry : headersMap.entrySet()) {
                    if (entry.getKey() != null && entry.getValue() != null) {
                        reqBuilder.header(String.valueOf(entry.getKey()), String.valueOf(entry.getValue()));
                    }
                }
            }

            // Set method & body
            Object bodyObj = resolvedInput.get("body");
            HttpRequest.BodyPublisher bodyPublisher = bodyObj != null
                ? HttpRequest.BodyPublishers.ofString(String.valueOf(bodyObj))
                : HttpRequest.BodyPublishers.noBody();

            switch (method) {
                case "POST" -> reqBuilder.POST(bodyPublisher);
                case "PUT" -> reqBuilder.PUT(bodyPublisher);
                case "DELETE" -> reqBuilder.DELETE();
                case "PATCH" -> reqBuilder.method("PATCH", bodyPublisher);
                default -> reqBuilder.GET();
            }

            HttpResponse<String> response = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());

            Map<String, Object> output = new LinkedHashMap<>();
            output.put("statusCode", response.statusCode());
            output.put("body", response.body());

            boolean isSuccess = response.statusCode() >= 200 && response.statusCode() < 400;
            TaskStatus finalStatus = isSuccess ? TaskStatus.COMPLETED : TaskStatus.FAILED;
            String error = isSuccess ? null : "HTTP request failed with status " + response.statusCode();

            List<EngineCommand> commands = new ArrayList<>();
            commands.add(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                finalStatus,
                output,
                error
            ));

            if (isSuccess) {
                return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, output, false);
            } else {
                return NodeEvaluationResult.failed(commands, error);
            }

        } catch (Exception e) {
            String errorMsg = "HTTP call execution failed: " + e.getMessage();
            List<EngineCommand> commands = List.of(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.FAILED,
                Map.of("error", errorMsg),
                errorMsg
            ));
            return NodeEvaluationResult.failed(commands, errorMsg);
        }
    }
}
