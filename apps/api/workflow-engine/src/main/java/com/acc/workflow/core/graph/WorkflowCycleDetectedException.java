package com.acc.workflow.core.graph;

import java.util.List;

public class WorkflowCycleDetectedException extends RuntimeException {

    private final List<String> cyclePath;

    public WorkflowCycleDetectedException(List<String> cyclePath) {
        super("Cycle detected in workflow graph: " + String.join(" -> ", cyclePath));
        this.cyclePath = cyclePath;
    }

    public List<String> getCyclePath() {
        return cyclePath;
    }
}
