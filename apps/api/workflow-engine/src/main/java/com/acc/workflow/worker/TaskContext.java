package com.acc.workflow.worker;

import java.util.List;
import java.util.Map;

public interface TaskContext {
    String taskId();
    String workflowId();
    String tenantId();
    String workspaceId();
    String taskType();
    String referenceName();
    String domain();
    int attempt();
    Map<String, Object> input();
    <T> T bindInput(Class<T> type);
    void log(String message);
    List<String> logs();
    void heartbeat();
}
