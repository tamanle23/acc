package com.unipost.workflow.core.model;

public enum WorkflowStatus {
    RUNNING,
    COMPLETED,
    FAILED,
    TERMINATED,
    PAUSED;

    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == TERMINATED;
    }
}
