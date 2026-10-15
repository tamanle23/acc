package com.unipost.workflow.core.decider;

import com.unipost.workflow.core.model.DecisionResult;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
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
    @DisplayName("JDBC: executes SQL operation directly on engine and returns execution status")
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

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-jdbc-1", "tenant-1", "ws-1", "jdbc-wf", 1,
            WorkflowStatus.RUNNING, Collections.emptyMap(), Collections.emptyMap(),
            Collections.emptyMap(), null, Collections.emptyMap()
        );

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().get(0);
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(updateCmd.output()).containsEntry("status", "SUCCESS");
        assertThat(updateCmd.output()).containsEntry("rowsAffected", 1);
    }

    @Test
    @DisplayName("KAFKA_PUBLISH: publishes record to target Kafka topic with partition and offset")
    void testKafkaPublishStrategy() {
        TaskDefinition kafkaTask = TaskDefinition.builder("publish-kafka-event")
            .taskType(TaskType.KAFKA_PUBLISH)
            .inputParameters(Map.of(
                "topic", "unipost.events.fulfillment",
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

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().get(0);
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(updateCmd.output()).containsEntry("topic", "unipost.events.fulfillment");
        assertThat(updateCmd.output()).containsEntry("status", "PUBLISHED");
    }

    @Test
    @DisplayName("CALL_MCP_TOOL: invokes external Model Context Protocol tool with arguments")
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

        DecisionResult result = decider.decide(def, snapshot, 1000L);

        assertThat(result.workflowStatus()).isEqualTo(WorkflowStatus.COMPLETED);
        EngineCommand.UpdateTaskStatus updateCmd = (EngineCommand.UpdateTaskStatus) result.commands().get(0);
        assertThat(updateCmd.status()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(updateCmd.output()).containsEntry("toolName", "check_sku_availability");
        assertThat(updateCmd.output()).containsEntry("status", "SUCCESS");
    }
}
