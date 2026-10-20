package com.unipost.aio.controller.workflow;

import com.unipost.aio.config.WorkflowEngineConfiguration.WorkflowDefinitionRegistry;
import com.unipost.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.unipost.workflow.application.WorkflowEngineService;
import com.unipost.workflow.core.decider.PureDecider;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskType;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import com.unipost.workflow.ports.PersistencePort;
import com.unipost.workflow.worker.TaskWorkerDescriptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class WorkflowIteration13ControllersTest {

    private PersistencePort persistencePort;
    private WorkflowEngineService engineService;
    private WorkflowDefinitionRegistry definitionRegistry;
    private ExecutionStreamBroadcaster broadcaster;
    private WorkerRegistry workerRegistry;
    private WorkerFleetController workerFleetController;
    private WorkflowApprovalsController approvalsController;
    private WorkflowExecutionController executionController;
    private SimpleTaskWorkerRegistrar workerRegistrar;

    @BeforeEach
    void setUp() {
        persistencePort = new InMemoryPersistenceAdapter();
        engineService = new WorkflowEngineService(persistencePort, new PureDecider());
        definitionRegistry = new WorkflowDefinitionRegistry(persistencePort);
        broadcaster = new ExecutionStreamBroadcaster();
        workerRegistry = new WorkerRegistry();
        workerFleetController = new WorkerFleetController(workerRegistry);
        approvalsController = new WorkflowApprovalsController(engineService, persistencePort, definitionRegistry, broadcaster);
        executionController = new WorkflowExecutionController(engineService, persistencePort, definitionRegistry, broadcaster, approvalsController);
        workerRegistrar = new SimpleTaskWorkerRegistrar(workerRegistry, persistencePort, engineService, definitionRegistry, broadcaster);
        workerRegistrar.init();
    }

    @Test
    void testWorkerCatalogAndRegistrationEndpoints() {
        ResponseEntity<List<TaskWorkerDescriptor>> catalogRes = workerFleetController.getWorkerCatalog();
        assertEquals(200, catalogRes.getStatusCode().value());
        assertNotNull(catalogRes.getBody());
        assertTrue(catalogRes.getBody().stream().anyMatch(d -> "checkInventory".equals(d.taskName())));

        TaskWorkerDescriptor customWorker = new TaskWorkerDescriptor(
            "calculateCustomsDuty",
            "logistics",
            "Computes HS-code tariff duties",
            16,
            10L,
            Map.of("type", "object"),
            Map.of("type", "object")
        );

        ResponseEntity<?> regRes = workerFleetController.registerWorker(new WorkerFleetController.RegisterWorkerRequest(
            "ts-sdk-worker-01",
            "10.0.1.25",
            "NODEJS_WORKER",
            List.of("logistics"),
            16,
            List.of(customWorker)
        ));
        assertEquals(200, regRes.getStatusCode().value());

        List<TaskWorkerDescriptor> updatedCatalog = workerFleetController.getWorkerCatalog().getBody();
        assertNotNull(updatedCatalog);
        assertTrue(updatedCatalog.stream().anyMatch(d -> "calculateCustomsDuty".equals(d.taskName())));
    }

    @Test
    void testHumanApprovalsAndVisualDebuggerControllerEndpoints() {
        WorkflowDefinition def = new WorkflowDefinition(
            "order-approval-flow",
            1,
            "Order Approval & Inventory Flow",
            "Tests HUMAN approval and debugger breakpoints",
            60,
            List.of(
                new TaskDefinition(
                    "managerApproval", TaskType.HUMAN, "default", 1, 60, 1, 2.0,
                    Map.of("orderId", "ORD-500"), null, Map.of(), List.of(), List.of(), List.of(), null, List.of()
                ),
                new TaskDefinition(
                    "checkInventory", TaskType.SIMPLE, "default", 1, 15, 1, 2.0,
                    Map.of("orderId", "ORD-500"), null, Map.of(), List.of(), List.of(), List.of(), null, List.of()
                )
            ),
            Map.of()
        );
        definitionRegistry.register("system", def);

        // Start workflow with breakpoint on checkInventory
        ResponseEntity<?> startRes = executionController.startExecution(
            new WorkflowExecutionController.StartWorkflowRequest(
                "order-approval-flow",
                Map.of("orderId", "ORD-500"),
                List.of("checkInventory")
            ),
            "system",
            "default"
        );
        assertEquals(201, startRes.getStatusCode().value());
        WorkflowSnapshot started = (WorkflowSnapshot) startRes.getBody();
        assertNotNull(started);

        // Verify approval task was registered in WorkflowApprovalsController
        List<WorkflowApprovalsController.ApprovalTaskDto> pendingApprovals = approvalsController.listApprovals("PENDING", "system").getBody();
        assertNotNull(pendingApprovals);
        String approvalTaskId = started.workflowId() + "_managerApproval";
        assertTrue(pendingApprovals.stream().anyMatch(a -> approvalTaskId.equals(a.id())));

        // Resolve the HUMAN approval task -> should advance and pause at checkInventory breakpoint!
        ResponseEntity<?> resolveRes = approvalsController.resolveApproval(
            approvalTaskId,
            new WorkflowApprovalsController.ResolveApprovalRequest("APPROVED", "Looks good", "director@unipost.io"),
            "system"
        );
        assertEquals(200, resolveRes.getStatusCode().value());

        WorkflowSnapshot pausedAtBp = (WorkflowSnapshot) executionController.getExecution(started.workflowId(), "system").getBody();
        assertNotNull(pausedAtBp);
        assertEquals(WorkflowStatus.PAUSED_AT_BREAKPOINT, pausedAtBp.status());

        // Step over checkInventory
        ResponseEntity<?> stepRes = executionController.stepOverExecution(started.workflowId(), "system");
        assertEquals(200, stepRes.getStatusCode().value());
        WorkflowSnapshot stepped = (WorkflowSnapshot) stepRes.getBody();
        assertNotNull(stepped);
        assertEquals(WorkflowStatus.RUNNING, stepped.status());

        workerRegistrar.destroy();
    }
}
