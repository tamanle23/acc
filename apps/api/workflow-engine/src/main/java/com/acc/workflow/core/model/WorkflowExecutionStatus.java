package com.acc.workflow.core.model;

/**
 * Execution instance lifecycle status for a running or terminated workflow instance.
 * Distinct from {@link WorkflowVersionStatus} which defines blueprint definition states.
 */
public enum WorkflowExecutionStatus {
    RUNNING,
    COMPLETED,
    FAILED,
    TERMINATED,
    PAUSED,
    PAUSED_AT_BREAKPOINT,
    COMPENSATED_FAILED,
    TAMPERED; // Strict cryptographic failure quarantine status

    public boolean isTerminal() {
        return this == COMPLETED || this == FAILED || this == TERMINATED 
            || this == COMPENSATED_FAILED || this == TAMPERED;
    }
}
