package com.acc.workflow.application;

import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.core.decider.PureDecider;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import com.acc.workflow.ports.PersistencePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class WorkflowEngineServiceTest {

    private PersistencePort persistencePort;
    private PureDecider decider;
    private WorkflowEngineService service;

    @BeforeEach
    void setUp() {
        persistencePort = new InMemoryPersistenceAdapter();
        decider = new PureDecider();
        service = new WorkflowEngineService(persistencePort, decider);
    }

    @Test
    @DisplayName("Should execute multi-step workflow via startWorkflow and reportTaskResult")
    void shouldExecuteWorkflowEndToEnd() {
        WorkflowDefinition def = WorkflowDefinition.builder("checkout")
            .tasks(List.of(
                TaskDefinition.builder("step-one").build(),
                TaskDefinition.builder("step-two").build()
            ))
            .build();

        long now = 1000L;
        // 1. Start workflow
        WorkflowSnapshot snap = service.startWorkflow("wf-1", "t1", "ws1", def, Map.of("cartId", "C-1"), now);
        assertThat(snap.status()).isEqualTo(WorkflowStatus.RUNNING);

        // 2. Poll task for step-one
        List<TaskSnapshot> polled = persistencePort.pollTasks("t1", "SIMPLE", "default", 1, "worker-1", 30000L, now);
        assertThat(polled).hasSize(1);
        TaskSnapshot task1 = polled.get(0);
        assertThat(task1.taskReferenceName()).isEqualTo("step-one");

        // 3. Complete step-one
        service.reportTaskResult("wf-1", task1.taskId(), "worker-1", true, Map.of("step1Ok", true), null, 0, def, now + 500);

        // 4. Poll task for step-two
        List<TaskSnapshot> polled2 = persistencePort.pollTasks("t1", "SIMPLE", "default", 1, "worker-2", 30000L, now + 1000);
        assertThat(polled2).hasSize(1);
        TaskSnapshot task2 = polled2.get(0);
        assertThat(task2.taskReferenceName()).isEqualTo("step-two");

        // 5. Complete step-two -> workflow should transition to COMPLETED
        service.reportTaskResult("wf-1", task2.taskId(), "worker-2", true, Map.of("step2Ok", true), null, 0, def, now + 1500);

        WorkflowSnapshot finalSnap = persistencePort.getWorkflowSnapshot("wf-1").orElseThrow();
        assertThat(finalSnap.status()).isEqualTo(WorkflowStatus.COMPLETED);
        assertThat(finalSnap.outputPayload()).containsEntry("step1Ok", true);
        assertThat(finalSnap.outputPayload()).containsEntry("step2Ok", true);
    }

    @Test
    @DisplayName("Should recover and retry task when lease expires via sweepExpiredTasks")
    void shouldSweepExpiredTasksAndTriggerRetry() {
        WorkflowDefinition def = WorkflowDefinition.builder("retry-wf")
            .tasks(List.of(
                TaskDefinition.builder("flaky-task").retryCount(3).retryDelaySeconds(2).build()
            ))
            .build();

        long now = 1000L;
        service.startWorkflow("wf-sweep", "t1", "ws1", def, Map.of(), now);

        // Worker alpha polls with 10s response timeout
        List<TaskSnapshot> polled = persistencePort.pollTasks("t1", "SIMPLE", "default", 1, "worker-alpha", 10000L, now);
        assertThat(polled).hasSize(1);

        // Worker alpha crashes! 15s later, lease sweeper runs
        int swept = service.sweepExpiredTasks(def, now + 15000L);
        assertThat(swept).isEqualTo(1);

        // Flaky task was marked TIMED_OUT and attempt 2 was scheduled
        TaskSnapshot originalTask = persistencePort.getTaskExecution(polled.get(0).taskId()).orElseThrow();
        assertThat(originalTask.status()).isEqualTo(TaskStatus.TIMED_OUT);

        // Retry task becomes visible at now + 15000 + retryDelay (2000) = 17000L
        List<TaskSnapshot> polledRetry = persistencePort.pollTasks("t1", "SIMPLE", "default", 1, "worker-beta", 10000L, now + 17500L);
        assertThat(polledRetry).hasSize(1);
        assertThat(polledRetry.get(0).attempt()).isEqualTo(2);
    }

    @Test
    @DisplayName("Should quarantine task to DLQ when max retries exhausted and support in-place replay")
    void shouldQuarantineTaskToDlqWhenRetriesExhaustedAndSupportReplay() {
        WorkflowDefinition def = WorkflowDefinition.builder("poison-wf")
            .tasks(List.of(
                TaskDefinition.builder("poison-step").retryCount(1).build()
            ))
            .build();

        long now = 1000L;
        service.startWorkflow("wf-poison", "tenant-dlq", "default", def, Map.of("init", 1), now);

        List<TaskSnapshot> polled = persistencePort.pollTasks("tenant-dlq", "SIMPLE", "default", 1, "worker-1", 10000L, now);
        assertThat(polled).hasSize(1);
        String taskId = polled.get(0).taskId();

        // Worker reports terminal failure on attempt 1 (maxRetries = 1)
        service.reportTaskResult(
            "wf-poison", taskId, "worker-1", false,
            Collections.emptyMap(), "OutOfMemoryError: Java heap space", 0, def, now + 1000L
        );

        // Workflow failed
        WorkflowSnapshot wfSnap = persistencePort.getWorkflowSnapshot("wf-poison").orElseThrow();
        assertThat(wfSnap.status()).isIn(WorkflowStatus.FAILED, WorkflowStatus.COMPENSATED_FAILED);

        // Task quarantined into DLQ
        List<com.acc.workflow.core.model.TaskDlqRecord> dlqList = persistencePort.listDlqTasks("tenant-dlq", "ISOLATED", 10);
        assertThat(dlqList).hasSize(1);
        com.acc.workflow.core.model.TaskDlqRecord dlqRecord = dlqList.get(0);
        assertThat(dlqRecord.taskId()).isEqualTo(taskId);
        assertThat(dlqRecord.errorMessage()).contains("OutOfMemoryError");

        // Operator replays quarantined task with payload override
        Optional<com.acc.workflow.core.model.TaskDlqRecord> replayedOpt = service.replayDlqTask(
            dlqRecord.dlqId(), Map.of("fixedMemory", 512), now + 5000L
        );
        assertThat(replayedOpt).isPresent();
        assertThat(replayedOpt.get().status()).isEqualTo("REPLAYED");

        // Parent workflow resumed to RUNNING
        WorkflowSnapshot resumedWf = persistencePort.getWorkflowSnapshot("wf-poison").orElseThrow();
        assertThat(resumedWf.status()).isEqualTo(WorkflowStatus.RUNNING);

        // Task re-enqueued and available to poll
        List<TaskSnapshot> rePolled = persistencePort.pollTasks("tenant-dlq", "SIMPLE", "default", 1, "worker-2", 10000L, now + 5000L);
        assertThat(rePolled).hasSize(1);
        assertThat(rePolled.get(0).attempt()).isEqualTo(1);
        assertThat(rePolled.get(0).inputData()).containsEntry("fixedMemory", 512);
    }
}

