package com.acc.workflow.core.decider;

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

class LowFrequencyTaskStrategiesTest {

    private PureDecider decider;

    @BeforeEach
    void setUp() {
        decider = new PureDecider();
    }

    @Test
    @DisplayName("NOOP: passthrough node resolves parameters and completes immediately")
    void testNoopStrategy() {
        TaskDefinition noopTask = TaskDefinition.builder("join-merge-edge")
            .taskType(TaskType.NOOP)
            .inputParameters(Map.of("note", "Clean graph boundary merge"))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("noop-wf")
            .tasks(List.of(noopTask))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-noop-1", "tenant-1", "ws-1", "noop-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().get(0);
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(updateCmd.output()).containsEntry("note", "Clean graph boundary merge");
    }

    @Test
    @DisplayName("JDBC: schedules SQL operation to system:jdbc queue with zero network I/O")
    void testJdbcStrategy() {
        TaskDefinition jdbcTask = TaskDefinition.builder("update-ledger")
            .taskType(TaskType.JDBC)
            .inputParameters(Map.of(
                "sql", "UPDATE orders SET status = 'PROCESSING' WHERE order_id = 'ORD-123'"
            ))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("jdbc-wf")
            .tasks(List.of(jdbcTask))
            .build();

        // 1. Initial pass schedules task
        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-jdbc-1", "tenant-1", "ws-1", "jdbc-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result1 = decider.decide(def, snapshot, 1000L);

        assertThat(result1.commands()).hasSize(1);
        EngineCommand.ScheduleTask scheduleCmd = (EngineCommand.ScheduleTask) result1.commands().get(0);
        assertThat(scheduleCmd.domain()).isEqualTo("system:jdbc");
        assertThat(scheduleCmd.taskType()).isEqualTo("JDBC");
        assertThat(scheduleCmd.input()).containsEntry("sql", "UPDATE orders SET status = 'PROCESSING' WHERE order_id = 'ORD-123'");

        // 2. Second pass completes workflow
        TaskSnapshot completedJdbc = new TaskSnapshot(
            "wf-jdbc-1_update-ledger_att1", "update-ledger", TaskType.JDBC, "system:jdbc",
            TaskStatus.COMPLETED, 1, scheduleCmd.input(), Map.of("status", "SUCCESS", "rowsAffected", 1),
            null, 1000L, 0L, null
        );
        WorkflowSnapshot snap2 = new WorkflowSnapshot(
            "wf-jdbc-1", "tenant-1", "ws-1", "jdbc-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Map.of("update-ledger", completedJdbc)
        );

        DecisionResult result2 = decider.decide(def, snap2, 2000L);
        assertThat(result2.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        assertThat(result2.outputPayload()).containsEntry("rowsAffected", 1);
    }

    @Test
    @DisplayName("KAFKA_PUBLISH: schedules message publish to system:kafka queue")
    void testKafkaPublishStrategy() {
        TaskDefinition kafkaTask = TaskDefinition.builder("publish-kafka-event")
            .taskType(TaskType.KAFKA_PUBLISH)
            .inputParameters(Map.of(
                "topic", "acc.events.fulfillment",
                "key", "ORD-123",
                "value", Map.of("status", "SHIPPED")
            ))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("kafka-wf")
            .tasks(List.of(kafkaTask))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-kafka-1", "tenant-1", "ws-1", "kafka-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result1 = decider.decide(def, snapshot, 1000L);

        assertThat(result1.commands()).hasSize(1);
        EngineCommand.ScheduleTask scheduleCmd = (EngineCommand.ScheduleTask) result1.commands().get(0);
        assertThat(scheduleCmd.domain()).isEqualTo("system:kafka");
        assertThat(scheduleCmd.taskType()).isEqualTo("KAFKA_PUBLISH");
        assertThat(scheduleCmd.input()).containsEntry("topic", "acc.events.fulfillment");

        // Complete when worker finishes
        TaskSnapshot completedKafka = new TaskSnapshot(
            "wf-kafka-1_publish-kafka-event_att1", "publish-kafka-event", TaskType.KAFKA_PUBLISH, "system:kafka",
            TaskStatus.COMPLETED, 1, scheduleCmd.input(), Map.of("topic", "acc.events.fulfillment", "status", "PUBLISHED"),
            null, 1000L, 0L, null
        );
        WorkflowSnapshot snap2 = new WorkflowSnapshot(
            "wf-kafka-1", "tenant-1", "ws-1", "kafka-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Map.of("publish-kafka-event", completedKafka)
        );

        DecisionResult result2 = decider.decide(def, snap2, 2000L);
        assertThat(result2.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        assertThat(result2.outputPayload()).containsEntry("status", "PUBLISHED");
    }

    @Test
    @DisplayName("CALL_MCP_TOOL: schedules tool call to system:mcp queue")
    void testCallMcpToolStrategy() {
        TaskDefinition mcpTask = TaskDefinition.builder("query-inventory-mcp")
            .taskType(TaskType.CALL_MCP_TOOL)
            .inputParameters(Map.of(
                "toolName", "check_sku_availability",
                "arguments", Map.of("sku", "ITEM-7721", "quantity", 5)
            ))
            .build();

        WorkflowDefinition def = WorkflowDefinition.builder("mcp-wf")
            .tasks(List.of(mcpTask))
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-mcp-1", "tenant-1", "ws-1", "mcp-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result1 = decider.decide(def, snapshot, 1000L);

        assertThat(result1.commands()).hasSize(1);
        EngineCommand.ScheduleTask scheduleCmd = (EngineCommand.ScheduleTask) result1.commands().get(0);
        assertThat(scheduleCmd.domain()).isEqualTo("system:mcp");
        assertThat(scheduleCmd.taskType()).isEqualTo("CALL_MCP_TOOL");
        assertThat(scheduleCmd.input()).containsEntry("toolName", "check_sku_availability");

        TaskSnapshot completedMcp = new TaskSnapshot(
            "wf-mcp-1_query-inventory-mcp_att1", "query-inventory-mcp", TaskType.CALL_MCP_TOOL, "system:mcp",
            TaskStatus.COMPLETED, 1, scheduleCmd.input(), Map.of("toolName", "check_sku_availability", "status", "SUCCESS"),
            null, 1000L, 0L, null
        );
        WorkflowSnapshot snap2 = new WorkflowSnapshot(
            "wf-mcp-1", "tenant-1", "ws-1", "mcp-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Map.of("query-inventory-mcp", completedMcp)
        );

        DecisionResult result2 = decider.decide(def, snap2, 2000L);
        assertThat(result2.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        assertThat(result2.outputPayload()).containsEntry("status", "SUCCESS");
    }
}
