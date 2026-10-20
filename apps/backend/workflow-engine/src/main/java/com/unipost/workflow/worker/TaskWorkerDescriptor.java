package com.unipost.workflow.worker;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Collections;
import java.util.Map;

/**
 * Metadata descriptor for a registered SIMPLE task worker, surfaced in the
 * Workflow Engine Worker Catalog (/api/v1/workflow/workers/catalog) and VisualDagStudio.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TaskWorkerDescriptor(
    String taskName,
    String domain,
    String description,
    int maxConcurrency,
    long timeoutSeconds,
    Map<String, Object> inputSchema,
    Map<String, Object> outputSchema
) {
    public TaskWorkerDescriptor {
        if (taskName == null || taskName.isBlank()) {
            throw new IllegalArgumentException("taskName is required");
        }
        if (domain == null || domain.isBlank()) {
            domain = "default";
        }
        if (description == null) {
            description = "";
        }
        if (maxConcurrency <= 0) {
            maxConcurrency = 16;
        }
        if (timeoutSeconds <= 0) {
            timeoutSeconds = 30L;
        }
        inputSchema = inputSchema != null ? Collections.unmodifiableMap(inputSchema) : Collections.emptyMap();
        outputSchema = outputSchema != null ? Collections.unmodifiableMap(outputSchema) : Collections.emptyMap();
    }
}
