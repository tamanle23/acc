package com.acc.workflow.adapters.transport;

import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.ports.PersistencePort;
import com.acc.workflow.ports.WorkerTransportPort;

import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * In-Process Transport Adapter for local-first execution.
 */
public final class InProcessTransportAdapter implements WorkerTransportPort {

    private final PersistencePort persistencePort;
    private final WorkflowEngineService engineService;
    private final WorkflowDefinition workflowDefinition;
    private final long responseTimeoutMs;

    public InProcessTransportAdapter(
        PersistencePort persistencePort,
        WorkflowEngineService engineService,
        WorkflowDefinition workflowDefinition,
        long responseTimeoutMs
    ) {
        this.persistencePort = Objects.requireNonNull(persistencePort, "persistencePort required");
        this.engineService = Objects.requireNonNull(engineService, "engineService required");
        this.workflowDefinition = Objects.requireNonNull(workflowDefinition, "workflowDefinition required");
        this.responseTimeoutMs = responseTimeoutMs > 0 ? responseTimeoutMs : 30000L;
    }

    @Override
    public List<TaskSnapshot> pollBatch(
        String tenantId, String taskType, String domain, int batchSize, String workerId
    ) {
        long now = System.currentTimeMillis();
        return persistencePort.pollTasks(tenantId, taskType, domain, batchSize, workerId, responseTimeoutMs, now);
    }

    @Override
    public void reportTaskResult(
        String taskId, String workerId, boolean completed, Map<String, Object> output,
        String errorMessage, long callbackAfterSeconds
    ) {
        long now = System.currentTimeMillis();
        String workflowId = persistencePort.getTaskExecution(taskId)
            .map(TaskSnapshot::workflowId)
            .orElseGet(() -> taskId.split("_")[0]);
        engineService.reportTaskResult(
            workflowId, taskId, workerId, completed, output, errorMessage,
            callbackAfterSeconds, workflowDefinition, now
        );
    }

    @Override
    public boolean heartbeat(String taskId, String workerId) {
        long newVisibleAt = System.currentTimeMillis() + responseTimeoutMs;
        return persistencePort.renewLease(taskId, workerId, newVisibleAt);
    }
}
