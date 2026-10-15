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
 * LLM_CHAT_COMPLETE task strategy:
 * Executes an AI/LLM chat prompt.
 *
 * Input parameters:
 * - "prompt": User prompt or instructions
 * - "model": Model identifier (e.g. "gemini-1.5-pro", "gpt-4o", "mock-llm")
 * - "systemPrompt": System prompt context
 * - "temperature": Sampling temperature (optional)
 * - "endpointUrl": Optional custom LLM provider endpoint
 * - "apiKey": Optional authorization key
 *
 * Defaults:
 * If no external endpoint is provided or in offline/local environments, returns
 * a deterministic synthesized response structure with metadata.
 */
public final class LlmChatCompleteStrategy implements NodeEvaluatorStrategy {

    private final HttpClient httpClient;

    public LlmChatCompleteStrategy() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
    }

    public LlmChatCompleteStrategy(HttpClient httpClient) {
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
        String prompt = (String) resolvedInput.get("prompt");
        if (prompt == null || prompt.isBlank()) {
            String error = "LLM_CHAT_COMPLETE requires 'prompt'";
            List<EngineCommand> commands = List.of(new EngineCommand.UpdateTaskStatus(
                snapshot.workflowId() + "_" + refName,
                refName,
                TaskStatus.FAILED,
                Collections.emptyMap(),
                error
            ));
            return NodeEvaluationResult.failed(commands, error);
        }

        String model = (String) resolvedInput.getOrDefault("model", "gemini-1.5-pro");
        String endpointUrl = (String) resolvedInput.get("endpointUrl");

        Map<String, Object> output = new LinkedHashMap<>();
        output.put("model", model);
        output.put("prompt", prompt);

        if (endpointUrl != null && !endpointUrl.isBlank()) {
            try {
                HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(endpointUrl))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json");

                String apiKey = (String) resolvedInput.get("apiKey");
                if (apiKey != null && !apiKey.isBlank()) {
                    reqBuilder.header("Authorization", "Bearer " + apiKey);
                }

                String payload = "{\"model\":\"" + model + "\",\"prompt\":\"" + prompt.replace("\"", "\\\"") + "\"}";
                reqBuilder.POST(HttpRequest.BodyPublishers.ofString(payload));

                HttpResponse<String> resp = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
                output.put("statusCode", resp.statusCode());
                output.put("response", resp.body());
            } catch (Exception e) {
                String error = "LLM API invocation failed: " + e.getMessage();
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
            // Local / synthesized completion
            output.put("response", "AI completion for: " + prompt);
            output.put("tokensUsed", prompt.length() / 4 + 10);
            output.put("finishReason", "stop");
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
