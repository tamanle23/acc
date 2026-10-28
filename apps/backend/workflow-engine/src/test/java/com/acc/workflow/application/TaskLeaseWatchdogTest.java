package com.acc.workflow.application;

import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.core.model.TaskDlqRecord;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.TaskType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TaskLeaseWatchdogTest {

    private InMemoryPersistenceAdapter persistencePort;
    private TaskLeaseWatchdog watchdog;

    @BeforeEach
    void setUp() {
        persistencePort = new InMemoryPersistenceAdapter();
        watchdog = new TaskLeaseWatchdog(persistencePort, 3);
    }

    @Test
    @DisplayName("Should re-enqueue task when attempt count is below maxAttempts")
    void shouldReenqueueTaskBelowMaxAttempts() {
        long now = 1000000L;
        String taskId = "wf_1_ref_1";

        persistencePort.saveTaskExecution(
            taskId, "wf_1", "system", "default", "ref_1",
            TaskType.SIMPLE.name(), "default", TaskStatus.SCHEDULED, 1,
            Map.of("key", "val"), Collections.emptyMap(), null,
            1000L, now - 10000L
        );
        persistencePort.enqueueTask(
            taskId, "wf_1", "system", "default",
            TaskType.SIMPLE.name(), "default", 0, now - 10000L
        );

        // Worker polls task, acquiring lease expiring at (now - 5000L)
        List<TaskSnapshot> polled = persistencePort.pollTasks("system", TaskType.SIMPLE.name(), "default", 1, "worker-1", 1000L, now - 6000L);
        assertThat(polled).hasSize(1);

        List<TaskSnapshot> reaped = watchdog.reapExpiredLeases(now);

        assertThat(reaped).hasSize(1);
        TaskSnapshot updatedTask = persistencePort.getTaskExecution(taskId).orElseThrow();
        assertThat(updatedTask.status()).isEqualTo(TaskStatus.SCHEDULED);
        assertThat(updatedTask.attempt()).isEqualTo(2);

        List<TaskDlqRecord> dlq = persistencePort.listDlqTasks("system", null, 10);
        assertThat(dlq).isEmpty();
    }

    @Test
    @DisplayName("Should quarantine task to DLQ and mark TIMED_OUT when attempt reaches maxAttempts")
    void shouldQuarantineTaskToDlqWhenMaxAttemptsReached() {
        long now = 2000000L;
        String taskId = "wf_zombie_ref_zombie";

        persistencePort.saveTaskExecution(
            taskId, "wf_zombie", "system", "default", "ref_zombie",
            TaskType.HTTP.name(), "system:http", TaskStatus.SCHEDULED, 3,
            Map.of("url", "https://api.example.com"), Collections.emptyMap(), null,
            1000L, now - 10000L
        );
        persistencePort.enqueueTask(
            taskId, "wf_zombie", "system", "default",
            TaskType.HTTP.name(), "system:http", 0, now - 10000L
        );

        // Worker polls task on attempt 3, acquiring lease expiring at (now - 5000L)
        List<TaskSnapshot> polled = persistencePort.pollTasks("system", TaskType.HTTP.name(), "system:http", 1, "crashed-worker", 1000L, now - 6000L);
        assertThat(polled).hasSize(1);

        List<TaskSnapshot> reaped = watchdog.reapExpiredLeases(now);

        assertThat(reaped).hasSize(1);

        TaskSnapshot updatedTask = persistencePort.getTaskExecution(taskId).orElseThrow();
        assertThat(updatedTask.status()).isEqualTo(TaskStatus.TIMED_OUT);
        assertThat(updatedTask.errorMessage()).contains("TASK_LEASE_EXPIRED");

        List<TaskDlqRecord> dlqList = persistencePort.listDlqTasks("system", null, 10);
        assertThat(dlqList).hasSize(1);

        TaskDlqRecord capturedDlq = dlqList.get(0);
        assertThat(capturedDlq.taskId()).isEqualTo(taskId);
        assertThat(capturedDlq.errorMessage()).contains("TASK_LEASE_EXPIRED");
        assertThat(capturedDlq.retryCount()).isEqualTo(3);
    }
}
