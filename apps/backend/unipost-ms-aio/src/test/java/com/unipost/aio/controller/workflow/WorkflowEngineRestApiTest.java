package com.unipost.aio.controller.workflow;

import com.unipost.aio.config.WorkflowEngineConfiguration.WorkflowDefinitionRegistry;
import com.unipost.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.unipost.workflow.application.WorkflowEngineService;
import com.unipost.workflow.core.decider.PureDecider;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import com.unipost.workflow.ports.PersistencePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class WorkflowEngineRestApiTest {

    private PersistencePort persistencePort;
    private PureDecider pureDecider;
    private WorkflowEngineService engineService;
    private WorkflowDefinitionRegistry registry;

    private WorkflowDefinitionController definitionController;
    private WorkflowExecutionController executionController;
    private TaskWorkerController workerController;

    private static final String TENANT_ID = "tenant-test-33";
    private static final String WORKSPACE_ID = "ws-prod-33";

    @BeforeEach
    void setUp() {
        persistencePort = new InMemoryPersistenceAdapter();
        pureDecider = new PureDecider();
        engineService = new WorkflowEngineService(persistencePort, pureDecider);
        registry = new WorkflowDefinitionRegistry();

        definitionController = new WorkflowDefinitionController(registry);
        executionController = new WorkflowExecutionController(engineService, persistencePort, registry);
        workerController = new TaskWorkerController(engineService, persistencePort, registry);
    }

    @Test
    @DisplayName("Phase 33: End-to-end definition registration, execution lifecycle, worker polling, and heartbeat reporting")
    void testEndToEndWorkflowRestEngine() {
        // 1. Register a valid acyclic WorkflowDefinition
        WorkflowDefinition definition = WorkflowDefinition.builder("order-pipeline-test")
            .name("Order Pipeline")
            .version(1)
            .tasks(List.of(
                TaskDefinition.builder("step1-validate").domain("order").build(),
                TaskDefinition.builder("step2-charge").domain("payment").build()
            ))
            .layoutMetadata(Map.of("step1-validate", Map.of("x", 100, "y", 200)))
            .build();

        ResponseEntity<?> regResp = definitionController.registerDefinition(definition, TENANT_ID);
        assertThat(regResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(regResp.getBody()).isInstanceOf(WorkflowDefinition.class);
        WorkflowDefinition savedDef = (WorkflowDefinition) regResp.getBody();
        assertThat(savedDef.workflowKey()).isEqualTo("order-pipeline-test");

        // 2. Query definition by key
        ResponseEntity<?> getDefResp = definitionController.getDefinition("order-pipeline-test", TENANT_ID);
        assertThat(getDefResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(((WorkflowDefinition) getDefResp.getBody()).name()).isEqualTo("Order Pipeline");

        // 3. List definitions
        ResponseEntity<Collection<WorkflowDefinition>> listResp = definitionController.listDefinitions(TENANT_ID);
        assertThat(listResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(listResp.getBody()).hasSize(1);

        // 4. Start Workflow Execution
        var startRequest = new WorkflowExecutionController.StartWorkflowRequest(
            "order-pipeline-test",
            Map.of("orderId", "ORD-12345", "amount", 150.0)
        );

        ResponseEntity<?> startResp = executionController.startExecution(startRequest, TENANT_ID, WORKSPACE_ID);
        assertThat(startResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(startResp.getBody()).isInstanceOf(WorkflowSnapshot.class);
        WorkflowSnapshot initialSnap = (WorkflowSnapshot) startResp.getBody();
        assertThat(initialSnap.status()).isEqualTo(WorkflowStatus.RUNNING);
        String workflowId = initialSnap.workflowId();

        // 5. Worker polls for step1-validate task
        ResponseEntity<List<TaskSnapshot>> pollResp = workerController.pollTasks(
            "SIMPLE", "order", "worker-node-1", 1, TENANT_ID
        );
        assertThat(pollResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<TaskSnapshot> tasks = pollResp.getBody();
        assertThat(tasks).hasSize(1);
        TaskSnapshot task1 = tasks.get(0);
        assertThat(task1.taskReferenceName()).isEqualTo("step1-validate");
        String taskId = task1.taskId();

        // 6. Worker heartbeats lease
        ResponseEntity<?> heartbeatResp = workerController.heartbeat(taskId, Map.of("workerId", "worker-node-1"));
        assertThat(heartbeatResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(((Map<?, ?>) heartbeatResp.getBody()).get("renewed")).isEqualTo(true);

        // 7. Worker completes step1-validate
        var resultReq = new TaskWorkerController.TaskResultRequest(
            true,
            Map.of("validated", true, "inventoryLockId", "LOCK-99"),
            null,
            0
        );
        ResponseEntity<?> resultResp = workerController.reportResult(taskId, resultReq, TENANT_ID);
        assertThat(resultResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        // 8. Query execution status to assert step 1 completed and step 2 scheduled
        ResponseEntity<?> getExecResp = executionController.getExecution(workflowId, TENANT_ID);
        assertThat(getExecResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        WorkflowSnapshot progressSnap = (WorkflowSnapshot) getExecResp.getBody();
        assertThat(progressSnap.workflowId()).isEqualTo(workflowId);
        assertThat(progressSnap.tasksByRef().get("step1-validate").status().name()).isEqualTo("COMPLETED");

        // 9. Worker polls for step2-charge
        ResponseEntity<List<TaskSnapshot>> poll2Resp = workerController.pollTasks(
            "SIMPLE", "payment", "worker-node-2", 1, TENANT_ID
        );
        assertThat(poll2Resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(poll2Resp.getBody()).hasSize(1);
        TaskSnapshot task2 = poll2Resp.getBody().get(0);
        assertThat(task2.taskReferenceName()).isEqualTo("step2-charge");

        // 10. Complete step2-charge -> workflow should transition to COMPLETED
        workerController.reportResult(
            task2.taskId(),
            new TaskWorkerController.TaskResultRequest(true, Map.of("paid", true), null, 0),
            TENANT_ID
        );

        ResponseEntity<?> finalExecResp = executionController.getExecution(workflowId, TENANT_ID);
        assertThat(finalExecResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        WorkflowSnapshot finalSnap = (WorkflowSnapshot) finalExecResp.getBody();
        assertThat(finalSnap.status()).isEqualTo(WorkflowStatus.COMPLETED);
    }
}
