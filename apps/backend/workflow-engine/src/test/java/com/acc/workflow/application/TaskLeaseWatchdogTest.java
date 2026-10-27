package com.acc.workflow.application;

import com.acc.workflow.core.model.TaskDlqRecord;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.ports.PersistencePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TaskLeaseWatchdogTest {

    private PersistencePort persistencePort;
    private TaskLeaseWatchdog watchdog;

    @BeforeEach
    void setUp() {
        persistencePort = mock(PersistencePort.class);
        watchdog = new TaskLeaseWatchdog(persistencePort, 3);
    }

    @Test
    @DisplayName("Should re-enqueue task when attempt count is below maxAttempts")
    void shouldReenqueueTaskBelowMaxAttempts() {
        long now = 1000000L;
        TaskSnapshot task = new TaskSnapshot(
            "task_1",
            "ref_1",
            TaskType.SIMPLE,
            "default",
            TaskStatus.IN_PROGRESS,
            1, // attempt 1 < 3
            Map.of("key", "val"),
            Collections.emptyMap(),
            null,
            now - 5000L,
            30000L,
            "worker_a"
        );

        when(persistencePort.findExpiredLeaseTasks(now)).thenReturn(List.of(task));

        List<TaskSnapshot> reaped = watchdog.reapExpiredLeases(now);

        assertThat(reaped).hasSize(1);
        verify(persistencePort).saveTaskExecution(
            eq("task_1"), any(), any(), any(), any(), any(), any(),
            eq(TaskStatus.SCHEDULED), eq(2), any(), any(), any(), anyLong(), eq(now)
        );
        verify(persistencePort).enqueueTask(
            eq("task_1"), any(), any(), any(), any(), any(), eq(0), eq(now)
        );
        verify(persistencePort, never()).quarantineTaskToDlq(any());
    }

    @Test
    @DisplayName("Should quarantine task to DLQ and mark TIMED_OUT when attempt reaches maxAttempts")
    void shouldQuarantineTaskToDlqWhenMaxAttemptsReached() {
        long now = 2000000L;
        TaskSnapshot task = new TaskSnapshot(
            "task_zombie",
            "ref_zombie",
            TaskType.HTTP,
            "system:http",
            TaskStatus.IN_PROGRESS,
            3, // attempt 3 >= maxAttempts 3
            Map.of("url", "https://api.example.com"),
            Collections.emptyMap(),
            null,
            now - 10000L,
            30000L,
            "crashed_worker"
        );

        when(persistencePort.findExpiredLeaseTasks(now)).thenReturn(List.of(task));

        List<TaskSnapshot> reaped = watchdog.reapExpiredLeases(now);

        assertThat(reaped).hasSize(1);

        ArgumentCaptor<TaskDlqRecord> dlqCaptor = ArgumentCaptor.forClass(TaskDlqRecord.class);
        verify(persistencePort).quarantineTaskToDlq(dlqCaptor.capture());

        TaskDlqRecord capturedDlq = dlqCaptor.getValue();
        assertThat(capturedDlq.taskId()).isEqualTo("task_zombie");
        assertThat(capturedDlq.errorMessage()).contains("TASK_LEASE_EXPIRED");
        assertThat(capturedDlq.retryCount()).isEqualTo(3);

        verify(persistencePort).updateTaskExecution(
            eq("task_zombie"), eq(TaskStatus.TIMED_OUT), any(), contains("TASK_LEASE_EXPIRED"), eq(now)
        );
        verify(persistencePort, never()).enqueueTask(any(), any(), any(), any(), any(), any(), anyInt(), anyLong());
    }
}
