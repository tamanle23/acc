package com.unipost.workflow.ports;

import com.unipost.workflow.core.model.TaskSnapshot;

import java.util.List;
import java.util.Map;

/**
 * Worker transport contract for polling, reporting results, and renewing leases.
 */
public interface WorkerTransportPort {

    List<TaskSnapshot> pollBatch(
        String tenantId,
        String taskType,
        String domain,
        int batchSize,
        String workerId
    );

    void reportTaskResult(
        String taskId,
        String workerId,
        boolean completed,
        Map<String, Object> output,
        String errorMessage,
        long callbackAfterSeconds
    );

    boolean heartbeat(String taskId, String workerId);
}
