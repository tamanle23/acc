package com.unipost.workflow.worker;

import com.unipost.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.unipost.workflow.adapters.transport.InProcessTransportAdapter;
import com.unipost.workflow.application.WorkflowEngineService;
import com.unipost.workflow.core.decider.PureDecider;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.TaskType;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SimpleTaskWorkerSdkAndDebuggerTest {

    @Test
    void testHumanNodePersistenceAndApprovalResolution() {
        InMemoryPersistenceAdapter persistence = new InMemoryPersistenceAdapter();
        WorkflowEngineService engine = new WorkflowEngineService(persistence, new PureDecider());

        WorkflowDefinition def = WorkflowDefinition.builder("order-approval-flow")
            .version(1)
            .addTask(TaskDefinition.builder("managerApproval")
                .taskType(TaskType.HUMAN)
                .inputParameters(Map.of("orderId", "${workflow.input.orderId}"))
                .build())
            .addTask(TaskDefinition.builder("finalizeOrder")
                .taskType(TaskType.SET_VARIABLE)
                .inputParameters(Map.of("orderStatus", "APPROVED_AND_FINALIZED"))
                .build())
            .build();

        long now = System.currentTimeMillis();
        WorkflowSnapshot started = engine.startWorkflow(
            "wf_exec_approval_01", "tenant-acme", "default", def,
            Map.of("orderId", "ORD-500"), now
        );

        assertEquals(WorkflowStatus.RUNNING, started.status());
        TaskSnapshot approvalTask = started.tasksByRef().get("managerApproval");
        assertNotNull(approvalTask, "HUMAN task must be persisted via upsert on first encounter");
        assertEquals(TaskStatus.WAITING_FOR_APPROVAL, approvalTask.status());
        assertEquals("wf_exec_approval_01", approvalTask.workflowId());

        // Resolve human approval
        WorkflowSnapshot resolved = engine.resolveHumanApprovalTask(
            "wf_exec_approval_01", "managerApproval", true, "alice@acme.com",
            "Verified budget allocation", def, now + 1000
        ).orElseThrow();

        assertEquals(WorkflowStatus.COMPLETED, resolved.status());
        assertEquals(TaskStatus.COMPLETED, resolved.tasksByRef().get("managerApproval").status());
        assertEquals(TaskStatus.COMPLETED, resolved.tasksByRef().get("finalizeOrder").status());
    }

    @Test
    void testWorkerHostTaskNameRoutingWithUnderscoreWorkflowId() throws Exception {
        InMemoryPersistenceAdapter persistence = new InMemoryPersistenceAdapter();
        WorkflowEngineService engine = new WorkflowEngineService(persistence, new PureDecider());

        WorkflowDefinition def = WorkflowDefinition.builder("fulfillment-flow")
            .version(1)
            .addTask(TaskDefinition.builder("checkInventory")
                .taskType(TaskType.SIMPLE)
                .domain("inventory")
                .inputParameters(Map.of("sku", "${workflow.input.sku}"))
                .build())
            .addTask(TaskDefinition.builder("shipPackage")
                .taskType(TaskType.SIMPLE)
                .domain("shipping")
                .inputParameters(Map.of("reservationId", "${checkInventory.output.reservationId}"))
                .build())
            .build();

        InProcessTransportAdapter transport = new InProcessTransportAdapter(persistence, engine, def, 30000L);
        try (WorkerHost host = new WorkerHost(transport, "worker-fleet-01")) {
            host.registerSimple("checkInventory", "inventory", ctx -> {
                assertEquals("wf_exec_underscore_99", ctx.workflowId());
                return Map.of("inStock", true, "reservationId", "RES-777");
            });
            host.registerSimple("shipPackage", "shipping", ctx -> {
                assertEquals("RES-777", ctx.input().get("reservationId"));
                return Map.of("trackingCode", "TRK-888");
            });

            assertEquals(2, host.getRegisteredDescriptors().size());

            long now = System.currentTimeMillis();
            engine.startWorkflow(
                "wf_exec_underscore_99", "system", "default", def,
                Map.of("sku", "SKU-LAPTOP"), now
            );

            host.start();

            // Wait up to 2s for virtual thread workers to complete both sequential tasks
            long deadline = System.currentTimeMillis() + 2500L;
            WorkflowSnapshot finalSnap = null;
            while (System.currentTimeMillis() < deadline) {
                finalSnap = persistence.getWorkflowSnapshot("wf_exec_underscore_99").orElseThrow();
                if (finalSnap.status() == WorkflowStatus.COMPLETED) {
                    break;
                }
                Thread.sleep(30);
            }

            assertNotNull(finalSnap);
            assertEquals(WorkflowStatus.COMPLETED, finalSnap.status());
            assertEquals("TRK-888", finalSnap.tasksByRef().get("shipPackage").outputData().get("trackingCode"));
        }
    }

    @Test
    void testEngineBreakpointsStepOverResumeAndNodeRerun() {
        InMemoryPersistenceAdapter persistence = new InMemoryPersistenceAdapter();
        WorkflowEngineService engine = new WorkflowEngineService(persistence, new PureDecider());

        WorkflowDefinition def = WorkflowDefinition.builder("debug-flow")
            .version(1)
            .addTask(TaskDefinition.builder("stepOne")
                .taskType(TaskType.SET_VARIABLE)
                .inputParameters(Map.of("a", 10))
                .build())
            .addTask(TaskDefinition.builder("stepTwo")
                .taskType(TaskType.SET_VARIABLE)
                .inputParameters(Map.of("b", 20))
                .build())
            .addTask(TaskDefinition.builder("stepThree")
                .taskType(TaskType.SET_VARIABLE)
                .inputParameters(Map.of("c", 30))
                .build())
            .build();

        long now = System.currentTimeMillis();
        // Start with a breakpoint on stepTwo
        WorkflowSnapshot paused = engine.startWorkflow(
            "wf_debug_01", "tenant-acme", "default", def,
            Map.of("__breakpoints", List.of("stepTwo")), now
        );

        assertEquals(WorkflowStatus.PAUSED_AT_BREAKPOINT, paused.status());
        assertTrue(paused.tasksByRef().containsKey("stepOne"), "stepOne before breakpoint should complete");
        assertFalse(paused.tasksByRef().containsKey("stepTwo"), "stepTwo should halt before execution");
        assertEquals("stepTwo", paused.outputPayload().get("pausedAtNode"));

        // Step over stepTwo -> executes stepTwo and pauses at stepThree
        WorkflowSnapshot stepped = engine.stepOverExecution("wf_debug_01", def, now + 500).orElseThrow();
        assertEquals(WorkflowStatus.PAUSED_AT_BREAKPOINT, stepped.status());
        assertTrue(stepped.tasksByRef().containsKey("stepTwo"), "stepTwo should now be executed");
        assertFalse(stepped.tasksByRef().containsKey("stepThree"), "stepThree should now be paused at breakpoint");
        assertEquals("stepThree", stepped.outputPayload().get("pausedAtNode"));

        // Resume execution -> completes stepThree and finishes workflow
        WorkflowSnapshot resumed = engine.resumeExecution("wf_debug_01", def, now + 1000).orElseThrow();
        assertEquals(WorkflowStatus.COMPLETED, resumed.status());
        assertTrue(resumed.tasksByRef().containsKey("stepThree"));

        // Re-run from stepTwo with overridden input parameters
        WorkflowSnapshot rerun = engine.rerunTaskFromNode(
            "wf_debug_01", "stepTwo", Map.of("b", 999), def, now + 1500
        ).orElseThrow();
        assertEquals(WorkflowStatus.RUNNING, rerun.status());
        assertEquals(999, rerun.tasksByRef().get("stepTwo").inputData().get("b"));
    }
}
