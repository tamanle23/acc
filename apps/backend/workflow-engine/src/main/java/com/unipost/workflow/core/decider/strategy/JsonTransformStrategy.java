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
 * JSON_JQ_TRANSFORM system task:
 * Performs in-engine JSON extraction, reshaping, and projection without external worker polling.
 * Accepts:
 * - "queryExpression": JSONPath-like field path (e.g. "order.items[0].id" or "user.profile")
 * - "input": The source Map or List to extract from
 * - "projection": An optional template map where keys are target field names and values are expressions
 */
public final class JsonTransformStrategy implements NodeEvaluatorStrategy {

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
        Map<String, Object> output = new LinkedHashMap<>();

        Object source = resolvedInput.get("input");
        Object queryExpr = resolvedInput.get("queryExpression");
        Object projection = resolvedInput.get("projection");

        if (projection instanceof Map<?, ?> projMap) {
            // Field-by-field projection mapping
            for (Map.Entry<?, ?> entry : projMap.entrySet()) {
                String targetKey = String.valueOf(entry.getKey());
                Object exprVal = entry.getValue();
                output.put(targetKey, resolver.resolveValue(exprVal, snapshot));
            }
        } else if (queryExpr instanceof String qStr && source != null) {
            // Simple path extraction
            Object extracted = extractFromSource(source, qStr);
            output.put("result", extracted);
        } else {
            // Passthrough with resolved inputs
            output.putAll(resolvedInput);
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

    private Object extractFromSource(Object source, String path) {
        if (source == null || path == null || path.isBlank()) {
            return source;
        }
        String[] tokens = path.split("\\.");
        Object current = source;

        for (String rawToken : tokens) {
            if (current == null) return null;
            String token = rawToken.trim();

            if (token.contains("[") && token.endsWith("]")) {
                int bracketIdx = token.indexOf('[');
                String prop = token.substring(0, bracketIdx);
                String idxStr = token.substring(bracketIdx + 1, token.length() - 1);

                if (!prop.isEmpty() && current instanceof Map<?, ?> map) {
                    current = map.get(prop);
                }
                if (current instanceof List<?> list) {
                    try {
                        int idx = Integer.parseInt(idxStr);
                        current = (idx >= 0 && idx < list.size()) ? list.get(idx) : null;
                    } catch (NumberFormatException e) {
                        return null;
                    }
                } else {
                    return null;
                }
            } else if (current instanceof Map<?, ?> map) {
                current = map.get(token);
            } else {
                return null;
            }
        }
        return current;
    }
}
