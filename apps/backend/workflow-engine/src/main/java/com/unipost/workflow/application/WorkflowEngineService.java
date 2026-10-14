package com.unipost.workflow.application;

import com.unipost.workflow.core.decider.PureDecider;
import com.unipost.workflow.core.model.DecisionResult;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import com.unipost.workflow.ports.PersistencePort;
import com.unipost.workflow.ports.UnitOfWork;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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
                workflowId, tenantId, workspaceId, definition.name(), definition.version(),
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
            }

            uow.commit();
        }
    }

    public int sweepExpiredTasks(WorkflowDefinition definition, long nowEpochMs) {
        List<TaskSnapshot> expiredTasks = persistencePort.findExpiredLeaseTasks(nowEpochMs);
        int sweepCount = 0;

        for (TaskSnapshot expired : expiredTasks) {
            try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
                // Mark task as TIMED_OUT
                persistencePort.updateTaskExecution(
                    expired.taskId(), TaskStatus.TIMED_OUT, expired.outputData(), "Lease expired", nowEpochMs
                );
                persistencePort.removeQueueTask(expired.taskId());

                // Run decider so retry policies or terminal failure trigger automatically
                WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(expired.taskId().split("_")[0])
                    .orElse(null);

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
