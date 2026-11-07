package com.acc.workflow.events;

/**
 * Domain event published when an execution task emits log telemetry.
 */
public record TaskLogBroadcastEvent(
    String executionId,
    String taskId,
    String taskReferenceName,
    String level,
    String message,
    Object raw,
    long timestamp
) {}
