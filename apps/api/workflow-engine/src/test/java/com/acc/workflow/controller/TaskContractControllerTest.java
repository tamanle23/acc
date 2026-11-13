package com.acc.workflow.controller;

import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.schema.TaskTypeContract;
import com.acc.workflow.worker.TaskWorkerDescriptor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class TaskContractControllerTest {

    private WorkerRegistry workerRegistry;
    private TaskContractController controller;

    @BeforeEach
    void setUp() {
        workerRegistry = new WorkerRegistry();
        controller = new TaskContractController(workerRegistry);
    }

    @Test
    @DisplayName("Should return all 24 built-in contracts plus dynamic worker contracts")
    void testGetAllContracts() {
        // Register a custom domain worker
        workerRegistry.registerTaskDescriptor(new TaskWorkerDescriptor(
            "customAIPrompter",
            "ai",
            "Specialized enterprise prompt refiner",
            8,
            30L,
            Map.of(
                "type", "object",
                "required", List.of("context"),
                "properties", Map.of("context", Map.of("type", "string"))
            ),
            Map.of(
                "type", "object",
                "properties", Map.of("refinedPrompt", Map.of("type", "string"))
            )
        ));

        ResponseEntity<List<TaskTypeContract>> response = controller.getAllContracts();
        assertEquals(HttpStatus.OK, response.getStatusCode());
        List<TaskTypeContract> contracts = response.getBody();
        assertNotNull(contracts);

        // At least 24 built-in + 1 custom worker
        assertThat(contracts).hasSizeGreaterThanOrEqualTo(25);

        // Verify built-in types exist
        for (TaskType type : TaskType.values()) {
            assertThat(contracts.stream().anyMatch(c -> c.taskType().equals(type.name()))).isTrue();
        }

        // Verify custom worker contract
        TaskTypeContract customContract = contracts.stream()
            .filter(c -> c.taskType().equals("customAIPrompter"))
            .findFirst()
            .orElseThrow();
        assertEquals("WORKER", customContract.category());
        assertEquals("Specialized enterprise prompt refiner", customContract.description());
        assertThat(customContract.inputSchema()).containsKey("properties");
        assertThat(customContract.parameterDescriptors()).isNotEmpty();
    }

    @Test
    @DisplayName("Should get single contract by taskType and return 404 for unknown")
    void testGetSingleContract() {
        // 1. Get built-in HTTP contract
        ResponseEntity<TaskTypeContract> httpResp = controller.getContract("HTTP");
        assertEquals(HttpStatus.OK, httpResp.getStatusCode());
        TaskTypeContract http = httpResp.getBody();
        assertNotNull(http);
        assertEquals("HTTP", http.taskType());
        assertEquals("SYSTEM", http.category());

        // 2. Case-insensitive lookup
        ResponseEntity<TaskTypeContract> lowerResp = controller.getContract("http");
        assertEquals(HttpStatus.OK, lowerResp.getStatusCode());

        // 3. Unknown task type returns 404
        ResponseEntity<TaskTypeContract> notFoundResp = controller.getContract("NON_EXISTENT_TASK_TYPE");
        assertEquals(HttpStatus.NOT_FOUND, notFoundResp.getStatusCode());
    }
}
