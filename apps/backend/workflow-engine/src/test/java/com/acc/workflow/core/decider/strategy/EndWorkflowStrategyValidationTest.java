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

class EndWorkflowStrategyValidationTest {

    private EndWorkflowStrategy strategy;
    private ParameterResolver parameterResolver;

    @BeforeEach
    void setUp() {
        strategy = new EndWorkflowStrategy();
        parameterResolver = new ParameterResolver();
    }

    @Test
    @DisplayName("Should successfully complete workflow when output satisfies outputSchema")
    void testOutputSchemaValidationPass() {
        Map<String, Object> outputSchema = Map.of(
            "type", "object",
            "required", List.of("orderId", "status"),
            "properties", Map.of(
                "orderId", Map.of("type", "string"),
                "status", Map.of("type", "string")
            ),
            "additionalProperties", false
        );

        TaskDefinition endTask = TaskDefinition.builder("end")
            .taskType(TaskType.END_WORKFLOW)
            .inputParameters(Map.of(
                "orderId", "ORD-12345",
                "status", "COMPLETED"
            ))
            .outputSchema(outputSchema)
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf_1", "t1", "w1", "test_key", 1, WorkflowStatus.RUNNING,
            Map.of(), Map.of(), null, Collections.emptyMap()
        );

        NodeEvaluatorStrategy.NodeEvaluationResult result = strategy.evaluate(
            endTask, snapshot, System.currentTimeMillis(), parameterResolver
        );

        assertEquals(TaskStatus.COMPLETED, result.nodeStatus());
        assertFalse(result.shouldHaltProgression());
        assertTrue(result.output().containsKey("orderId"));
        assertEquals("ORD-12345", result.output().get("orderId"));

        // Verify TransitionWorkflow command to COMPLETED
        boolean hasCompletedCmd = result.commands().stream().anyMatch(c ->
            c instanceof EngineCommand.TransitionWorkflow tw && tw.status() == WorkflowStatus.COMPLETED
        );
        assertTrue(hasCompletedCmd, "Should emit TransitionWorkflow to COMPLETED");
    }

    @Test
    @DisplayName("Should strictly isolate resolved output from intermediate snapshot payload when inputParameters is provided")
    void testOutputSchemaValidationExcludesIntermediateSnapshotPayload() {
        Map<String, Object> outputSchema = Map.of(
            "type", "object",
            "required", List.of("orderId", "status"),
            "properties", Map.of(
                "orderId", Map.of("type", "string"),
                "status", Map.of("type", "string")
            ),
            "additionalProperties", false
        );

        TaskDefinition endTask = TaskDefinition.builder("end")
            .taskType(TaskType.END_WORKFLOW)
            .inputParameters(Map.of(
                "orderId", "ORD-12345",
                "status", "COMPLETED"
            ))
            .outputSchema(outputSchema)
            .build();

        // Snapshot has accumulated intermediate variables that would fail additionalProperties: false
        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf_1", "t1", "w1", "test_key", 1, WorkflowStatus.RUNNING,
            Map.of("rawInput", "foo"), Map.of("intermediateVar", "bar", "amount", 100.0), null, Collections.emptyMap()
        );

        NodeEvaluatorStrategy.NodeEvaluationResult result = strategy.evaluate(
            endTask, snapshot, System.currentTimeMillis(), parameterResolver
        );

        assertEquals(TaskStatus.COMPLETED, result.nodeStatus());
        assertFalse(result.output().containsKey("intermediateVar"));
        assertFalse(result.output().containsKey("amount"));
        assertEquals("ORD-12345", result.output().get("orderId"));
    }

    @Test
    @DisplayName("Should fail workflow when output violates outputSchema (missing required field)")
    void testOutputSchemaValidationFailMissingRequired() {
        Map<String, Object> outputSchema = Map.of(
            "type", "object",
            "required", List.of("orderId", "status"),
            "properties", Map.of(
                "orderId", Map.of("type", "string"),
                "status", Map.of("type", "string")
            ),
            "additionalProperties", false
        );

        // Missing "status" in inputParameters
        TaskDefinition endTask = TaskDefinition.builder("end")
            .taskType(TaskType.END_WORKFLOW)
            .inputParameters(Map.of(
                "orderId", "ORD-12345"
            ))
            .outputSchema(outputSchema)
            .build();

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf_1", "t1", "w1", "test_key", 1, WorkflowStatus.RUNNING,
            Map.of(), Map.of(), null, Collections.emptyMap()
        );

        NodeEvaluatorStrategy.NodeEvaluationResult result = strategy.evaluate(
            endTask, snapshot, System.currentTimeMillis(), parameterResolver
        );

        assertEquals(TaskStatus.FAILED, result.nodeStatus());
        assertTrue(result.shouldHaltProgression());

        // Verify TransitionWorkflow command to FAILED with error message
        boolean hasFailedCmd = result.commands().stream().anyMatch(c ->
            c instanceof EngineCommand.TransitionWorkflow tw
                && tw.status() == WorkflowStatus.FAILED
                && tw.reason() != null
                && tw.reason().contains("Workflow output violates outputSchema")
        );
        assertTrue(hasFailedCmd, "Should emit TransitionWorkflow to FAILED with validation error reason");
    }
}
