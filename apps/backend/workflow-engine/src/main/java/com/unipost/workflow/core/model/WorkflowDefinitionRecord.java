package com.unipost.workflow.core.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WorkflowDefinitionRecord(
    String definitionId,
    String tenantId,
    String workflowKey,
    int version,
    WorkflowVersionStatus status,
    String name,
    String description,
    WorkflowDefinition definition,
    Long publishedAtMs,
    String publishedBy,
    long createdAtMs,
    long updatedAtMs
) {
    public WorkflowDefinitionRecord {
        if (definitionId == null || definitionId.isBlank()) {
            throw new IllegalArgumentException("definitionId is required");
        }
        if (tenantId == null || tenantId.isBlank()) {
            tenantId = "system";
        }
        if (workflowKey == null || workflowKey.isBlank()) {
            throw new IllegalArgumentException("workflowKey is required");
        }
        if (version <= 0) {
            version = 1;
        }
        if (status == null) {
            status = WorkflowVersionStatus.DRAFT;
        }
        if (name == null || name.isBlank()) {
            name = workflowKey;
        }
    }
}
