package com.acc.workflow.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.acc.workflow.core.decider.PureDecider;
import com.acc.workflow.core.model.DecisionResult;
import com.acc.workflow.core.model.EngineCommand;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PureDeciderTest {

    private PureDecider decider;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        decider = new PureDecider();
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Test
    @DisplayName("Should schedule the first task immediately when workflow starts")
    void shouldScheduleFirstTaskImmediately() {
        WorkflowDefinition def = WorkflowDefinition.builder("order-pipeline")
            .version(1)
            .tasks(List.of(
                TaskDefinition.builder("validate-order")
                    .taskType(TaskType.SIMPLE)
                    .timeoutSeconds(15)
                    .build(),
                TaskDefinition.builder("charge-payment")
                    .taskType(TaskType.SIMPLE)
                    .timeoutSeconds(30)
                    .build()
            ))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-100", "acme-tenant", "default-ws", "order-pipeline", 1,
            WorkflowStatus.RUNNING, Map.of("orderId", "ORD-999"), Collections.emptyMap(),
            null, Collections.emptyMap()
        );

        long nowEpochMs = 1728900000000L;
        DecisionResult result = decider.decide(def, snapshot, nowEpochMs);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(result.commands()).hasSize(1);

        EngineCommand cmd = result.commands().get(0);
        assertThat(cmd).isInstanceOf(EngineCommand.ScheduleTask.class);

        EngineCommand.ScheduleTask schedule = (EngineCommand.ScheduleTask) cmd;
        assertThat(schedule.taskId()).isEqualTo("wf-100_validate-order_att1");
        assertThat(schedule.referenceName()).isEqualTo("validate-order");
        assertThat(schedule.visibleAtEpochMs()).isEqualTo(nowEpochMs);
        assertThat(schedule.responseTimeoutMs()).isEqualTo(15000L);
    }

    @Test
    @DisplayName("Should advance to next task when current task is completed")
    void shouldAdvanceToNextTaskWhenCompleted() {
        WorkflowDefinition def = WorkflowDefinition.builder("order-pipeline")
            .tasks(List.of(
                TaskDefinition.builder("validate-order").build(),
                TaskDefinition.builder("charge-payment").build()
            ))
            .build();

        TaskSnapshot task1 = new TaskSnapshot(
            "wf-100_validate-order_att1", "validate-order", TaskType.SIMPLE,
            "default", TaskStatus.COMPLETED, 1, Map.of("orderId", "ORD-1"),
            Map.of("isValid", true), null, 1000L, 30000L, "worker-1"
        );

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-100", "acme", "default", "order-pipeline", 1,
            WorkflowStatus.RUNNING, Map.of("orderId", "ORD-1"), Collections.emptyMap(),
            null, Map.of("validate-order", task1)
        );

        long nowEpochMs = 1728900010000L;
        DecisionResult result = decider.decide(def, snapshot, nowEpochMs);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(result.commands()).hasSize(1);
        EngineCommand.ScheduleTask schedule = (EngineCommand.ScheduleTask) result.commands().get(0);
        assertThat(schedule.referenceName()).isEqualTo("charge-payment");
        assertThat(schedule.taskId()).isEqualTo("wf-100_charge-payment_att1");
    }

    @Test
    @DisplayName("Should transition workflow to COMPLETED when all tasks are complete")
    void shouldCompleteWorkflowWhenAllTasksComplete() {
        WorkflowDefinition def = WorkflowDefinition.builder("order-pipeline")
            .tasks(List.of(
                TaskDefinition.builder("validate-order").build(),
                TaskDefinition.builder("charge-payment").build()
            ))
            .build();

        TaskSnapshot task1 = new TaskSnapshot(
            "wf-100_task1", "validate-order", TaskType.SIMPLE,
            "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(),
            Map.of("step1", "ok"), null, 1000L, 30000L, "worker-1"
        );
        TaskSnapshot task2 = new TaskSnapshot(
            "wf-100_task2", "charge-payment", TaskType.SIMPLE,
            "default", TaskStatus.COMPLETED, 1, Collections.emptyMap(),
            Map.of("paymentId", "PAY-456"), null, 2000L, 30000L, "worker-2"
        );

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-100", "acme", "default", "order-pipeline", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            null, Map.of("validate-order", task1, "charge-payment", task2)
        );

        long nowEpochMs = 1728900020000L;
        DecisionResult result = decider.decide(def, snapshot, nowEpochMs);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        assertThat(result.commands()).hasSize(1);
        EngineCommand.TransitionWorkflow transition = (EngineCommand.TransitionWorkflow) result.commands().get(0);
        assertThat(transition.status()).isEqualTo(WorkflowStatus.COMPLETED);
        assertThat(result.outputPayload()).containsEntry("step1", "ok");
        assertThat(result.outputPayload()).containsEntry("paymentId", "PAY-456");
    }

    @Test
    @DisplayName("Should retry failed task with exponential backoff if retryCount not exhausted")
    void shouldRetryFailedTaskWithBackoff() {
        WorkflowDefinition def = WorkflowDefinition.builder("order-pipeline")
            .tasks(List.of(
                TaskDefinition.builder("charge-payment")
                    .retryCount(3)
                    .retryDelaySeconds(2)
                    .backoffRate(2.0)
                    .build()
            ))
            .build();

        TaskSnapshot attempt1 = new TaskSnapshot(
            "wf-100_charge-payment_att1", "charge-payment", TaskType.SIMPLE,
            "default", TaskStatus.FAILED, 1, Map.of("amount", 500),
            Collections.emptyMap(), "Gateway Timeout", 1000L, 30000L, "worker-1"
        );

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-100", "acme", "default", "order-pipeline", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            null, Map.of("charge-payment", attempt1)
        );

        long nowEpochMs = 1728900050000L;
        DecisionResult result = decider.decide(def, snapshot, nowEpochMs);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(result.commands()).hasSize(1);

        EngineCommand.ScheduleTask retrySchedule = (EngineCommand.ScheduleTask) result.commands().get(0);
        assertThat(retrySchedule.taskId()).isEqualTo("wf-100_charge-payment_att2");
        assertThat(retrySchedule.attempt()).isEqualTo(2);
        // Backoff: 2s * 2^(1-1) = 2s = 2000ms delay
        assertThat(retrySchedule.visibleAtEpochMs()).isEqualTo(nowEpochMs + 2000L);
    }

    @Test
    @DisplayName("Should transition workflow to FAILED when task retries are permanently exhausted")
    void shouldFailWorkflowWhenRetriesExhausted() {
        WorkflowDefinition def = WorkflowDefinition.builder("order-pipeline")
            .tasks(List.of(
                TaskDefinition.builder("charge-payment")
                    .retryCount(2)
                    .build()
            ))
            .build();

        TaskSnapshot attempt2 = new TaskSnapshot(
            "wf-100_charge-payment_att2", "charge-payment", TaskType.SIMPLE,
            "default", TaskStatus.FAILED, 2, Map.of("amount", 500),
            Collections.emptyMap(), "Insufficient Funds", 1000L, 30000L, "worker-1"
        );

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-100", "acme", "default", "order-pipeline", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            null, Map.of("charge-payment", attempt2)
        );

        long nowEpochMs = 1728900060000L;
        DecisionResult result = decider.decide(def, snapshot, nowEpochMs);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.FAILED);
        assertThat(result.failureReason()).contains("failed permanently after attempt 2: Insufficient Funds");
        assertThat(result.commands()).hasSize(1);
        EngineCommand.TransitionWorkflow transition = (EngineCommand.TransitionWorkflow) result.commands().get(0);
        assertThat(transition.status()).isEqualTo(WorkflowStatus.FAILED);
    }

    @Test
    @DisplayName("Should verify Memento JSON round-trip serialization of WorkflowDefinition")
    void shouldVerifyMementoJsonRoundTrip() throws Exception {
        WorkflowDefinition original = WorkflowDefinition.builder("test-ir")
            .version(2)
            .name("Test Workflow")
            .description("Canonical IR Memento verification")
            .timeoutSeconds(1800)
            .tasks(List.of(
                TaskDefinition.builder("task-a")
                    .taskType(TaskType.SIMPLE)
                    .domain("billing")
                    .timeoutSeconds(60)
                    .retryCount(4)
                    .inputParameters(Map.of("key", "val"))
                    .build()
            ))
            .layoutMetadata(Map.of("task-a", Map.of("x", 120, "y", 250)))
            .build();

        String json = objectMapper.writeValueAsString(original);
        assertThat(json).contains("\"workflowKey\":\"test-ir\"");
        assertThat(json).contains("\"layoutMetadata\"");

        WorkflowDefinition deserialized = objectMapper.readValue(json, WorkflowDefinition.class);
        assertThat(deserialized.workflowKey()).isEqualTo(original.workflowKey());
        assertThat(deserialized.version()).isEqualTo(original.version());
        assertThat(deserialized.tasks()).hasSize(1);
        assertThat(deserialized.tasks().get(0).taskReferenceName()).isEqualTo("task-a");
        assertThat(deserialized.tasks().get(0).domain()).isEqualTo("billing");
        assertThat(deserialized.layoutMetadata()).isNotEmpty();
    }
}
