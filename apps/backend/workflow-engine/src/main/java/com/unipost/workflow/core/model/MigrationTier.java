package com.unipost.workflow.core.model;

/**
 * Heuristic tier for classifying in-flight execution hot migration feasibility.
 */
public enum MigrationTier {
    /**
     * Completely safe to migrate automatically without human intervention.
     * All completed and running nodes match target topology; new nodes exist strictly downstream.
     */
    FULLY_COMPATIBLE,

    /**
     * Migration introduces non-breaking topology shifts, variable default shifts,
     * or active node attribute modifications requiring explicit operator review.
     */
    CONDITIONAL_REQUIRES_MANUAL_REVIEW,

    /**
     * Migration cannot proceed (terminal status, removed completed nodes, or breaking cycle).
     */
    INCOMPATIBLE_BLOCK
}
