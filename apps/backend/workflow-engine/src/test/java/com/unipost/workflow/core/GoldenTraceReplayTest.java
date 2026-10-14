package com.unipost.workflow.core;

import com.unipost.workflow.core.decider.PureDecider;
import com.unipost.workflow.core.model.DecisionResult;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.TaskType;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class GoldenTraceReplayTest {

    private PureDecider decider;

    @BeforeEach
    void setUp() {
        decider = new PureDecider();
    }

    @Test
    @DisplayName("Golden Trace: Complex Order Pipeline Replay produces 100% deterministic decision outputs")
    void testComplexOrderPipelineReplay() {
        // 1. Definition
        WorkflowDefinition def = WorkflowDefinition.builder("ecommerce-fulfillment")
            .version(1)
            .tasks(List.of(
                TaskDefinition.builder("checkInventory")
                    .taskType(TaskType.SIMPLE)
                    .inputParameters(Map.of("sku", "${workflow.input.sku}"))
                    .build(),
                TaskDefinition.builder("routeShipping")
                    .taskType(TaskType.SWITCH)
                    .inputParameters(Map.of("caseExpression", "${workflow.input.speed}"))
                    .decisionCases(Map.of(
                        "EXPRESS", List.of(TaskDefinition.builder("expressCourier").build()),
                        "STANDARD", List.of(TaskDefinition.builder("groundPostal").build())
                    ))
                    .defaultCase(List.of(TaskDefinition.builder("groundPostal").build()))
                    .build(),
                TaskDefinition.builder("notifyCustomer")
                    .taskType(TaskType.SIMPLE)
                    .inputParameters(Map.of("email", "${workflow.input.email}"))
                    .build()
            ))
            .build();

        long startEpoch = 1728900000000L;

        // Step 1: Initial Start
        WorkflowSnapshot s0 = new WorkflowSnapshot(
            "wf_golden_1", "acme", "default", "ecommerce-fulfillment", 1,
            WorkflowStatus.RUNNING,
            Map.of("sku", "SKU_42", "speed", "EXPRESS", "email", "alice@example.com"),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult d0 = decider.decide(def, s0, startEpoch);
        assertThat(d0.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(d0.commands()).hasSize(1);
        EngineCommand.ScheduleTask first = (EngineCommand.ScheduleTask) d0.commands().get(0);
        assertThat(first.referenceName()).isEqualTo("checkInventory");
        assertThat(first.input()).containsEntry("sku", "SKU_42");

        // Step 2: Inventory Completes -> Decider evaluates SWITCH node and schedules expressCourier
        TaskSnapshot inventoryDone = new TaskSnapshot(
            first.taskId(), "checkInventory", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1, first.input(), Map.of("inStock", true), null,
            0L, 30000L, "w1"
        );
        WorkflowSnapshot s1 = new WorkflowSnapshot(
            "wf_golden_1", "acme", "default", "ecommerce-fulfillment", 1,
            WorkflowStatus.RUNNING, s0.inputPayload(), Collections.emptyMap(), null,
            Map.of("checkInventory", inventoryDone)
        );

        DecisionResult d1 = decider.decide(def, s1, startEpoch + 5000L);
        assertThat(d1.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        // Command 1: Update routeShipping to COMPLETED (selectedCase: EXPRESS)
        // Command 2: Schedule expressCourier
        assertThat(d1.commands()).hasSize(2);
        EngineCommand.UpdateTaskStatus switchUpdate = (EngineCommand.UpdateTaskStatus) d1.commands().get(0);
        assertThat(switchUpdate.output()).containsEntry("selectedCase", "EXPRESS");
        EngineCommand.ScheduleTask courierTask = (EngineCommand.ScheduleTask) d1.commands().get(1);
        assertThat(courierTask.referenceName()).isEqualTo("expressCourier");

        // Step 3: Express Courier Completes -> Decider advances to notifyCustomer
        TaskSnapshot switchDone = new TaskSnapshot(
            "wf_golden_1_routeShipping", "routeShipping", TaskType.SWITCH, "default",
            TaskStatus.COMPLETED, 1, Collections.emptyMap(), switchUpdate.output(), null,
            0L, 30000L, null
        );
        TaskSnapshot courierDone = new TaskSnapshot(
            courierTask.taskId(), "expressCourier", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1, courierTask.input(), Map.of("trackingNumber", "TRK_777"), null,
            0L, 30000L, "w2"
        );
        WorkflowSnapshot s2 = new WorkflowSnapshot(
            "wf_golden_1", "acme", "default", "ecommerce-fulfillment", 1,
            WorkflowStatus.RUNNING, s0.inputPayload(), Collections.emptyMap(), null,
            Map.of(
                "checkInventory", inventoryDone,
                "routeShipping", switchDone,
                "expressCourier", courierDone
            )
        );

        DecisionResult d2 = decider.decide(def, s2, startEpoch + 15000L);
        assertThat(d2.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(d2.commands()).hasSize(1);
        EngineCommand.ScheduleTask notifyTask = (EngineCommand.ScheduleTask) d2.commands().get(0);
        assertThat(notifyTask.referenceName()).isEqualTo("notifyCustomer");
        assertThat(notifyTask.input()).containsEntry("email", "alice@example.com");

        // Step 4: Customer notification completes -> Workflow transitions to COMPLETED
        TaskSnapshot notifyDone = new TaskSnapshot(
            notifyTask.taskId(), "notifyCustomer", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1, notifyTask.input(), Map.of("sent", true), null,
            0L, 30000L, "w3"
        );
        WorkflowSnapshot s3 = new WorkflowSnapshot(
            "wf_golden_1", "acme", "default", "ecommerce-fulfillment", 1,
            WorkflowStatus.RUNNING, s0.inputPayload(), Collections.emptyMap(), null,
            Map.of(
                "checkInventory", inventoryDone,
                "routeShipping", switchDone,
                "expressCourier", courierDone,
                "notifyCustomer", notifyDone
            )
        );

        DecisionResult d3 = decider.decide(def, s3, startEpoch + 20000L);
        assertThat(d3.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        assertThat(d3.outputPayload()).containsEntry("sent", true);
    }
}
