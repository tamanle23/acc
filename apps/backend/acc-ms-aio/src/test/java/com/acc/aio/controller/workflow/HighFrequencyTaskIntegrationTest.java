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
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class HighFrequencyTaskIntegrationTest {

    private PersistencePort persistencePort;
    private PureDecider pureDecider;
    private WorkflowEngineService engineService;
    private WorkflowDefinitionRegistry registry;
    private ExecutionStreamBroadcaster broadcaster;

    private WorkflowDefinitionController definitionController;
    private WorkflowExecutionController executionController;
    private TaskWorkerController workerController;

    private static final String TENANT_ID = "tenant-hf-35";
    private static final String WORKSPACE_ID = "ws-hf-35";

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
    @DisplayName("Sub-phase 35.1: Workflow executes SET_VARIABLE, INLINE, JSON_JQ_TRANSFORM, and EXCLUSIVE_JOIN natively")
    void testHighFrequencyNativePipeline() {
        // Compose a DAG containing high-frequency system nodes + 1 worker task
        TaskDefinition setVarTask = TaskDefinition.builder("set-defaults")
            .taskType(TaskType.SET_VARIABLE)
            .inputParameters(Map.of("taxRate", 0.10, "baseFee", 50))
            .build();

        TaskDefinition inlineMath = TaskDefinition.builder("compute-total")
            .taskType(TaskType.INLINE)
            .inputParameters(Map.of("expression", "500 * ${workflow.variables.taxRate}"))
            .build();

        TaskDefinition transformJson = TaskDefinition.builder("extract-customer")
            .taskType(TaskType.JSON_JQ_TRANSFORM)
            .inputParameters(Map.of(
                "input", "${workflow.input.profile}",
                "queryExpression", "account.email"
            ))
            .build();

        TaskDefinition workerTask = TaskDefinition.builder("process-payment")
            .taskType(TaskType.SIMPLE)
            .inputParameters(Map.of(
                "amount", "${compute-total.output.result}",
                "recipient", "${extract-customer.output.result}"
            ))
            .build();

        WorkflowDefinition definition = WorkflowDefinition.builder("hf-pipeline-test")
            .name("High Frequency System Tasks Pipeline")
            .version(1)
            .tasks(List.of(setVarTask, inlineMath, transformJson, workerTask))
            .build();

        // 1. Register definition
        definitionController.registerDefinition(definition, TENANT_ID);

        // 2. Start execution
        Map<String, Object> input = Map.of(
            "profile", Map.of("account", Map.of("email", "buyer@enterprise.com", "name", "Acme"))
        );

        var startReq = new WorkflowExecutionController.StartWorkflowRequest("hf-pipeline-test", input);
        ResponseEntity<?> startResponse = executionController.startExecution(
            startReq, TENANT_ID, WORKSPACE_ID
        );

        assertThat(startResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        WorkflowSnapshot initialSnap = (WorkflowSnapshot) startResponse.getBody();
        String workflowId = initialSnap.workflowId();
        assertThat(workflowId).isNotNull();

        // 3. Poll for scheduled worker task
        // Note: set-defaults, compute-total, and extract-customer should all evaluate in-engine instantly!
        // The worker should directly receive process-payment with resolved amounts and recipient email.
        ResponseEntity<List<TaskSnapshot>> pollResponse = workerController.pollTasks(
            "SIMPLE", "default", "worker-node-1", 1, TENANT_ID
        );

        assertThat(pollResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        List<TaskSnapshot> polled = pollResponse.getBody();
        assertThat(polled).hasSize(1);
        TaskSnapshot task = polled.get(0);
        assertThat(task.taskReferenceName()).isEqualTo("process-payment");
        assertThat(task.inputData()).containsEntry("recipient", "buyer@enterprise.com");
        assertThat((Double) task.inputData().get("amount")).isEqualTo(50.0);

        // 4. Complete the worker task
        var resultReq = new TaskWorkerController.TaskResultRequest(
            true, Map.of("receiptId", "REC-8821"), null, 0
        );
        ResponseEntity<?> ackResponse = workerController.reportResult(
            task.taskId(), resultReq, TENANT_ID
        );
        assertThat(ackResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        // 5. Verify workflow execution is now COMPLETED
        ResponseEntity<?> execResponse = executionController.getExecution(workflowId, TENANT_ID);
        assertThat(execResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        WorkflowSnapshot finalSnapshot = (WorkflowSnapshot) execResponse.getBody();
        assertThat(finalSnapshot.status()).isEqualTo(WorkflowStatus.COMPLETED);
    }
}
