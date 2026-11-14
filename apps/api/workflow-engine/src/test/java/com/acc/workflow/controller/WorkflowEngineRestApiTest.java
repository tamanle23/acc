package com.acc.workflow.controller;

import com.acc.workflow.application.WorkflowDefinitionRegistry;
import com.acc.fw.tenancy.TenantContextHolder;
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
import org.junit.jupiter.api.AfterEach;
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
    private ExecutionStreamBroadcaster broadcaster;

    private WorkflowDefinitionController definitionController;
    private WorkflowExecutionController executionController;
    private TaskWorkerController workerController;

    private static final String TENANT_ID = "tenant-test-33";
    private static final String WORKSPACE_ID = "ws-prod-33";

    @BeforeEach
    void setUp() {
        TenantContextHolder.setTenantId(TENANT_ID);
        persistencePort = new InMemoryPersistenceAdapter();
        pureDecider = new PureDecider();
        engineService = new WorkflowEngineService(persistencePort, pureDecider);
        registry = new WorkflowDefinitionRegistry();
        broadcaster = new ExecutionStreamBroadcaster();

        definitionController = new WorkflowDefinitionController(registry);
        executionController = new WorkflowExecutionController(engineService, persistencePort, registry, broadcaster);
        workerController = new TaskWorkerController(engineService, persistencePort, registry, broadcaster);
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    @DisplayName("Phase 33: End-to-end definition registration, execution lifecycle, worker polling, and heartbeat reporting")
    void testEndToEndWorkflowRestEngine() {
        // 1. Register a valid acyclic WorkflowDefinition with predefined inputSchema and outputSchema
        WorkflowDefinition definition = WorkflowDefinition.builder("order-pipeline-test")
            .name("Order Pipeline")
            .version(1)
            .inputSchema(Map.of(
                "type", "object",
                "required", List.of("orderId", "amount"),
                "properties", Map.of(
                    "orderId", Map.of("type", "string"),
                    "amount", Map.of("type", "number")
                ),
                "additionalProperties", false
            ))
            .outputSchema(Map.of(
                "type", "object",
                "properties", Map.of("status", Map.of("type", "string")),
                "additionalProperties", false
            ))
            .tasks(List.of(
                TaskDefinition.builder("step1-validate").domain("order").build(),
                TaskDefinition.builder("step2-charge").domain("payment").build()
            ))
            .layoutMetadata(Map.of("step1-validate", Map.of("x", 100, "y", 200)))
            .build();

        ResponseEntity<?> regResp = definitionController.registerDefinition(definition);
        assertThat(regResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(regResp.getBody()).isInstanceOf(WorkflowDefinition.class);
        WorkflowDefinition savedDef = (WorkflowDefinition) regResp.getBody();
        assertThat(savedDef.workflowKey()).isEqualTo("order-pipeline-test");

        // 2. Query definition by key
        ResponseEntity<?> getDefResp = definitionController.getDefinition("order-pipeline-test");
        assertThat(getDefResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(((WorkflowDefinition) getDefResp.getBody()).name()).isEqualTo("Order Pipeline");

        // 3. List definitions
        ResponseEntity<Collection<WorkflowDefinition>> listResp = definitionController.listDefinitions();
        assertThat(listResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(listResp.getBody()).hasSize(1);

        // 4. Start Workflow Execution
        var startRequest = new WorkflowExecutionController.StartWorkflowRequest(
            "order-pipeline-test",
            Map.of("orderId", "ORD-12345", "amount", 150.0)
        );

        ResponseEntity<?> startResp = executionController.startExecution(startRequest, WORKSPACE_ID);
        assertThat(startResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(startResp.getBody()).isInstanceOf(WorkflowSnapshot.class);
        WorkflowSnapshot initialSnap = (WorkflowSnapshot) startResp.getBody();
        assertThat(initialSnap.status()).isEqualTo(WorkflowStatus.RUNNING);
        String workflowId = initialSnap.workflowId();

        // 5. Worker polls for step1-validate task
        ResponseEntity<List<TaskSnapshot>> pollResp = workerController.pollTasks(
            "SIMPLE", "order", "worker-node-1", 1
        );
        assertThat(pollResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<TaskSnapshot> tasks = pollResp.getBody();
        assertThat(tasks).hasSize(1);
        TaskSnapshot task1 = tasks.get(0);
        assertThat(task1.taskReferenceName()).isEqualTo("step1-validate");
        String taskId = task1.taskId();

        // 5. Connect SSE stream for workflowId
        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter = executionController.streamExecutionEvents(workflowId);
        assertThat(emitter).isNotNull();

        // 6. Worker heartbeats lease
        ResponseEntity<?> heartbeatResp = workerController.heartbeat(taskId, Map.of("workerId", "worker-node-1"));
        assertThat(heartbeatResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(((Map<?, ?>) heartbeatResp.getBody()).get("renewed")).isEqualTo(true);

        // 6b. Worker streams log chunk for step1-validate and broadcaster sends heartbeat
        ResponseEntity<?> logResp = workerController.appendTaskLog(
            taskId,
            new TaskWorkerController.TaskLogRequest("INFO", "Validating order items and calculating tax", Map.of("step", 1))
        );
        assertThat(logResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(((Map<?, ?>) logResp.getBody()).get("logged")).isEqualTo(true);
        broadcaster.sendHeartbeat();
        assertThat(broadcaster.getActiveClientCount(workflowId)).isEqualTo(1);

        // 7. Worker completes step1-validate
        var resultReq = new TaskWorkerController.TaskResultRequest(
            true,
            Map.of("validated", true, "inventoryLockId", "LOCK-99"),
            null,
            0
        );
        ResponseEntity<?> resultResp = workerController.reportResult(taskId, resultReq);
        assertThat(resultResp.getStatusCode()).isEqualTo(HttpStatus.OK);

        // 8. Query execution status to assert step 1 completed and step 2 scheduled
        ResponseEntity<?> getExecResp = executionController.getExecution(workflowId);
        assertThat(getExecResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        WorkflowSnapshot progressSnap = (WorkflowSnapshot) getExecResp.getBody();
        assertThat(progressSnap.workflowId()).isEqualTo(workflowId);
        assertThat(progressSnap.tasksByRef().get("step1-validate").status().name()).isEqualTo("COMPLETED");

        // 9. Worker polls for step2-charge
        ResponseEntity<List<TaskSnapshot>> poll2Resp = workerController.pollTasks(
            "SIMPLE", "payment", "worker-node-2", 1
        );
        assertThat(poll2Resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(poll2Resp.getBody()).hasSize(1);
        TaskSnapshot task2 = poll2Resp.getBody().get(0);
        assertThat(task2.taskReferenceName()).isEqualTo("step2-charge");

        // 10. Complete step2-charge -> workflow should transition to COMPLETED
        workerController.reportResult(
            task2.taskId(),
            new TaskWorkerController.TaskResultRequest(true, Map.of("paid", true), null, 0)
        );

        ResponseEntity<?> finalExecResp = executionController.getExecution(workflowId);
        assertThat(finalExecResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        WorkflowSnapshot finalSnap = (WorkflowSnapshot) finalExecResp.getBody();
        assertThat(finalSnap.status()).isEqualTo(WorkflowStatus.COMPLETED);
    }

    @Test
    @DisplayName("Blank workflow registration automatically initializes canonical Start and End boundary nodes")
    void testRegisterBlankWorkflowInitializesStartAndEndNodes() {
        WorkflowDefinition blankReq = WorkflowDefinition.builder("blank-pipeline-test")
            .name("Blank Pipeline")
            .version(1)
            .description("A newly created blank workflow")
            .tasks(List.of())
            .build();

        ResponseEntity<?> regResp = definitionController.registerDefinition(blankReq);
        assertThat(regResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(regResp.getBody()).isInstanceOf(WorkflowDefinition.class);
        WorkflowDefinition savedDef = (WorkflowDefinition) regResp.getBody();

        assertThat(savedDef.workflowKey()).isEqualTo("blank-pipeline-test");
        assertThat(savedDef.tasks()).hasSize(2);
        assertThat(savedDef.tasks().get(0).taskReferenceName()).isEqualTo("workflow_start");
        assertThat(savedDef.tasks().get(0).taskType()).isEqualTo(TaskType.START_WORKFLOW);
        assertThat(savedDef.tasks().get(1).taskReferenceName()).isEqualTo("workflow_end");
        assertThat(savedDef.tasks().get(1).taskType()).isEqualTo(TaskType.END_WORKFLOW);
        assertThat(savedDef.layoutMetadata()).containsKey("workflow_start");
        assertThat(savedDef.layoutMetadata()).containsKey("workflow_end");

        // Verify retrieval matches initialized boundary nodes
        ResponseEntity<?> getDefResp = definitionController.getDefinition("blank-pipeline-test");
        assertThat(getDefResp.getStatusCode()).isEqualTo(HttpStatus.OK);
        WorkflowDefinition fetchedDef = (WorkflowDefinition) getDefResp.getBody();
        assertThat(fetchedDef.tasks()).hasSize(2);
    }

    @Test
    @DisplayName("Triggering workflow execution with invalid input payload is strictly rejected with HTTP 400")
    void testWorkflowTriggerSchemaValidationRejection() {
        WorkflowDefinition schemaDef = WorkflowDefinition.builder("strict-schema-pipeline")
            .name("Strict Schema Pipeline")
            .version(1)
            .inputSchema(Map.of(
                "type", "object",
                "required", List.of("customerId", "amount"),
                "properties", Map.of(
                    "customerId", Map.of("type", "string"),
                    "amount", Map.of("type", "number")
                ),
                "additionalProperties", false
            ))
            .tasks(List.of(
                TaskDefinition.builder("step1").domain("default").build()
            ))
            .build();

        definitionController.registerDefinition(schemaDef);

        // Case 1: Missing required field "amount"
        var missingAmountReq = new WorkflowExecutionController.StartWorkflowRequest(
            "strict-schema-pipeline",
            Map.of("customerId", "CUST-100")
        );
        ResponseEntity<?> resp1 = executionController.startExecution(missingAmountReq, WORKSPACE_ID);
        assertThat(resp1.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp1.getBody()).isInstanceOf(Map.class);
        Map<?, ?> body1 = (Map<?, ?>) resp1.getBody();
        assertThat(body1.get("status")).isEqualTo("FAIL");
        assertThat(body1.get("error")).isEqualTo("WORKFLOW_INPUT_VALIDATION_FAILED");

        // Case 2: Type mismatch (customerId passed as number instead of string)
        var typeMismatchReq = new WorkflowExecutionController.StartWorkflowRequest(
            "strict-schema-pipeline",
            Map.of("customerId", 12345, "amount", 50.0)
        );
        ResponseEntity<?> resp2 = executionController.startExecution(typeMismatchReq, WORKSPACE_ID);
        assertThat(resp2.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // Case 3: Undeclared property with additionalProperties: false
        var additionalPropReq = new WorkflowExecutionController.StartWorkflowRequest(
            "strict-schema-pipeline",
            Map.of("customerId", "CUST-100", "amount", 50.0, "unexpectedField", "malicious")
        );
        ResponseEntity<?> resp3 = executionController.startExecution(additionalPropReq, WORKSPACE_ID);
        assertThat(resp3.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
