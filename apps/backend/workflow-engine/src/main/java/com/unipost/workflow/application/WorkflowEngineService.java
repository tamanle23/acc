package com.unipost.workflow.application;

import com.unipost.workflow.core.decider.PureDecider;
import com.unipost.workflow.core.model.DecisionResult;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskDlqRecord;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import com.unipost.workflow.ports.PersistencePort;
import com.unipost.workflow.ports.UnitOfWork;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Imperative Shell coordinating transaction boundaries, PersistencePort, and PureDecider.
 */
public class WorkflowEngineService {

    private final PersistencePort persistencePort;
    private final PureDecider decider;

    public WorkflowEngineService(PersistencePort persistencePort, PureDecider decider) {
        this.persistencePort = Objects.requireNonNull(persistencePort, "persistencePort required");
        this.decider = Objects.requireNonNull(decider, "decider required");
    }

    public WorkflowSnapshot startWorkflow(
        String workflowId,
        String tenantId,
        String workspaceId,
        WorkflowDefinition definition,
        Map<String, Object> input,
        long nowEpochMs
    ) {
        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            // 1. Freeze definition snapshot in Memento pattern
            persistencePort.saveWorkflowExecution(
                workflowId, tenantId, workspaceId, definition.workflowKey(), definition.version(),
                WorkflowStatus.RUNNING, definition, input, Collections.emptyMap(), null, nowEpochMs
            );

            // 2. Initialize snapshot
            WorkflowSnapshot snapshot = new WorkflowSnapshot(
                workflowId, tenantId, workspaceId, definition.workflowKey(), definition.version(),
                WorkflowStatus.RUNNING, input, Collections.emptyMap(), null, Collections.emptyMap()
            );

            // 3. Evaluate initial decider step
            DecisionResult decision = decider.decide(definition, snapshot, nowEpochMs);
            applyCommands(workflowId, tenantId, workspaceId, decision.commands(), nowEpochMs);

            uow.commit();
            return persistencePort.getWorkflowSnapshot(workflowId).orElseThrow();
        }
    }

    public void reportTaskResult(
        String workflowId,
        String taskId,
        String workerId,
        boolean completed,
        Map<String, Object> output,
        String error,
        long callbackAfterSeconds,
        WorkflowDefinition definition,
        long nowEpochMs
    ) {
        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            TaskSnapshot existing = persistencePort.getTaskExecution(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

            if (callbackAfterSeconds > 0) {
                // Async deferral
                long nextVisibleAt = nowEpochMs + (callbackAfterSeconds * 1000L);
                persistencePort.updateTaskExecution(taskId, TaskStatus.IN_PROGRESS, output, error, nowEpochMs);
                persistencePort.enqueueTask(
                    taskId, workflowId, existing.domain(), "default", existing.taskType().name(),
                    existing.domain(), 0, nextVisibleAt
                );
            } else {
                // Task is completed or failed
                TaskStatus nextStatus = completed ? TaskStatus.COMPLETED : TaskStatus.FAILED;
                persistencePort.updateTaskExecution(taskId, nextStatus, output, error, nowEpochMs);
                persistencePort.removeQueueTask(taskId);

                // Run decider for next iteration
                WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(workflowId).orElseThrow();
                DecisionResult decision = decider.decide(definition, snapshot, nowEpochMs);
                applyCommands(workflowId, snapshot.tenantId(), snapshot.workspaceId(), decision.commands(), nowEpochMs);

                // If the workflow failed as a result of this task failure, trigger distributed Saga reverse compensation & quarantine to DLQ
                if (decision.workflowStatus() == WorkflowStatus.FAILED) {
                    WorkflowSnapshot failedSnapshot = persistencePort.getWorkflowSnapshot(workflowId).orElse(snapshot);

                    // Quarantine poisoned task to DLQ
                    TaskDlqRecord dlqRecord = new TaskDlqRecord(
                        UUID.randomUUID().toString(),
                        taskId,
                        workflowId,
                        failedSnapshot.tenantId(),
                        failedSnapshot.workspaceId(),
                        existing.taskType().name(),
                        existing.domain(),
                        error != null ? error : "Task exhausted retries: " + decision.failureReason(),
                        null,
                        output != null ? output : Collections.emptyMap(),
                        existing.attempt(),
                        nowEpochMs,
                        null,
                        "ISOLATED"
                    );
                    persistencePort.quarantineTaskToDlq(dlqRecord);

                    SagaCompensator compensator = new SagaCompensator();
                    List<EngineCommand.ScheduleTask> compCommands = compensator.planCompensation(definition, failedSnapshot, nowEpochMs);
                    if (!compCommands.isEmpty()) {
                        for (EngineCommand.ScheduleTask compCmd : compCommands) {
                            persistencePort.saveTaskExecution(
                                compCmd.taskId(), workflowId, snapshot.tenantId(), snapshot.workspaceId(),
                                compCmd.referenceName(), compCmd.taskType(), compCmd.domain(),
                                TaskStatus.SCHEDULED, compCmd.attempt(), compCmd.input(),
                                Collections.emptyMap(), null, compCmd.responseTimeoutMs(), nowEpochMs
                            );
                            persistencePort.enqueueTask(
                                compCmd.taskId(), workflowId, snapshot.tenantId(), snapshot.workspaceId(),
                                compCmd.taskType(), compCmd.domain(), 0, compCmd.visibleAtEpochMs()
                            );
                        }
                        persistencePort.updateWorkflowStatus(
                            workflowId, WorkflowStatus.COMPENSATED_FAILED, failedSnapshot.outputPayload(),
                            "Compensating workflow after failure: " + decision.failureReason(), nowEpochMs
                        );
                    }
                }
            }

            uow.commit();
        }
    }

    public int sweepExpiredTasks(WorkflowDefinition definition, long nowEpochMs) {
        List<TaskSnapshot> expiredTasks = persistencePort.findExpiredLeaseTasks(nowEpochMs);
        int sweepCount = 0;

        for (TaskSnapshot expired : expiredTasks) {
            try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
                String workflowId = extractWorkflowId(expired.taskId(), expired.taskReferenceName());

                // Mark expired task attempt as TIMED_OUT and remove from queue
                persistencePort.updateTaskExecution(
                    expired.taskId(), TaskStatus.TIMED_OUT, expired.outputData(), "Lease expired (zombie worker)", nowEpochMs
                );
                persistencePort.removeQueueTask(expired.taskId());

                WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(workflowId).orElse(null);

                int maxRetries = 3;
                if (definition != null && definition.tasks() != null) {
                    for (TaskDefinition td : definition.tasks()) {
                        if (td.taskReferenceName().equalsIgnoreCase(expired.taskReferenceName())) {
                            maxRetries = td.retryCount();
                            break;
                        }
                    }
                }

                if (expired.attempt() >= maxRetries) {
                    // Poison/Zombie task exceeded retries: isolate into DLQ
                    TaskDlqRecord dlqRecord = new TaskDlqRecord(
                        UUID.randomUUID().toString(),
                        expired.taskId(),
                        workflowId,
                        snapshot != null ? snapshot.tenantId() : "system",
                        snapshot != null ? snapshot.workspaceId() : "default",
                        expired.taskType().name(),
                        expired.domain(),
                        "EXPIRED_LEASE_ZOMBIE_WORKER: lease expired after " + expired.attempt() + " attempts",
                        null,
                        expired.outputData(),
                        expired.attempt(),
                        nowEpochMs,
                        null,
                        "ISOLATED"
                    );
                    persistencePort.quarantineTaskToDlq(dlqRecord);
                }

                if (snapshot != null) {
                    DecisionResult decision = decider.decide(definition, snapshot, nowEpochMs);
                    applyCommands(snapshot.workflowId(), snapshot.tenantId(), snapshot.workspaceId(), decision.commands(), nowEpochMs);
                }

                uow.commit();
                sweepCount++;
            }
        }
        return sweepCount;
    }

    public Optional<TaskDlqRecord> replayDlqTask(String dlqId, Map<String, Object> payloadOverrides, long nowEpochMs) {
        Optional<TaskDlqRecord> dlqOpt = persistencePort.getDlqTask(dlqId);
        if (dlqOpt.isEmpty()) {
            return Optional.empty();
        }
        TaskDlqRecord dlq = dlqOpt.get();

        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            // Update DLQ record status to REPLAYED
            persistencePort.updateDlqStatus(dlqId, "REPLAYED", nowEpochMs);

            // Fetch existing task execution and merge payload overrides
            Optional<TaskSnapshot> taskSnapOpt = persistencePort.getTaskExecution(dlq.taskId());
            Map<String, Object> inputPayload = taskSnapOpt.map(TaskSnapshot::inputData).orElse(Collections.emptyMap());
            if (payloadOverrides != null && !payloadOverrides.isEmpty()) {
                inputPayload = new HashMap<>(inputPayload);
                inputPayload.putAll(payloadOverrides);
            }

            // Reset attempt to 1 and status to SCHEDULED
            persistencePort.saveTaskExecution(
                dlq.taskId(), dlq.workflowId(), dlq.tenantId(), dlq.workspaceId(),
                taskSnapOpt.map(TaskSnapshot::taskReferenceName).orElse("task"),
                dlq.taskType(), dlq.domain(), TaskStatus.SCHEDULED, 1,
                inputPayload, Collections.emptyMap(), null, 30000L, nowEpochMs
            );

            // Re-enqueue into queue with high priority (100) for instant recovery
            persistencePort.enqueueTask(
                dlq.taskId(), dlq.workflowId(), dlq.tenantId(), dlq.workspaceId(),
                dlq.taskType(), dlq.domain(), 100, nowEpochMs
            );

            // If parent workflow execution was FAILED or COMPENSATED_FAILED, resume it to RUNNING
            Optional<WorkflowSnapshot> wfOpt = persistencePort.getWorkflowSnapshot(dlq.workflowId());
            if (wfOpt.isPresent()) {
                WorkflowSnapshot wf = wfOpt.get();
                if (wf.status() == WorkflowStatus.FAILED || wf.status() == WorkflowStatus.COMPENSATED_FAILED) {
                    persistencePort.updateWorkflowStatus(
                        wf.workflowId(), WorkflowStatus.RUNNING, wf.outputPayload(), null, nowEpochMs
                    );
                }
            }

            uow.commit();
        }

        return persistencePort.getDlqTask(dlqId);
    }

    public boolean discardDlqTask(String dlqId) {
        Optional<TaskDlqRecord> dlqOpt = persistencePort.getDlqTask(dlqId);
        if (dlqOpt.isEmpty()) {
            return false;
        }
        persistencePort.updateDlqStatus(dlqId, "DISCARDED", System.currentTimeMillis());
        return true;
    }

    private String extractWorkflowId(String taskId, String taskReferenceName) {
        if (taskId != null && taskReferenceName != null) {
            int idx = taskId.lastIndexOf("_" + taskReferenceName);
            if (idx > 0) {
                return taskId.substring(0, idx);
            }
        }
        return taskId != null ? taskId.split("_")[0] : "unknown";
    }

    private void applyCommands(
        String workflowId, String tenantId, String workspaceId,
        List<EngineCommand> commands, long nowEpochMs
    ) {
        for (EngineCommand cmd : commands) {
            if (cmd instanceof EngineCommand.ScheduleTask st) {
                persistencePort.saveTaskExecution(
                    st.taskId(), workflowId, tenantId, workspaceId, st.referenceName(),
                    st.taskType(), st.domain(), TaskStatus.SCHEDULED, st.attempt(),
                    st.input(), Collections.emptyMap(), null, st.responseTimeoutMs(), nowEpochMs
                );
                persistencePort.enqueueTask(
                    st.taskId(), workflowId, tenantId, workspaceId, st.taskType(),
                    st.domain(), 0, st.visibleAtEpochMs()
                );
            } else if (cmd instanceof EngineCommand.UpdateTaskStatus ut) {
                persistencePort.updateTaskExecution(ut.taskId(), ut.status(), ut.output(), ut.error(), nowEpochMs);
                if (ut.status().isTerminal()) {
                    persistencePort.removeQueueTask(ut.taskId());
                }
            } else if (cmd instanceof EngineCommand.TransitionWorkflow tw) {
                persistencePort.updateWorkflowStatus(workflowId, tw.status(), tw.output(), tw.reason(), nowEpochMs);
            }
        }
    }
}
