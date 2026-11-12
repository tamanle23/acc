package com.acc.workflow.events;

import java.util.Map;

/**
 * Domain event published when a workflow execution status changes.
 */
public record WorkflowExecutionBroadcastEvent(
    String workflowId,
    String eventType,
    Map<String, Object> payload
) {}
