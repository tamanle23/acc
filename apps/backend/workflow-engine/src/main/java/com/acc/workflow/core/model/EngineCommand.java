package com.acc.workflow.core.model;

import java.util.Map;

public sealed interface EngineCommand permits
    EngineCommand.ScheduleTask,
    EngineCommand.UpdateTaskStatus,
    EngineCommand.DeferTaskCallback,
    EngineCommand.TransitionWorkflow {

    record ScheduleTask(
        String taskId,
        String taskType,
        String referenceName,
        String domain,
        Map<String, Object> input,
        int attempt,
        long visibleAtEpochMs,
        long responseTimeoutMs
    ) implements EngineCommand {}

    record UpdateTaskStatus(
        String taskId,
        String referenceName,
        TaskStatus status,
        Map<String, Object> output,
        String error
    ) implements EngineCommand {}

    record DeferTaskCallback(
        String taskId,
        String referenceName,
        long visibleAtEpochMs,
        Map<String, Object> output
    ) implements EngineCommand {}

    record TransitionWorkflow(
        WorkflowStatus status,
        Map<String, Object> output,
        String reason
    ) implements EngineCommand {}
}
