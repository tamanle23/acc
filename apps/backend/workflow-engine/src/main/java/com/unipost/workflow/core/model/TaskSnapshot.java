package com.unipost.workflow.core.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Collections;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TaskSnapshot(
    String taskId,
    String taskReferenceName,
    TaskType taskType,
    String domain,
    TaskStatus status,
    int attempt,
    Map<String, Object> inputData,
    Map<String, Object> outputData,
    String errorMessage,
    long visibleAtEpochMs,
    long responseTimeoutMs,
    String workerId
) {
    public TaskSnapshot {
        if (taskId == null || taskId.isBlank()) {
            throw new IllegalArgumentException("taskId is required");
        }
        if (taskReferenceName == null || taskReferenceName.isBlank()) {
            throw new IllegalArgumentException("taskReferenceName is required");
        }
        if (taskType == null) {
            taskType = TaskType.SIMPLE;
        }
        if (domain == null || domain.isBlank()) {
            domain = "default";
        }
        if (status == null) {
            status = TaskStatus.SCHEDULED;
        }
        if (attempt <= 0) {
            attempt = 1;
        }
        inputData = inputData != null ? Collections.unmodifiableMap(inputData) : Collections.emptyMap();
        outputData = outputData != null ? Collections.unmodifiableMap(outputData) : Collections.emptyMap();
    }

    public TaskSnapshot withStatus(TaskStatus newStatus, Map<String, Object> newOutput, String error) {
        return new TaskSnapshot(
            taskId, taskReferenceName, taskType, domain, newStatus, attempt,
            inputData, newOutput != null ? newOutput : outputData, error,
            visibleAtEpochMs, responseTimeoutMs, workerId
        );
    }

    public String workflowId() {
        int idx = taskId.lastIndexOf('_');
        if (idx > 0) {
            String prefix = taskId.substring(0, idx);
            int secondIdx = prefix.lastIndexOf('_');
            if (secondIdx > 0) {
                return prefix.substring(0, secondIdx);
            }
            return prefix;
        }
        return taskId;
    }
}
