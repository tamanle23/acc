package com.unipost.workflow.core.model;

public enum TaskStatus {
    SCHEDULED,
    IN_PROGRESS,
    WAITING_FOR_APPROVAL,
    COMPLETED,
    FAILED,
    TIMED_OUT,
    SKIPPED;

    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == TIMED_OUT || this == SKIPPED;
    }

    public boolean isSuccessful() {
        return this == COMPLETED;
    }
}
