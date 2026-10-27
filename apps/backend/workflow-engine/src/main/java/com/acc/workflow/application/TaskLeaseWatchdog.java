package com.acc.workflow.application;

import com.acc.workflow.core.model.TaskDlqRecord;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.ports.PersistencePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * TaskLeaseWatchdog:
 * Autonomous resilience monitor for the distributed task execution queue.
 * Detects expired worker leases where visibleAtEpochMs <= now and status == IN_PROGRESS.
 *
 * Implements exponential retry thresholding:
 * - If attempt < maxAttempts: resets lease_owner to null and updates visible_at_epoch_ms to allow immediate re-polling.
 * - If attempt >= maxAttempts: quarantines the task to task_dlq and marks the task execution as TIMED_OUT.
 */
public class TaskLeaseWatchdog {

    private static final Logger log = LoggerFactory.getLogger(TaskLeaseWatchdog.class);

    private final PersistencePort persistencePort;
    private final int maxAttempts;

    public TaskLeaseWatchdog(PersistencePort persistencePort) {
        this(persistencePort, 3);
    }

    public TaskLeaseWatchdog(PersistencePort persistencePort, int maxAttempts) {
        this.persistencePort = Objects.requireNonNull(persistencePort, "persistencePort must not be null");
        this.maxAttempts = Math.max(1, maxAttempts);
    }

    /**
     * Reaps all expired task leases across tenant queues at the given epoch millisecond.
     *
     * @param nowEpochMs Current epoch timestamp in milliseconds.
     * @return List of reaped TaskSnapshot instances that were either retried or isolated to DLQ.
     */
    public List<TaskSnapshot> reapExpiredLeases(long nowEpochMs) {
        List<TaskSnapshot> expiredTasks = persistencePort.findExpiredLeaseTasks(nowEpochMs);
        if (expiredTasks == null || expiredTasks.isEmpty()) {
            return Collections.emptyList();
        }

        log.info("TaskLeaseWatchdog found {} expired task lease(s) at epoch {}", expiredTasks.size(), nowEpochMs);

        for (TaskSnapshot task : expiredTasks) {
            String taskId = task.taskId();
            int currentAttempt = task.attempt();

            if (currentAttempt >= maxAttempts) {
                log.warn("Task {} exceeded max lease attempts ({}/{}); quarantining to DLQ",
                    taskId, currentAttempt, maxAttempts);

                String dlqId = "dlq_" + UUID.randomUUID().toString().replace("-", "");
                String errorMessage = "TASK_LEASE_EXPIRED: Worker heartbeat lost after " + currentAttempt + " attempts";

                TaskDlqRecord dlqRecord = new TaskDlqRecord(
                    dlqId,
                    task.taskId(),
                    task.workflowId(),
                    task.tenantId(),
                    task.workspaceId(),
                    task.taskType(),
                    task.domain(),
                    errorMessage,
                    null,
                    task.inputData(),
                    currentAttempt,
                    nowEpochMs,
                    null,
                    "ISOLATED"
                );

                persistencePort.quarantineTaskToDlq(dlqRecord);
                persistencePort.updateTaskExecution(taskId, TaskStatus.TIMED_OUT, task.outputData(), errorMessage, nowEpochMs);
            } else {
                int nextAttempt = currentAttempt + 1;
                log.info("Task {} lease expired on attempt {}/{}; re-enqueuing for retry",
                    taskId, currentAttempt, maxAttempts);

                persistencePort.saveTaskExecution(
                    task.taskId(),
                    task.workflowId(),
                    task.tenantId(),
                    task.workspaceId(),
                    task.referenceName(),
                    task.taskType(),
                    task.domain(),
                    TaskStatus.SCHEDULED,
                    nextAttempt,
                    task.inputData(),
                    task.outputData(),
                    "Lease expired on attempt " + currentAttempt + "; re-scheduled",
                    task.responseTimeoutMs(),
                    nowEpochMs
                );

                persistencePort.enqueueTask(
                    task.taskId(),
                    task.workflowId(),
                    task.tenantId(),
                    task.workspaceId(),
                    task.taskType(),
                    task.domain(),
                    0,
                    nowEpochMs
                );
            }
        }

        return expiredTasks;
    }

    public int getMaxAttempts() {
        return maxAttempts;
    }
}
