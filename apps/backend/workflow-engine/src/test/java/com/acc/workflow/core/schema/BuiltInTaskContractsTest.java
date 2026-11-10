package com.acc.workflow.core.schema;

import com.acc.workflow.core.model.TaskType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class BuiltInTaskContractsTest {

    @Test
    @DisplayName("Should verify all 24 TaskType values have registered canonical contracts")
    void testAllTaskTypesCovered() {
        Map<String, TaskTypeContract> contracts = BuiltInTaskContracts.getContracts();
        assertEquals(24, contracts.size(), "Should contain contracts for all 24 task types");

        for (TaskType type : TaskType.values()) {
            assertTrue(contracts.containsKey(type.name()), "Missing contract for TaskType: " + type.name());
            TaskTypeContract contract = contracts.get(type.name());
            assertNotNull(contract.taskType());
            assertNotNull(contract.category());
            assertNotNull(contract.description());
            assertNotNull(contract.inputSchema(), "inputSchema must not be null for " + type.name());
            assertNotNull(contract.outputSchema(), "outputSchema must not be null for " + type.name());
            assertNotNull(contract.parameterDescriptors(), "parameterDescriptors must not be null for " + type.name());
        }
    }

    @Test
    @DisplayName("Should verify HTTP contract has expected properties and requirements")
    void testHttpContract() {
        TaskTypeContract http = BuiltInTaskContracts.get("HTTP").orElseThrow();
        assertEquals("SYSTEM", http.category());
        assertTrue(http.inputSchema().containsKey("properties"));
        Map<?, ?> props = (Map<?, ?>) http.inputSchema().get("properties");
        assertTrue(props.containsKey("url"));
        assertTrue(props.containsKey("method"));
        assertTrue(props.containsKey("headers"));
        assertTrue(props.containsKey("body"));
    }
}
