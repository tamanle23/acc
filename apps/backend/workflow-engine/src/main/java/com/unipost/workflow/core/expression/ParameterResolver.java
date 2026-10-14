package com.unipost.workflow.core.expression;

import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.WorkflowSnapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pure, deterministic parameter resolver for JSONPath-style expressions:
 * - ${workflow.input.x}
 * - ${<taskRef>.output.y}
 * - ${<taskRef>.input.z}
 *
 * Supports deep nested maps and list indexing (e.g. items[0].name).
 * Zero external libraries, zero I/O.
 */
public final class ParameterResolver {

    private static final Pattern EXPR_PATTERN = Pattern.compile("\\$\\{([^}]+)\\}");

    public Map<String, Object> resolve(Map<String, Object> inputParameters, WorkflowSnapshot snapshot) {
        if (inputParameters == null || inputParameters.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, Object> resolved = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : inputParameters.entrySet()) {
            resolved.put(entry.getKey(), resolveValue(entry.getValue(), snapshot));
        }
        return Collections.unmodifiableMap(resolved);
    }

    public Object resolveValue(Object value, WorkflowSnapshot snapshot) {
        if (value == null || snapshot == null) {
            return value;
        }

        if (value instanceof String str) {
            return resolveStringExpression(str, snapshot);
        } else if (value instanceof Map<?, ?> map) {
            Map<String, Object> resolvedMap = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String k = String.valueOf(entry.getKey());
                resolvedMap.put(k, resolveValue(entry.getValue(), snapshot));
            }
            return Collections.unmodifiableMap(resolvedMap);
        } else if (value instanceof List<?> list) {
            List<Object> resolvedList = new ArrayList<>(list.size());
            for (Object item : list) {
                resolvedList.add(resolveValue(item, snapshot));
            }
            return Collections.unmodifiableList(resolvedList);
        }

        return value;
    }

    private Object resolveStringExpression(String str, WorkflowSnapshot snapshot) {
        Matcher matcher = EXPR_PATTERN.matcher(str);

        // Exact single expression match: e.g. "${workflow.input.amount}"
        if (str.startsWith("${") && str.endsWith("}") && !str.substring(2, str.length() - 1).contains("${")) {
            String path = str.substring(2, str.length() - 1).trim();
            return extractPath(path, snapshot);
        }

        // String interpolation: e.g. "Order id: ${workflow.input.orderId} status: ${check.output.status}"
        StringBuilder sb = new StringBuilder();
        int lastIndex = 0;
        boolean matchedAny = false;

        while (matcher.find()) {
            matchedAny = true;
            sb.append(str, lastIndex, matcher.start());
            String path = matcher.group(1).trim();
            Object resolved = extractPath(path, snapshot);
            sb.append(resolved != null ? resolved.toString() : "");
            lastIndex = matcher.end();
        }

        if (matchedAny) {
            sb.append(str, lastIndex, str.length());
            return sb.toString();
        }

        return str;
    }

    public Object extractPath(String path, WorkflowSnapshot snapshot) {
        if (path == null || path.isBlank()) {
            return null;
        }

        String[] parts = path.split("\\.", 2);
        String root = parts[0].trim();
        String remainder = parts.length > 1 ? parts[1].trim() : null;

        Object current;
        if ("workflow".equalsIgnoreCase(root)) {
            if (remainder == null) {
                return null;
            }
            String[] subParts = remainder.split("\\.", 2);
            String scope = subParts[0].trim();
            String subPath = subParts.length > 1 ? subParts[1].trim() : null;

            if ("input".equalsIgnoreCase(scope)) {
                current = snapshot.inputPayload();
            } else if ("output".equalsIgnoreCase(scope)) {
                current = snapshot.outputPayload();
            } else if ("id".equalsIgnoreCase(scope) || "workflowId".equalsIgnoreCase(scope)) {
                return snapshot.workflowId();
            } else if ("status".equalsIgnoreCase(scope)) {
                return snapshot.status().name();
            } else {
                return null;
            }
            return navigate(current, subPath);
        } else {
            // Task reference name: e.g. "validate-order.output.isValid"
            TaskSnapshot task = snapshot.tasksByRef().get(root);
            if (task == null || remainder == null) {
                return null;
            }
            String[] subParts = remainder.split("\\.", 2);
            String scope = subParts[0].trim();
            String subPath = subParts.length > 1 ? subParts[1].trim() : null;

            if ("output".equalsIgnoreCase(scope)) {
                current = task.outputData();
            } else if ("input".equalsIgnoreCase(scope)) {
                current = task.inputData();
            } else if ("status".equalsIgnoreCase(scope)) {
                return task.status().name();
            } else if ("attempt".equalsIgnoreCase(scope)) {
                return task.attempt();
            } else {
                return null;
            }
            return navigate(current, subPath);
        }
    }

    @SuppressWarnings("unchecked")
    private Object navigate(Object current, String path) {
        if (current == null || path == null || path.isBlank()) {
            return current;
        }

        String[] tokens = path.split("\\.");
        Object target = current;

        for (String rawToken : tokens) {
            if (target == null) {
                return null;
            }
            String token = rawToken.trim();

            // Check for list indexing: e.g. items[0]
            if (token.contains("[") && token.endsWith("]")) {
                int bracketIdx = token.indexOf('[');
                String propertyName = token.substring(0, bracketIdx);
                String indexStr = token.substring(bracketIdx + 1, token.length() - 1);

                if (!propertyName.isEmpty()) {
                    if (target instanceof Map<?, ?> map) {
                        target = map.get(propertyName);
                    } else {
                        return null;
                    }
                }

                if (target instanceof List<?> list) {
                    try {
                        int index = Integer.parseInt(indexStr);
                        if (index >= 0 && index < list.size()) {
                            target = list.get(index);
                        } else {
                            return null;
                        }
                    } catch (NumberFormatException e) {
                        return null;
                    }
                } else {
                    return null;
                }
            } else {
                if (target instanceof Map<?, ?> map) {
                    target = map.get(token);
                } else {
                    return null;
                }
            }
        }

        return target;
    }
}
