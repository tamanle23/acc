package com.acc.workflow.core.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Collections;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TaskDefinitionRecord(
    String taskDefId,
    String tenantId,
    String name,
    int version,
    WorkflowVersionStatus status,
    String description,
    int retryCount,
    int retryDelaySeconds,
    double backoffRate,
    int timeoutSeconds,
    Map<String, Object> inputSchema,
    Map<String, Object> outputSchema,
    String changelogNote,
    Long publishedAtMs,
    String publishedBy,
    long createdAtMs,
    long updatedAtMs,
    String createdBy
) {
    public TaskDefinitionRecord {
        if (tenantId == null || tenantId.isBlank()) {
            tenantId = "system";
        }
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Task definition name is required");
        }
        if (version <= 0) {
            version = 1;
        }
        if (taskDefId == null || taskDefId.isBlank()) {
            taskDefId = tenantId + ":" + name + ":v" + version;
        }
        if (status == null) {
            status = WorkflowVersionStatus.DRAFT;
        }
        if (retryCount < 0) {
            retryCount = 3;
        }
        if (retryDelaySeconds < 0) {
            retryDelaySeconds = 2;
        }
        if (backoffRate < 1.0) {
            backoffRate = 2.0;
        }
        if (timeoutSeconds <= 0) {
            timeoutSeconds = 30;
        }
        if (createdBy == null || createdBy.isBlank()) {
            createdBy = "SYSTEM";
        }
        inputSchema = inputSchema != null ? Collections.unmodifiableMap(inputSchema) : Collections.emptyMap();
        outputSchema = outputSchema != null ? Collections.unmodifiableMap(outputSchema) : Collections.emptyMap();
    }

    public static Builder builder(String name) {
        return new Builder(name);
    }

    public static class Builder {
        private String taskDefId;
        private String tenantId = "system";
        private final String name;
        private int version = 1;
        private WorkflowVersionStatus status = WorkflowVersionStatus.DRAFT;
        private String description = "";
        private int retryCount = 3;
        private int retryDelaySeconds = 2;
        private double backoffRate = 2.0;
        private int timeoutSeconds = 30;
        private Map<String, Object> inputSchema = Collections.emptyMap();
        private Map<String, Object> outputSchema = Collections.emptyMap();
        private String changelogNote = "";
        private Long publishedAtMs;
        private String publishedBy;
        private long createdAtMs = System.currentTimeMillis();
        private long updatedAtMs = System.currentTimeMillis();
        private String createdBy = "SYSTEM";

        public Builder(String name) {
            this.name = name;
        }

        public Builder taskDefId(String taskDefId) { this.taskDefId = taskDefId; return this; }
        public Builder tenantId(String tenantId) { this.tenantId = tenantId; return this; }
        public Builder version(int version) { this.version = version; return this; }
        public Builder status(WorkflowVersionStatus status) { this.status = status; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder retryCount(int retryCount) { this.retryCount = retryCount; return this; }
        public Builder retryDelaySeconds(int retryDelaySeconds) { this.retryDelaySeconds = retryDelaySeconds; return this; }
        public Builder backoffRate(double backoffRate) { this.backoffRate = backoffRate; return this; }
        public Builder timeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; return this; }
        public Builder inputSchema(Map<String, Object> inputSchema) { this.inputSchema = inputSchema; return this; }
        public Builder outputSchema(Map<String, Object> outputSchema) { this.outputSchema = outputSchema; return this; }
        public Builder changelogNote(String changelogNote) { this.changelogNote = changelogNote; return this; }
        public Builder publishedAtMs(Long publishedAtMs) { this.publishedAtMs = publishedAtMs; return this; }
        public Builder publishedBy(String publishedBy) { this.publishedBy = publishedBy; return this; }
        public Builder createdAtMs(long createdAtMs) { this.createdAtMs = createdAtMs; return this; }
        public Builder updatedAtMs(long updatedAtMs) { this.updatedAtMs = updatedAtMs; return this; }
        public Builder createdBy(String createdBy) { this.createdBy = createdBy; return this; }

        public TaskDefinitionRecord build() {
            return new TaskDefinitionRecord(
                taskDefId, tenantId, name, version, status, description,
                retryCount, retryDelaySeconds, backoffRate, timeoutSeconds,
                inputSchema, outputSchema, changelogNote, publishedAtMs,
                publishedBy, createdAtMs, updatedAtMs, createdBy
            );
        }
    }
}
