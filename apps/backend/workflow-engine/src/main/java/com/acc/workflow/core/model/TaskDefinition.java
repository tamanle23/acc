package com.acc.workflow.core.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TaskDefinition(
    String taskReferenceName,
    TaskType taskType,
    String domain,
    int timeoutSeconds,
    int retryCount,
    int retryDelaySeconds,
    double backoffRate,
    Map<String, Object> inputParameters,
    String compensateHandlerRef,
    Map<String, List<TaskDefinition>> decisionCases,
    List<TaskDefinition> defaultCase,
    List<List<TaskDefinition>> forkTasks,
    List<String> joinOn,
    String loopCondition,
    List<TaskDefinition> loopOver
) {
    public TaskDefinition {
        if (taskReferenceName == null || taskReferenceName.isBlank()) {
            throw new IllegalArgumentException("taskReferenceName is required");
        }
        if (taskType == null) {
            taskType = TaskType.SIMPLE;
        }
        if (domain == null || domain.isBlank()) {
            domain = "default";
        }
        if (timeoutSeconds <= 0) {
            timeoutSeconds = 30;
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
        inputParameters = inputParameters != null ? Collections.unmodifiableMap(inputParameters) : Collections.emptyMap();
        decisionCases = decisionCases != null ? Collections.unmodifiableMap(decisionCases) : Collections.emptyMap();
        defaultCase = defaultCase != null ? Collections.unmodifiableList(defaultCase) : Collections.emptyList();
        forkTasks = forkTasks != null ? Collections.unmodifiableList(forkTasks) : Collections.emptyList();
        joinOn = joinOn != null ? Collections.unmodifiableList(joinOn) : Collections.emptyList();
        loopOver = loopOver != null ? Collections.unmodifiableList(loopOver) : Collections.emptyList();
    }

    public static Builder builder(String taskReferenceName) {
        return new Builder(taskReferenceName);
    }

    public static class Builder {
        private final String taskReferenceName;
        private TaskType taskType = TaskType.SIMPLE;
        private String domain = "default";
        private int timeoutSeconds = 30;
        private int retryCount = 3;
        private int retryDelaySeconds = 2;
        private double backoffRate = 2.0;
        private Map<String, Object> inputParameters = Collections.emptyMap();
        private String compensateHandlerRef;
        private Map<String, List<TaskDefinition>> decisionCases = Collections.emptyMap();
        private List<TaskDefinition> defaultCase = Collections.emptyList();
        private List<List<TaskDefinition>> forkTasks = Collections.emptyList();
        private List<String> joinOn = Collections.emptyList();
        private String loopCondition;
        private List<TaskDefinition> loopOver = Collections.emptyList();

        public Builder(String taskReferenceName) {
            this.taskReferenceName = taskReferenceName;
        }

        public Builder taskType(TaskType taskType) {
            this.taskType = taskType;
            return this;
        }

        public Builder domain(String domain) {
            this.domain = domain;
            return this;
        }

        public Builder timeoutSeconds(int timeoutSeconds) {
            this.timeoutSeconds = timeoutSeconds;
            return this;
        }

        public Builder retryCount(int retryCount) {
            this.retryCount = retryCount;
            return this;
        }

        public Builder retryDelaySeconds(int retryDelaySeconds) {
            this.retryDelaySeconds = retryDelaySeconds;
            return this;
        }

        public Builder backoffRate(double backoffRate) {
            this.backoffRate = backoffRate;
            return this;
        }

        public Builder inputParameters(Map<String, Object> inputParameters) {
            this.inputParameters = inputParameters;
            return this;
        }

        public Builder compensateHandlerRef(String compensateHandlerRef) {
            this.compensateHandlerRef = compensateHandlerRef;
            return this;
        }

        public Builder decisionCases(Map<String, List<TaskDefinition>> decisionCases) {
            this.decisionCases = decisionCases;
            return this;
        }

        public Builder defaultCase(List<TaskDefinition> defaultCase) {
            this.defaultCase = defaultCase;
            return this;
        }

        public Builder forkTasks(List<List<TaskDefinition>> forkTasks) {
            this.forkTasks = forkTasks;
            return this;
        }

        public Builder joinOn(List<String> joinOn) {
            this.joinOn = joinOn;
            return this;
        }

        public Builder loopCondition(String loopCondition) {
            this.loopCondition = loopCondition;
            return this;
        }

        public Builder loopOver(List<TaskDefinition> loopOver) {
            this.loopOver = loopOver;
            return this;
        }

        public TaskDefinition build() {
            return new TaskDefinition(
                taskReferenceName, taskType, domain, timeoutSeconds, retryCount,
                retryDelaySeconds, backoffRate, inputParameters, compensateHandlerRef,
                decisionCases, defaultCase, forkTasks, joinOn, loopCondition, loopOver
            );
        }
    }
}
