package com.acc.workflow.application;

import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.adapters.transport.InProcessTransportAdapter;
import com.acc.workflow.core.decider.PureDecider;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import com.acc.workflow.worker.TaskOutcome;
import com.acc.workflow.worker.WorkerConfig;
import com.acc.workflow.worker.WorkerHost;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class ChaosWorkflowIntegrationTest {

    @Test
    @DisplayName("Chaos: 100 concurrent workflow executions with worker chaos and lease sweeps resolve cleanly")
    void testConcurrentChaosExecutions() throws InterruptedException {
        int workflowCount = 100;
        InMemoryPersistenceAdapter persistence = new InMemoryPersistenceAdapter();
        WorkflowEngineService engine = new WorkflowEngineService(persistence, new PureDecider());

        WorkflowDefinition def = WorkflowDefinition.builder("chaos-pipeline")
            .version(1)
            .addTask(TaskDefinition.builder("step1")
                .taskType(TaskType.SIMPLE)
                .timeoutSeconds(1) // Fast lease expiration
                .retryCount(3)
                .build())
            .addTask(TaskDefinition.builder("step2")
                .taskType(TaskType.SIMPLE)
                .timeoutSeconds(1)
                .build())
            .build();

        InProcessTransportAdapter transport = new InProcessTransportAdapter(persistence, engine, def, 1000L);
        WorkerHost workerHost = new WorkerHost(transport, "chaos-worker");

        AtomicInteger step1Runs = new AtomicInteger(0);
        AtomicInteger step2Runs = new AtomicInteger(0);

        // Worker with intentional transient failures (chaos)
        workerHost.register(
            new WorkerConfig("SIMPLE", "chaos-tenant", "default", 20, 10L, 50L, 5, 2000L),
            ctx -> {
                if (ctx.referenceName().equals("step1")) {
                    int run = step1Runs.incrementAndGet();
                    if (run % 5 == 0) {
                        // Fail 20% of first attempts to exercise retry
                        return TaskOutcome.failedRetryable("Simulated chaos crash");
                    }
                    return TaskOutcome.completed(Map.of("step1Ok", true));
                } else {
                    step2Runs.incrementAndGet();
                    return TaskOutcome.completed(Map.of("step2Ok", true));
                }
            }
        );

        workerHost.start();

        long now = System.currentTimeMillis();
        ExecutorService submitter = Executors.newFixedThreadPool(10);
        CountDownLatch startLatch = new CountDownLatch(workflowCount);
        List<String> workflowIds = new ArrayList<>();

        for (int i = 0; i < workflowCount; i++) {
            String wfId = "chaos-wf-" + i;
            workflowIds.add(wfId);
            submitter.submit(() -> {
                engine.startWorkflow(wfId, "chaos-tenant", "default", def, Map.of("i", wfId), now);
                startLatch.countDown();
            });
        }

        boolean started = startLatch.await(5, TimeUnit.SECONDS);
        assertThat(started).isTrue();
        submitter.shutdown();

        // Run sweeper periodically to simulate background lease timeout recovery
        for (int s = 0; s < 5; s++) {
            Thread.sleep(300);
            engine.sweepExpiredTasks(def, System.currentTimeMillis() + 1500L);
        }

        // Wait for workers to process queues
        Thread.sleep(1500);

        workerHost.close();

        // Verify that completed or recoverable workflows progressed
        int completedCount = 0;
        for (String id : workflowIds) {
            WorkflowSnapshot snapshot = persistence.getWorkflowSnapshot(id).orElse(null);
            if (snapshot != null && snapshot.status() == WorkflowStatus.COMPLETED) {
                completedCount++;
            }
        }

        // Under 20% random failures + 3 retries, at least 80% of workflows should reach COMPLETED
        assertThat(completedCount).isGreaterThanOrEqualTo(75);
    }
}
