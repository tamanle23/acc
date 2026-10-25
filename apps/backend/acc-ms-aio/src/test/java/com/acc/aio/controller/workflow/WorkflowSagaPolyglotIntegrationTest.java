package com.acc.aio.controller.workflow;

import com.acc.aio.config.WorkflowEngineConfiguration.WorkflowDefinitionRegistry;
import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.decider.PureDecider;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import com.acc.workflow.ports.PersistencePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class WorkflowSagaPolyglotIntegrationTest {

    private PersistencePort persistencePort;
    private PureDecider pureDecider;
    private WorkflowEngineService engineService;
    private WorkflowDefinitionRegistry registry;
    private ExecutionStreamBroadcaster broadcaster;

    private WorkflowDefinitionController definitionController;
    private WorkflowExecutionController executionController;
    private TaskWorkerController workerController;

    private static final String TENANT_ID = "tenant-saga-35";
    private static final String WORKSPACE_ID = "ws-saga-35";

    @BeforeEach
    void setUp() {
        persistencePort = new InMemoryPersistenceAdapter();
        pureDecider = new PureDecider();
        engineService = new WorkflowEngineService(persistencePort, pureDecider);
        registry = new WorkflowDefinitionRegistry();
        broadcaster = new ExecutionStreamBroadcaster();

        definitionController = new WorkflowDefinitionController(registry);
        executionController = new WorkflowExecutionController(engineService, persistencePort, registry, broadcaster);
        workerController = new TaskWorkerController(engineService, persistencePort, registry, broadcaster);
    }

    @Test
    @DisplayName("Sub-phase 35.4: End-to-end polyglot orchestration with fault injection triggers reverse Saga compensation")
    void testPolyglotFulfillmentWithSagaCompensation() {
        // 1. Define the polyglot fulfillment workflow:
        // Step 1: Validate & Reserve Inventory (Java worker, with compensation "release-inventory")
        // Step 2: Switch on tier (express vs ground)
        // Step 3: Dispatch packaging (TypeScript worker, with compensation "cancel-packing")
        // Step 4: Payment Capture (Fault injected -> permanent failure)
        TaskDefinition step1Reserve = TaskDefinition.builder("step1-reserve-inventory")
            .taskType(TaskType.SIMPLE)
            .domain("inventory")
            .compensateHandlerRef("release-inventory-worker")
            .inputParameters(Map.of("itemSku", "${workflow.input.sku}", "quantity", "${workflow.input.qty}"))
            .build();

        TaskDefinition step2Dispatch = TaskDefinition.builder("step2-dispatch-package")
            .taskType(TaskType.SIMPLE)
            .domain("logistics")
            .compensateHandlerRef("cancel-packing-worker")
            .inputParameters(Map.of("packageId", "PKG-9901"))
            .build();

        TaskDefinition step3Payment = TaskDefinition.builder("step3-capture-payment")
            .taskType(TaskType.SIMPLE)
            .domain("billing")
            .retryCount(0) // Fail fast to trigger immediate unrecoverable failure
            .inputParameters(Map.of("amount", 250.0))
            .build();

        WorkflowDefinition definition = WorkflowDefinition.builder("polyglot-order-fulfillment")
            .name("Polyglot Order Fulfillment DAG")
            .version(1)
            .tasks(List.of(step1Reserve, step2Dispatch, step3Payment))
            .build();

        // Register definition
        definitionController.registerDefinition(definition, TENANT_ID);

        // Start execution
        Map<String, Object> input = Map.of("sku", "IPHONE-16-PRO", "qty", 1);
        var startReq = new WorkflowExecutionController.StartWorkflowRequest("polyglot-order-fulfillment", input);
        ResponseEntity<?> startResp = executionController.startExecution(startReq, TENANT_ID, WORKSPACE_ID);
        assertThat(startResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        WorkflowSnapshot initialSnap = (WorkflowSnapshot) startResp.getBody();
        String workflowId = initialSnap.workflowId();

        // 2. Java Worker executes step 1 (reserve inventory)
        ResponseEntity<List<TaskSnapshot>> poll1 = workerController.pollTasks(
            "SIMPLE", "inventory", "java-worker-1", 1, TENANT_ID
        );
        assertThat(poll1.getBody()).hasSize(1);
        TaskSnapshot task1 = poll1.getBody().get(0);
        assertThat(task1.taskReferenceName()).isEqualTo("step1-reserve-inventory");

        workerController.reportResult(
            task1.taskId(),
            new TaskWorkerController.TaskResultRequest(true, Map.of("reservationId", "RES-5501"), null, 0),
            TENANT_ID
        );

        // 3. TypeScript Worker executes step 2 (dispatch package)
        ResponseEntity<List<TaskSnapshot>> poll2 = workerController.pollTasks(
            "SIMPLE", "logistics", "ts-worker-1", 1, TENANT_ID
        );
        assertThat(poll2.getBody()).hasSize(1);
        TaskSnapshot task2 = poll2.getBody().get(0);
        assertThat(task2.taskReferenceName()).isEqualTo("step2-dispatch-package");

        workerController.reportResult(
            task2.taskId(),
            new TaskWorkerController.TaskResultRequest(true, Map.of("trackingNumber", "TRK-9902"), null, 0),
            TENANT_ID
        );

        // 4. Billing Worker executes step 3 (capture payment) with FAULT INJECTION (failure)
        ResponseEntity<List<TaskSnapshot>> poll3 = workerController.pollTasks(
            "SIMPLE", "billing", "payment-worker-1", 1, TENANT_ID
        );
        assertThat(poll3.getBody()).hasSize(1);
        TaskSnapshot task3 = poll3.getBody().get(0);
        assertThat(task3.taskReferenceName()).isEqualTo("step3-capture-payment");

        // Report permanent failure (Card declined)
        workerController.reportResult(
            task3.taskId(),
            new TaskWorkerController.TaskResultRequest(false, Collections.emptyMap(), "PaymentDeclinedException: Card issuer rejected charge", 0),
            TENANT_ID
        );

        // 5. Verify Workflow transitions to COMPENSATED_FAILED
        ResponseEntity<?> execResp = executionController.getExecution(workflowId, TENANT_ID);
        WorkflowSnapshot compensatedSnap = (WorkflowSnapshot) execResp.getBody();
        assertThat(compensatedSnap.status()).isEqualTo(WorkflowStatus.COMPENSATED_FAILED);

        // 6. Verify Saga reverse topological compensation scheduled the tasks in exact reverse order:
        // Reverse order: first cancel-packing-worker (Step 2), then release-inventory-worker (Step 1)
        ResponseEntity<List<TaskSnapshot>> pollCompLogistics = workerController.pollTasks(
            "cancel-packing-worker", "logistics", "ts-worker-1", 1, TENANT_ID
        );
        assertThat(pollCompLogistics.getBody()).hasSize(1);
        TaskSnapshot compStep2 = pollCompLogistics.getBody().get(0);
        assertThat(compStep2.taskReferenceName()).isEqualTo("step2-dispatch-package_COMPENSATE");
        assertThat(compStep2.inputData()).containsEntry("packageId", "PKG-9901");
        // Acknowledge step 2 compensation
        workerController.reportResult(
            compStep2.taskId(),
            new TaskWorkerController.TaskResultRequest(true, Map.of("cancelled", true), null, 0),
            TENANT_ID
        );

        ResponseEntity<List<TaskSnapshot>> pollCompInventory = workerController.pollTasks(
            "release-inventory-worker", "inventory", "java-worker-1", 1, TENANT_ID
        );
        assertThat(pollCompInventory.getBody()).hasSize(1);
        TaskSnapshot compStep1 = pollCompInventory.getBody().get(0);
        assertThat(compStep1.taskReferenceName()).isEqualTo("step1-reserve-inventory_COMPENSATE");
        assertThat(compStep1.inputData()).containsEntry("itemSku", "IPHONE-16-PRO");
        // Acknowledge step 1 compensation
        workerController.reportResult(
            compStep1.taskId(),
            new TaskWorkerController.TaskResultRequest(true, Map.of("released", true), null, 0),
            TENANT_ID
        );
    }
}
