package com.unipost.workflow.worker;

public record WorkerConfig(
    String taskType,
    String tenantId,
    String domain,
    int maxConcurrency,
    long basePollIntervalMs,
    long maxPollIntervalMs,
    int pollBatchSize,
    long autoHeartbeatIntervalMs
) {
    public WorkerConfig(
        String taskType,
        String domain,
        int maxConcurrency,
        long basePollIntervalMs,
        long maxPollIntervalMs,
        int pollBatchSize,
        long autoHeartbeatIntervalMs
    ) {
        this(taskType, "system", domain, maxConcurrency, basePollIntervalMs, maxPollIntervalMs, pollBatchSize, autoHeartbeatIntervalMs);
    }

    public static WorkerConfig defaults(String taskType) {
        return new WorkerConfig(taskType, "system", "default", 10, 50L, 2000L, 5, 10000L);
    }
}
