package com.unipost.workflow.core.expression;

import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.TaskType;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ParameterResolverTest {

    private ParameterResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new ParameterResolver();
    }

    @Test
    @DisplayName("Should resolve top-level workflow input and output expressions")
    void shouldResolveWorkflowInputsAndOutputs() {
        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-123", "tenant-1", "ws-1", "test-pipeline", 1,
            WorkflowStatus.RUNNING,
            Map.of("orderId", "ORD-99", "amount", 1500, "customer", Map.of("email", "john@example.com")),
            Map.of("initialResult", "READY"),
            null,
            Collections.emptyMap()
        );

        Map<String, Object> declaredInputs = Map.of(
            "resolvedOrderId", "${workflow.input.orderId}",
            "resolvedAmount", "${workflow.input.amount}",
            "customerEmail", "${workflow.input.customer.email}",
            "currentStatus", "${workflow.status}",
            "workflowId", "${workflow.id}"
        );

        Map<String, Object> resolved = resolver.resolve(declaredInputs, snapshot);

        assertThat(resolved.get("resolvedOrderId")).isEqualTo("ORD-99");
        assertThat(resolved.get("resolvedAmount")).isEqualTo(1500);
        assertThat(resolved.get("customerEmail")).isEqualTo("john@example.com");
        assertThat(resolved.get("currentStatus")).isEqualTo("RUNNING");
        assertThat(resolved.get("workflowId")).isEqualTo("wf-123");
    }

    @Test
    @DisplayName("Should resolve task outputs and nested array index paths")
    void shouldResolveTaskOutputsAndArrayPaths() {
        TaskSnapshot task1 = new TaskSnapshot(
            "task_1", "fetch-items", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1,
            Collections.emptyMap(),
            Map.of("items", List.of(
                Map.of("sku", "SKU-A", "price", 100),
                Map.of("sku", "SKU-B", "price", 250)
            )),
            null, 1000L, 30000L, "worker-1"
        );

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-123", "tenant-1", "ws-1", "test-pipeline", 1,
            WorkflowStatus.RUNNING,
            Collections.emptyMap(),
            Collections.emptyMap(),
            null,
            Map.of("fetch-items", task1)
        );

        Map<String, Object> declaredInputs = Map.of(
            "firstSku", "${fetch-items.output.items[0].sku}",
            "secondPrice", "${fetch-items.output.items[1].price}",
            "taskStatus", "${fetch-items.status}"
        );

        Map<String, Object> resolved = resolver.resolve(declaredInputs, snapshot);

        assertThat(resolved.get("firstSku")).isEqualTo("SKU-A");
        assertThat(resolved.get("secondPrice")).isEqualTo(250);
        assertThat(resolved.get("taskStatus")).isEqualTo("COMPLETED");
    }

    @Test
    @DisplayName("Should support string interpolation with multiple placeholders")
    void shouldSupportStringInterpolation() {
        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf-123", "tenant-1", "ws-1", "test-pipeline", 1,
            WorkflowStatus.RUNNING,
            Map.of("userId", "USER-42", "tier", "VIP"),
            Collections.emptyMap(),
            null,
            Collections.emptyMap()
        );

        Map<String, Object> declaredInputs = Map.of(
            "headerMessage", "Welcome user ${workflow.input.userId} with tier ${workflow.input.tier}!"
        );

        Map<String, Object> resolved = resolver.resolve(declaredInputs, snapshot);
        assertThat(resolved.get("headerMessage")).isEqualTo("Welcome user USER-42 with tier VIP!");
    }
}
