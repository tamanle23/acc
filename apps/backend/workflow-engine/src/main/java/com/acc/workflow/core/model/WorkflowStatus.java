package com.acc.workflow.core.model;

public enum WorkflowStatus {
    RUNNING,
    COMPLETED,
    FAILED,
    TERMINATED,
    PAUSED,
    PAUSED_AT_BREAKPOINT,
    COMPENSATED_FAILED;

    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == TERMINATED || this == COMPENSATED_FAILED;
    }
}
