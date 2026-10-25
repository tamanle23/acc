package com.acc.workflow.worker;

import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.decider.PureDecider;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import com.acc.workflow.ports.WorkerTransportPort;
import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.adapters.transport.InProcessTransportAdapter;
import com.acc.workflow.worker.middleware.AutoHeartbeatMiddleware;
import com.acc.workflow.worker.middleware.ErrorClassificationMiddleware;
import com.acc.workflow.worker.middleware.SchemaValidationMiddleware;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class WorkerHostTest {

    private InMemoryPersistenceAdapter persistence;
    private WorkflowEngineService service;
    private WorkerTransportPort transport;
    private WorkerHost workerHost;
    private WorkflowDefinition defaultWorkflowDef;

    @BeforeEach
    void setUp() {
        persistence = new InMemoryPersistenceAdapter();
        service = new WorkflowEngineService(persistence, new PureDecider());
        defaultWorkflowDef = WorkflowDefinition.builder("payment-flow")
            .version(1)
            .addTask(TaskDefinition.builder("chargeCard")
                .taskType(TaskType.SIMPLE)
                .inputParameters(Map.of("amount", 100))
                .build())
            .build();
        transport = new InProcessTransportAdapter(persistence, service, defaultWorkflowDef, 5000L);
        workerHost = new WorkerHost(transport, "test-worker-1");
    }

    @AfterEach
    void tearDown() {
        if (workerHost != null) {
            workerHost.close();
        }
    }

    @Test
    @DisplayName("WorkerHost should register simple task handler, poll task, execute on virtual thread and report completed")
    void testSimpleTaskExecution() throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicInteger executedCount = new AtomicInteger(0);

        workerHost.register(
            new WorkerConfig("SIMPLE", "t1", "default", 10, 20L, 100L, 5, 5000L),
            ctx -> {
                executedCount.incrementAndGet();
                latch.countDown();
                return TaskOutcome.completed(Map.of("chargeId", "ch_12345", "status", "SUCCESS"));
            }
        );

        workerHost.start();

        service.startWorkflow("wftest1", "t1", "w1", defaultWorkflowDef, Map.of("amount", 100), System.currentTimeMillis());

        boolean completed = latch.await(5, TimeUnit.SECONDS);
        assertThat(completed).isTrue();
        assertThat(executedCount.get()).isEqualTo(1);

        // Allow transport report to settle
        Thread.sleep(300);

        WorkflowSnapshot snapshot = persistence.getWorkflowSnapshot("wftest1").orElseThrow();
        assertThat(snapshot.status()).isEqualTo(WorkflowStatus.COMPLETED);
    }

    @Test
    @DisplayName("WorkerHost with middlewares should validate input, attach auto-heartbeat and handle error classification")
    void testWorkerHostWithMiddlewares() throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(1);

        WorkflowDefinition valDef = WorkflowDefinition.builder("validation-flow")
            .version(1)
            .addTask(TaskDefinition.builder("validTask")
                .taskType(TaskType.SIMPLE)
                .inputParameters(Map.of("requiredKey", "validValue"))
                .build())
            .build();

        WorkerTransportPort valTransport = new InProcessTransportAdapter(persistence, service, valDef, 5000L);
        WorkerHost valHost = new WorkerHost(valTransport, "val-worker-1");

        valHost
            .use(new SchemaValidationMiddleware(List.of("requiredKey")))
            .use(new AutoHeartbeatMiddleware(50))
            .use(new ErrorClassificationMiddleware());

        valHost.register(
            new WorkerConfig("SIMPLE", "t1", "default", 5, 20L, 100L, 2, 50L),
            ctx -> {
                ctx.log("Executing validated task with input: " + ctx.input());
                Thread.sleep(100); // Trigger auto-heartbeat
                latch.countDown();
                return TaskOutcome.completed(Map.of("processed", true));
            }
        );

        valHost.start();

        service.startWorkflow("wf_val_1", "t1", "w1", valDef, Map.of(), System.currentTimeMillis());

        boolean done = latch.await(5, TimeUnit.SECONDS);
        assertThat(done).isTrue();

        valHost.close();
    }
}
