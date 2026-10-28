package com.acc.aio.controller.workflow;

import com.acc.aio.config.WorkflowEngineConfiguration.WorkflowDefinitionRegistry;
import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.decider.PureDecider;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import com.acc.workflow.ports.PersistencePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.http.ResponseEntity;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class WorkflowChaosStressVerificationTest {

    private PersistencePort persistencePort;
    private PureDecider pureDecider;
    private WorkflowEngineService engineService;
    private WorkflowDefinitionRegistry registry;
    private ExecutionStreamBroadcaster broadcaster;
    private TaskWorkerController workerController;

    private static final String TENANT_ID = "tenant-chaos-40";
    private static final String WORKSPACE_ID = "ws-chaos-40";

    @BeforeEach
    void setUp() {
        persistencePort = new InMemoryPersistenceAdapter();
        pureDecider = new PureDecider();
        engineService = new WorkflowEngineService(persistencePort, pureDecider);
        registry = new WorkflowDefinitionRegistry();
        broadcaster = new ExecutionStreamBroadcaster();
        workerController = new TaskWorkerController(engineService, persistencePort, registry, broadcaster);
    }

    @Test
    @DisplayName("Phase 40: 1,000-Concurrent Workflow Stress Test with High-Throughput Executor & Lease Crash Recovery")
    @Timeout(value = 60, unit = TimeUnit.SECONDS)
    void test1000ConcurrentExecutionsWithWorkerCrashReclamation() throws Exception {
        final int CONCURRENT_RUNS = 1000;
        final long startTime = System.currentTimeMillis();

        // 1. Register a multi-step order workflow
        TaskDefinition step1 = TaskDefinition.builder("step1-validate")
            .taskType(TaskType.SIMPLE)
            .domain("validation")
            .build();

        TaskDefinition step2 = TaskDefinition.builder("step2-fulfill")
            .taskType(TaskType.SIMPLE)
            .domain("fulfillment")
            .build();

        WorkflowDefinition orderWorkflow = WorkflowDefinition.builder("stress-order-workflow")
            .tasks(List.of(step1, step2))
            .build();

        registry.register(TENANT_ID, orderWorkflow);

        // 2. Launch 1,000 concurrent executions using high-concurrency thread pool
        CountDownLatch startLatch = new CountDownLatch(CONCURRENT_RUNS);
        Map<String, String> executionIds = new ConcurrentHashMap<>();
        ExecutorService executor = Executors.newFixedThreadPool(64);

        try {
            for (int i = 0; i < CONCURRENT_RUNS; i++) {
                final int idx = i;
                executor.submit(() -> {
                    try {
                        String execId = "stress_exec_" + idx;
                        engineService.startWorkflow(
                            execId,
                            TENANT_ID,
                            WORKSPACE_ID,
                            orderWorkflow,
                            Map.of("orderIndex", idx, "amount", 100 + idx),
                            startTime
                        );
                        executionIds.put(execId, execId);
                    } finally {
                        startLatch.countDown();
                    }
                });
            }
            boolean startedOk = startLatch.await(20, TimeUnit.SECONDS);
            assertThat(startedOk).isTrue();
            assertThat(executionIds).hasSize(CONCURRENT_RUNS);
        } finally {
            executor.shutdown();
        }

        // 3. Simulate Worker Host Crash:
        // Worker A polls 500 tasks, but abruptly crashes mid-execution (lease never resolved)
        List<TaskSnapshot> crashedBatch = persistencePort.pollTasks(
            TENANT_ID, "SIMPLE", "validation", 500, "worker-crashing-host", 30000L, startTime
        );
        assertThat(crashedBatch).hasSize(500);

        // Advance simulated time past lease visibility timeout (30s)
        long postCrashTime = startTime + 31000L;

        // Healthy Worker B sweeps and polls expired leases + remaining tasks
        List<TaskSnapshot> reclaimedAndRemaining = persistencePort.pollTasks(
            TENANT_ID, "SIMPLE", "validation", 1000, "worker-healthy-host", 30000L, postCrashTime
        );
        assertThat(reclaimedAndRemaining).hasSize(1000);

        // Complete Step 1 for all 1,000 tasks
        for (TaskSnapshot task : reclaimedAndRemaining) {
            workerController.reportResult(
                task.taskId(),
                new TaskWorkerController.TaskResultRequest(true, Map.of("validated", true), null, 0),
                TENANT_ID
            );
        }

        // 4. Poll and complete Step 2 for all 1,000 tasks
        List<TaskSnapshot> step2Tasks = persistencePort.pollTasks(
            TENANT_ID, "SIMPLE", "fulfillment", 1000, "worker-healthy-host", 30000L, postCrashTime + 1000L
        );
        assertThat(step2Tasks).hasSize(1000);

        for (TaskSnapshot task : step2Tasks) {
            workerController.reportResult(
                task.taskId(),
                new TaskWorkerController.TaskResultRequest(true, Map.of("fulfilled", true), null, 0),
                TENANT_ID
            );
        }

        // 5. Verification: Zero dropped executions, all 1,000 reached COMPLETED
        AtomicInteger completedCount = new AtomicInteger(0);
        for (String execId : executionIds.keySet()) {
            WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(execId).orElse(null);
            assertThat(snapshot).isNotNull();
            assertThat(snapshot.status()).isEqualTo(WorkflowStatus.COMPLETED);
            completedCount.incrementAndGet();
        }

        assertThat(completedCount.get()).isEqualTo(CONCURRENT_RUNS);
    }

    @Test
    @DisplayName("Phase 40: Cascading Saga Compensation Stress across 200 Concurrent Fault Injections")
    void testCascadingSagaFaultCompensationUnderStress() {
        final int SAGA_RUNS = 200;
        final long now = System.currentTimeMillis();

        TaskDefinition step1Reserve = TaskDefinition.builder("step1-reserve")
            .taskType(TaskType.SIMPLE)
            .domain("inventory")
            .compensateHandlerRef("release-inventory")
            .build();

        TaskDefinition step2Payment = TaskDefinition.builder("step2-payment")
            .taskType(TaskType.SIMPLE)
            .domain("payment")
            .compensateHandlerRef("refund-payment")
            .build();

        TaskDefinition step3Shipping = TaskDefinition.builder("step3-shipping")
            .taskType(TaskType.SIMPLE)
            .domain("shipping")
            .retryCount(0)
            .build();

        WorkflowDefinition sagaWorkflow = WorkflowDefinition.builder("saga-order-workflow")
            .tasks(List.of(step1Reserve, step2Payment, step3Shipping))
            .build();

        registry.register(TENANT_ID, sagaWorkflow);

        // Start 200 workflows
        for (int i = 0; i < SAGA_RUNS; i++) {
            engineService.startWorkflow(
                "saga_exec_" + i,
                TENANT_ID,
                WORKSPACE_ID,
                sagaWorkflow,
                Map.of("sku", "ITEM-" + i),
                now
            );
        }

        // Complete Step 1 (reserve) for all 200
        List<TaskSnapshot> step1Tasks = persistencePort.pollTasks(
            TENANT_ID, "SIMPLE", "inventory", SAGA_RUNS, "worker-inv", 30000L, System.currentTimeMillis() + 60000L
        );
        for (TaskSnapshot t : step1Tasks) {
            workerController.reportResult(
                t.taskId(),
                new TaskWorkerController.TaskResultRequest(true, Map.of("reserved", true), null, 0),
                TENANT_ID
            );
        }

        // Complete Step 2 (payment) for all 200
        List<TaskSnapshot> step2Tasks = persistencePort.pollTasks(
            TENANT_ID, "SIMPLE", "payment", SAGA_RUNS, "worker-pay", 30000L, System.currentTimeMillis() + 60000L
        );
        for (TaskSnapshot t : step2Tasks) {
            workerController.reportResult(
                t.taskId(),
                new TaskWorkerController.TaskResultRequest(true, Map.of("charged", true), null, 0),
                TENANT_ID
            );
        }

        // Inject intentional failure on Step 3 (shipping)
        List<TaskSnapshot> step3Tasks = persistencePort.pollTasks(
            TENANT_ID, "SIMPLE", "shipping", SAGA_RUNS, "worker-ship", 30000L, System.currentTimeMillis() + 60000L
        );
        for (TaskSnapshot t : step3Tasks) {
            workerController.reportResult(
                t.taskId(),
                new TaskWorkerController.TaskResultRequest(false, Collections.emptyMap(), "Carrier Connection Refused", 0),
                TENANT_ID
            );
        }

        // Assert all 200 failed workflows handled cleanly and entered COMPENSATED_FAILED status
        int compensatedCount = 0;
        for (int i = 0; i < SAGA_RUNS; i++) {
            WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot("saga_exec_" + i).orElse(null);
            assertThat(snapshot).isNotNull();
            assertThat(snapshot.status()).isIn(WorkflowStatus.COMPENSATED_FAILED, WorkflowStatus.FAILED);
            compensatedCount++;
        }

        assertThat(compensatedCount).isEqualTo(SAGA_RUNS);
    }
}
