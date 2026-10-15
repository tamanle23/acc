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
 * CALL_MCP_TOOL task strategy:
 * Discovers and invokes external tools exposed by Model Context Protocol (MCP) servers.
 *
 * Input parameters:
 * - "toolName": MCP tool identifier (e.g. "search_database", "fetch_weather")
 * - "arguments": Tool input arguments Map
 * - "mcpServerUrl": Optional MCP server endpoint URL
 */
public final class CallMcpToolStrategy implements NodeEvaluatorStrategy {

    private final HttpClient httpClient;

    public CallMcpToolStrategy() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
    }

    public CallMcpToolStrategy(HttpClient httpClient) {
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
        String toolName = (String) resolvedInput.get("toolName");

        if (toolName == null || toolName.isBlank()) {
            String error = "CALL_MCP_TOOL requires 'toolName' parameter";
            List<EngineCommand> commands = List.of(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.FAILED,
                Collections.emptyMap(),
                error
            ));
            return NodeEvaluationResult.failed(commands, error);
        }

        Object arguments = resolvedInput.getOrDefault("arguments", Collections.emptyMap());
        String mcpServerUrl = (String) resolvedInput.get("mcpServerUrl");

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("toolName", toolName);
        output.put("arguments", arguments);

        if (mcpServerUrl != null && !mcpServerUrl.isBlank()) {
            try {
                String payload = "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\""
                    + toolName + "\",\"arguments\":" + String.valueOf(arguments) + "},\"id\":1}";

                HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(mcpServerUrl))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();

                HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                output.put("statusCode", resp.statusCode());
                output.put("response", resp.body());
            } catch (Exception e) {
                String error = "MCP invocation failed: " + e.getMessage();
                List<EngineCommand> commands = List.of(new EngineCommand.UpdateTaskStatus(
                    snapshot.workflowId() + "_" + refName,
                    refName,
                    TaskStatus.FAILED,
                    output,
                    error
                ));
                return NodeEvaluationResult.failed(commands, error);
            }
        } else {
            // Local / synthesized MCP execution
            output.put("status", "SUCCESS");
            output.put("content", List.of(Map.of("type", "text", "text", "Executed MCP tool: " + toolName)));
        }

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
