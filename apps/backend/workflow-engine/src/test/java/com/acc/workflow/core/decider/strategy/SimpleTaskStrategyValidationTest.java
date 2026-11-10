package com.acc.workflow.core.decider.strategy;

import com.acc.workflow.core.expression.ParameterResolver;
import com.acc.workflow.core.model.EngineCommand;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SimpleTaskStrategyValidationTest {

    private SimpleTaskStrategy strategy;
    private ParameterResolver parameterResolver;

    @BeforeEach
    void setUp() {
        strategy = new SimpleTaskStrategy();
        parameterResolver = new ParameterResolver();
    }

    @Test
    @DisplayName("Should schedule task when resolved input satisfies task inputSchema")
    void testInputSchemaValidationPass() {
        Map<String, Object> inputSchema = Map.of(
            "type", "object",
            "required", List.of("orderId", "amount"),
            "properties", Map.of(
                "orderId", Map.of("type", "string"),
                "amount", Map.of("type", "number")
            ),
            "additionalProperties", false
        );

        TaskDefinition taskDef = TaskDefinition.builder("step1")
            .taskType(TaskType.SIMPLE)
            .inputParameters(Map.of(
                "orderId", "ORD-123",
                "amount", 99.95
            ))
            .inputSchema(inputSchema)
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf_1", "t1", "w1", "test_key", 1, WorkflowStatus.RUNNING,
            Map.of(), Map.of(), null, Collections.emptyMap()
        );

        NodeEvaluatorStrategy.NodeEvaluationResult result = strategy.evaluate(
            taskDef, snapshot, System.currentTimeMillis(), parameterResolver
        );

        assertEquals(TaskStatus.SCHEDULED, result.nodeStatus());
        assertTrue(result.shouldHaltProgression());
        boolean hasScheduleCmd = result.commands().stream().anyMatch(c -> c instanceof EngineCommand.ScheduleTask);
        assertTrue(hasScheduleCmd, "Should emit ScheduleTask command");
    }

    @Test
    @DisplayName("Should fail task and workflow when resolved input violates task inputSchema")
    void testInputSchemaValidationFail() {
        Map<String, Object> inputSchema = Map.of(
            "type", "object",
            "required", List.of("orderId", "amount"),
            "properties", Map.of(
                "orderId", Map.of("type", "string"),
                "amount", Map.of("type", "number")
            ),
            "additionalProperties", false
        );

        // Missing required field "amount"
        TaskDefinition taskDef = TaskDefinition.builder("step1")
            .taskType(TaskType.SIMPLE)
            .inputParameters(Map.of(
                "orderId", "ORD-123"
            ))
            .inputSchema(inputSchema)
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf_1", "t1", "w1", "test_key", 1, WorkflowStatus.RUNNING,
            Map.of(), Map.of(), null, Collections.emptyMap()
        );

        NodeEvaluatorStrategy.NodeEvaluationResult result = strategy.evaluate(
            taskDef, snapshot, System.currentTimeMillis(), parameterResolver
        );

        assertEquals(TaskStatus.FAILED, result.nodeStatus());
        assertTrue(result.shouldHaltProgression());
        boolean hasFailCmd = result.commands().stream().anyMatch(c ->
            c instanceof EngineCommand.UpdateTaskStatus uts && uts.status() == TaskStatus.FAILED
        );
        assertTrue(hasFailCmd, "Should emit UpdateTaskStatus to FAILED");

        boolean hasWorkflowFailCmd = result.commands().stream().anyMatch(c ->
            c instanceof EngineCommand.TransitionWorkflow tw
                && tw.status() == WorkflowStatus.FAILED
                && tw.reason() != null
                && tw.reason().contains("input violates inputSchema")
        );
        assertTrue(hasWorkflowFailCmd, "Should emit TransitionWorkflow to FAILED with validation error");
    }

    @Test
    @DisplayName("Should complete task when existing completed output satisfies task outputSchema")
    void testOutputSchemaValidationPass() {
        Map<String, Object> outputSchema = Map.of(
            "type", "object",
            "required", List.of("resultStatus", "processedCount"),
            "properties", Map.of(
                "resultStatus", Map.of("type", "string"),
                "processedCount", Map.of("type", "number")
            ),
            "additionalProperties", false
        );

        TaskDefinition taskDef = TaskDefinition.builder("step1")
            .taskType(TaskType.SIMPLE)
            .outputSchema(outputSchema)
            .build();

        com.acc.workflow.core.model.TaskSnapshot existingTask = new com.acc.workflow.core.model.TaskSnapshot(
            "wf_1_step1_att1", "step1", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1,
            Map.of(), Map.of("resultStatus", "SUCCESS", "processedCount", 42),
            null, 0L, 30000L, null
        );

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf_1", "t1", "w1", "test_key", 1, WorkflowStatus.RUNNING,
            Map.of(), Map.of(), null, Map.of("step1", existingTask)
        );

        NodeEvaluatorStrategy.NodeEvaluationResult result = strategy.evaluate(
            taskDef, snapshot, System.currentTimeMillis(), parameterResolver
        );

        assertEquals(TaskStatus.COMPLETED, result.nodeStatus());
        assertFalse(result.shouldHaltProgression());
        assertEquals("SUCCESS", result.output().get("resultStatus"));
        assertEquals(42, result.output().get("processedCount"));
    }

    @Test
    @DisplayName("Should fail task and workflow when existing completed output violates task outputSchema")
    void testOutputSchemaValidationFail() {
        Map<String, Object> outputSchema = Map.of(
            "type", "object",
            "required", List.of("resultStatus", "processedCount"),
            "properties", Map.of(
                "resultStatus", Map.of("type", "string"),
                "processedCount", Map.of("type", "number")
            ),
            "additionalProperties", false
        );

        TaskDefinition taskDef = TaskDefinition.builder("step1")
            .taskType(TaskType.SIMPLE)
            .outputSchema(outputSchema)
            .build();

        // Output violates schema: missing "processedCount"
        com.acc.workflow.core.model.TaskSnapshot existingTask = new com.acc.workflow.core.model.TaskSnapshot(
            "wf_1_step1_att1", "step1", TaskType.SIMPLE, "default", TaskStatus.COMPLETED, 1,
            Map.of(), Map.of("resultStatus", "SUCCESS"),
            null, 0L, 30000L, null
        );

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf_1", "t1", "w1", "test_key", 1, WorkflowStatus.RUNNING,
            Map.of(), Map.of(), null, Map.of("step1", existingTask)
        );

        NodeEvaluatorStrategy.NodeEvaluationResult result = strategy.evaluate(
            taskDef, snapshot, System.currentTimeMillis(), parameterResolver
        );

        assertEquals(TaskStatus.FAILED, result.nodeStatus());
        assertTrue(result.shouldHaltProgression());
        boolean hasFailCmd = result.commands().stream().anyMatch(c ->
            c instanceof EngineCommand.UpdateTaskStatus uts && uts.status() == TaskStatus.FAILED
        );
        assertTrue(hasFailCmd, "Should emit UpdateTaskStatus to FAILED");

        boolean hasWorkflowFailCmd = result.commands().stream().anyMatch(c ->
            c instanceof EngineCommand.TransitionWorkflow tw
                && tw.status() == WorkflowStatus.FAILED
                && tw.reason() != null
                && tw.reason().contains("output violates outputSchema")
        );
        assertTrue(hasWorkflowFailCmd, "Should emit TransitionWorkflow to FAILED with outputSchema error");
    }
}
