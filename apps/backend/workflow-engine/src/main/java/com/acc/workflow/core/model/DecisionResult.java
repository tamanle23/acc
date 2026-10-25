package com.acc.workflow.core.model;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public record DecisionResult(
    WorkflowStatus workflowStatus,
    List<EngineCommand> commands,
    Map<String, Object> outputPayload,
    String failureReason
) {
    public DecisionResult {
        if (workflowStatus == null) {
            workflowStatus = WorkflowStatus.RUNNING;
        }
        commands = commands != null ? Collections.unmodifiableList(commands) : Collections.emptyList();
        outputPayload = outputPayload != null ? Collections.unmodifiableMap(outputPayload) : Collections.emptyMap();
    }

    public static DecisionResult continueRunning(List<EngineCommand> commands) {
        return new DecisionResult(WorkflowStatus.RUNNING, commands, Collections.emptyMap(), null);
    }

    public static DecisionResult completed(List<EngineCommand> commands, Map<String, Object> output) {
        return new DecisionResult(WorkflowStatus.COMPLETED, commands, output, null);
    }

    public static DecisionResult failed(List<EngineCommand> commands, String reason) {
        return new DecisionResult(WorkflowStatus.FAILED, commands, Collections.emptyMap(), reason);
    }
}
