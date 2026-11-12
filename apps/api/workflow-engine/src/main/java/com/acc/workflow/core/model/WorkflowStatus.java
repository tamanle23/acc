package com.acc.workflow.core.model;

public enum WorkflowStatus {
    RUNNING,
    COMPLETED,
    FAILED,
    TERMINATED,
    PAUSED,
    PAUSED_AT_BREAKPOINT,
    COMPENSATED_FAILED,
    TAMPERED;

    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == TERMINATED || this == COMPENSATED_FAILED || this == TAMPERED;
    }

    public WorkflowExecutionStatus toExecutionStatus() {
        return WorkflowExecutionStatus.valueOf(this.name());
    }

    public static WorkflowStatus fromExecutionStatus(WorkflowExecutionStatus executionStatus) {
        return executionStatus != null ? WorkflowStatus.valueOf(executionStatus.name()) : null;
    }
}
