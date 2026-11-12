package com.acc.workflow.core.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Collections;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TaskDlqRecord(
    String dlqId,
    String taskId,
    String workflowId,
    String tenantId,
    String workspaceId,
    String taskType,
    String domain,
    String errorMessage,
    String errorStacktrace,
    Map<String, Object> payloadSnapshot,
    int retryCount,
    long isolatedAtMs,
    Long replayedAtMs,
    String status
) {
    public TaskDlqRecord {
        if (dlqId == null || dlqId.isBlank()) {
            throw new IllegalArgumentException("dlqId is required");
        }
        if (taskId == null || taskId.isBlank()) {
            throw new IllegalArgumentException("taskId is required");
        }
        if (workflowId == null || workflowId.isBlank()) {
            throw new IllegalArgumentException("workflowId is required");
        }
        if (tenantId == null || tenantId.isBlank()) {
            tenantId = "system";
        }
        if (workspaceId == null || workspaceId.isBlank()) {
            workspaceId = "default";
        }
        if (taskType == null || taskType.isBlank()) {
            taskType = "SIMPLE";
        }
        if (domain == null || domain.isBlank()) {
            domain = "default";
        }
        if (status == null || status.isBlank()) {
            status = "ISOLATED";
        }
        payloadSnapshot = payloadSnapshot != null ? Collections.unmodifiableMap(payloadSnapshot) : Collections.emptyMap();
    }
}
