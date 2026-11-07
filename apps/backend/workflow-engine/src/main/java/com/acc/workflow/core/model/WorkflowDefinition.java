package com.acc.workflow.core.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WorkflowDefinition(
    String workflowKey,
    Integer version,
    String name,
    String description,
    Integer timeoutSeconds,
    List<TaskDefinition> tasks,
    Map<String, Object> layoutMetadata
) {
    public WorkflowDefinition {
        if (workflowKey == null || workflowKey.isBlank()) {
            throw new IllegalArgumentException("workflowKey is required");
        }
        if (version == null || version <= 0) {
            version = 1;
        }
        if (name == null || name.isBlank()) {
            name = workflowKey;
        }
        if (timeoutSeconds == null || timeoutSeconds <= 0) {
            timeoutSeconds = 3600;
        }
        tasks = tasks != null ? Collections.unmodifiableList(tasks) : Collections.emptyList();
        layoutMetadata = layoutMetadata != null ? Collections.unmodifiableMap(layoutMetadata) : Collections.emptyMap();
    }

    public static WorkflowDefinition createBlank(String workflowKey, String name, String description) {
        TaskDefinition startTask = TaskDefinition.builder("workflow_start")
            .taskType(TaskType.START_WORKFLOW)
            .domain("default")
            .build();

        TaskDefinition endTask = TaskDefinition.builder("workflow_end")
            .taskType(TaskType.END_WORKFLOW)
            .domain("default")
            .build();

        Map<String, Object> layout = Map.of(
            "workflow_start", Map.of("x", 100, "y", 200, "isPermanent", true, "isStartNode", true),
            "workflow_end", Map.of("x", 500, "y", 200, "isPermanent", true, "isEndNode", true)
        );

        return new WorkflowDefinition(
            workflowKey,
            1,
            name != null && !name.isBlank() ? name : workflowKey,
            description,
            3600,
            List.of(startTask, endTask),
            layout
        );
    }

    public static Builder builder(String workflowKey) {
        return new Builder(workflowKey);
    }

    public static class Builder {
        private final String workflowKey;
        private int version = 1;
        private String name;
        private String description;
        private int timeoutSeconds = 3600;
        private List<TaskDefinition> tasks = Collections.emptyList();
        private Map<String, Object> layoutMetadata = Collections.emptyMap();

        public Builder(String workflowKey) {
            this.workflowKey = workflowKey;
        }

        public Builder version(int version) {
            this.version = version;
            return this;
        }

        public Builder name(String name) {
            this.name = name;
            return this;
        }

        public Builder description(String description) {
            this.description = description;
            return this;
        }

        public Builder timeoutSeconds(int timeoutSeconds) {
            this.timeoutSeconds = timeoutSeconds;
            return this;
        }

        public Builder tasks(List<TaskDefinition> tasks) {
            this.tasks = tasks;
            return this;
        }

        public Builder addTask(TaskDefinition task) {
            if (this.tasks == null || this.tasks.isEmpty()) {
                this.tasks = new java.util.ArrayList<>();
            } else if (!(this.tasks instanceof java.util.ArrayList)) {
                this.tasks = new java.util.ArrayList<>(this.tasks);
            }
            this.tasks.add(task);
            return this;
        }

        public Builder layoutMetadata(Map<String, Object> layoutMetadata) {
            this.layoutMetadata = layoutMetadata;
            return this;
        }

        public WorkflowDefinition build() {
            return new WorkflowDefinition(workflowKey, version, name, description, timeoutSeconds, tasks, layoutMetadata);
        }
    }
}
