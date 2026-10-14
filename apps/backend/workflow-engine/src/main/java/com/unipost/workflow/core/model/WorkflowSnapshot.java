package com.unipost.workflow.core.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WorkflowSnapshot(
    String workflowId,
    String tenantId,
    String workspaceId,
    String workflowKey,
    int version,
    WorkflowStatus status,
    Map<String, Object> inputPayload,
    Map<String, Object> outputPayload,
    String failureReason,
    Map<String, TaskSnapshot> tasksByRef
) {
    public WorkflowSnapshot {
        if (workflowId == null || workflowId.isBlank()) {
            throw new IllegalArgumentException("workflowId is required");
        }
        if (tenantId == null || tenantId.isBlank()) {
            tenantId = "system";
        }
        if (workspaceId == null || workspaceId.isBlank()) {
            workspaceId = "default";
        }
        if (workflowKey == null || workflowKey.isBlank()) {
            throw new IllegalArgumentException("workflowKey is required");
        }
        if (version <= 0) {
            version = 1;
        }
        if (status == null) {
            status = WorkflowStatus.RUNNING;
        }
        inputPayload = inputPayload != null ? Collections.unmodifiableMap(inputPayload) : Collections.emptyMap();
        outputPayload = outputPayload != null ? Collections.unmodifiableMap(outputPayload) : Collections.emptyMap();
        tasksByRef = tasksByRef != null ? Collections.unmodifiableMap(tasksByRef) : Collections.emptyMap();
    }

    public Optional<TaskSnapshot> getTask(String taskReferenceName) {
        return Optional.ofNullable(tasksByRef.get(taskReferenceName));
    }
}
