package com.unipost.workflow.core.decider;

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

class MediumFrequencyTaskStrategiesTest {

    private PureDecider decider;

    @BeforeEach
    void setUp() {
        decider = new PureDecider();
    }

    @Test
    @DisplayName("TERMINATE: halts progression and terminates workflow immediately with specified status and reason")
    void testTerminateStrategy() {
        TaskDefinition step1 = TaskDefinition.builder("step1")
            .taskType(TaskType.SET_VARIABLE)
            .inputParameters(Map.of("riskScore", 95))
            .build();

        TaskDefinition terminateTask = TaskDefinition.builder("halt-on-high-risk")
            .taskType(TaskType.TERMINATE)
            .inputParameters(Map.of(
                "terminationStatus", "FAILED",
                "terminationReason", "High risk score detected: 95"
            ))
            .build();

        TaskDefinition step3 = TaskDefinition.builder("step3-never-reached")
            .taskType(TaskType.SIMPLE)
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("terminate-wf")
            .tasks(List.of(step1, terminateTask, step3))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-term-1", "tenant-1", "ws-1", "terminate-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        // Workflow must immediately fail with the given reason
        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.FAILED);
        assertThat(result.failureReason()).contains("High risk score detected: 95");

        // Step 3 must NOT have been scheduled
        boolean step3Scheduled = result.commands().stream()
            .anyMatch(c -> c instanceof EngineCommand.ScheduleTask st && "step3-never-reached".equals(st.referenceName()));
        assertThat(step3Scheduled).isFalse();
    }

    @Test
    @DisplayName("SUB_WORKFLOW: schedules sub-routine child workflow and completes upon child completion")
    void testSubWorkflowStrategy() {
        TaskDefinition subWfTask = TaskDefinition.builder("call-sub-kyc")
            .taskType(TaskType.SUB_WORKFLOW)
            .inputParameters(Map.of(
                "subWorkflowKey", "kyc-pipeline",
                "customerId", "CUST-100"
            ))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("parent-wf")
            .tasks(List.of(subWfTask))
            .build();

        // 1. Initial pass: schedules SUB_WORKFLOW
        WorkflowSnapshot initialSnap = new WorkflowSnapshot(
            "wf-parent-1", "tenant-1", "ws-1", "parent-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult res1 = decider.decide(def, initialSnap, 1000L);
        assertThat(res1.workflowStatus()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(res1.commands()).hasSize(1);
        EngineCommand.ScheduleTask scheduleCmd = (EngineCommand.ScheduleTask) res1.commands().get(0);
        assertThat(scheduleCmd.referenceName()).isEqualTo("call-sub-kyc");
        assertThat(scheduleCmd.input()).containsEntry("customerId", "CUST-100");
        assertThat(scheduleCmd.input()).containsKey("subWorkflowId");

        // 2. Second pass after child workflow completed externally
        TaskSnapshot completedSub = new TaskSnapshot(
            "sub-t1", "call-sub-kyc", TaskType.SUB_WORKFLOW, "default",
            TaskStatus.COMPLETED, 1, scheduleCmd.input(), Map.of("kycApproved", true),
            null, 1000L, 0L, null
        );

        WorkflowSnapshot snap2 = new WorkflowSnapshot(
            "wf-parent-1", "tenant-1", "ws-1", "parent-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Map.of("call-sub-kyc", completedSub)
        );

        DecisionResult res2 = decider.decide(def, snap2, 2000L);
        assertThat(res2.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        assertThat(res2.outputPayload()).containsEntry("kycApproved", true);
    }

    @Test
    @DisplayName("START_WORKFLOW: triggers asynchronous fire-and-forget workflow without blocking parent")
    void testStartWorkflowStrategy() {
        TaskDefinition startWfTask = TaskDefinition.builder("async-analytics")
            .taskType(TaskType.START_WORKFLOW)
            .inputParameters(Map.of("workflowKey", "log-analytics-wf"))
            .build();

        TaskDefinition nextTask = TaskDefinition.builder("proceed-immediate")
            .taskType(TaskType.SIMPLE)
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("async-parent-wf")
            .tasks(List.of(startWfTask, nextTask))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-async-1", "tenant-1", "ws-1", "async-parent-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        // startWorkflow should complete immediately and schedule nextTask in the very same cycle
        assertThat(result.commands()).hasSize(2);
        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().get(0);
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(updateCmd.output()).containsEntry("status", "TRIGGERED");

        EngineCommand.ScheduleTask scheduleCmd = (EngineCommand.ScheduleTask) result.commands().get(1);
        assertThat(scheduleCmd.referenceName()).isEqualTo("proceed-immediate");
    }

    @Test
    @DisplayName("EVENT: emits event to topic and completes immediately")
    void testEventNodeStrategy() {
        TaskDefinition eventTask = TaskDefinition.builder("publish-order-placed")
            .taskType(TaskType.EVENT)
            .inputParameters(Map.of(
                "eventTopic", "orders.placed",
                "orderId", "ORD-999"
            ))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("event-wf")
            .tasks(List.of(eventTask))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-evt-1", "tenant-1", "ws-1", "event-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().get(0);
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(updateCmd.output()).containsEntry("eventTopic", "orders.placed");
        assertThat(updateCmd.output()).containsEntry("status", "PUBLISHED");
    }

    @Test
    @DisplayName("DYNAMIC: resolves task type dynamically at runtime from upstream variables")
    void testDynamicTaskStrategy() {
        TaskDefinition dynamicTask = TaskDefinition.builder("route-dispatch")
            .taskType(TaskType.DYNAMIC)
            .inputParameters(Map.of(
                "dynamicTaskType", "express-courier-worker",
                "packageWeight", 5.2
            ))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("dynamic-wf")
            .tasks(List.of(dynamicTask))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-dyn-1", "tenant-1", "ws-1", "dynamic-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        assertThat(result.commands()).hasSize(1);
        EngineCommand.ScheduleTask scheduleCmd = (EngineCommand.ScheduleTask) result.commands().get(0);
        assertThat(scheduleCmd.taskType()).isEqualTo("express-courier-worker");
        assertThat(scheduleCmd.input()).containsEntry("packageWeight", 5.2);
    }

    @Test
    @DisplayName("LLM_CHAT_COMPLETE: synthesizes AI response structure with tokens and finishReason")
    void testLlmChatCompleteStrategy() {
        TaskDefinition llmTask = TaskDefinition.builder("summarize-ticket")
            .taskType(TaskType.LLM_CHAT_COMPLETE)
            .inputParameters(Map.of(
                "prompt", "Summarize customer incident for VIP escalation",
                "model", "gemini-1.5-pro"
            ))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("llm-wf")
            .tasks(List.of(llmTask))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-llm-1", "tenant-1", "ws-1", "llm-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().get(0);
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(updateCmd.output()).containsEntry("model", "gemini-1.5-pro");
        assertThat(updateCmd.output()).containsKey("response");
        assertThat(updateCmd.output()).containsEntry("finishReason", "stop");
    }
}
