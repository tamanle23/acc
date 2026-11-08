package com.acc.workflow.core.schema;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Immutable canonical contract specification for a workflow task node type.
 * Declares the standard JSON Schema (Draft 7) for inputs, outputs, and UI parameter descriptors.
 */
public record TaskTypeContract(
    String taskType,
    String category,
    String description,
    Map<String, Object> inputSchema,
    Map<String, Object> outputSchema,
    List<Map<String, Object>> parameterDescriptors
) {
    public TaskTypeContract {
        if (taskType == null || taskType.isBlank()) {
            throw new IllegalArgumentException("taskType is required");
        }
        if (category == null || category.isBlank()) {
            category = "SYSTEM";
        }
        inputSchema = inputSchema != null ? Collections.unmodifiableMap(inputSchema) : Collections.emptyMap();
        outputSchema = outputSchema != null ? Collections.unmodifiableMap(outputSchema) : Collections.emptyMap();
        parameterDescriptors = parameterDescriptors != null ? Collections.unmodifiableList(parameterDescriptors) : Collections.emptyList();
    }
}
