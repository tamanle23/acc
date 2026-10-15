package com.unipost.workflow.core.model;

public enum WorkflowStatus {
    RUNNING,
    COMPLETED,
    FAILED,
    TERMINATED,
    PAUSED,
    COMPENSATED_FAILED;

    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == TERMINATED || this == COMPENSATED_FAILED;
    }
}
