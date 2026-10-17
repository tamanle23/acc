package com.unipost.sandbox.registry;

import com.unipost.sandbox.spi.ExternalServiceSimulator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class BackendSandboxRegistryTest {

    private BackendSandboxRegistry registry;
    private MockSimulator simulatorA;
    private MockSimulator simulatorB;

    static class MockSimulator implements ExternalServiceSimulator {
        private final String id;
        private final String name;
        private boolean resetCalled = false;

        MockSimulator(String id, String name) {
            this.id = id;
            this.name = name;
        }

        @Override
        public String getId() {
            return id;
        }

        @Override
        public String getName() {
            return name;
        }

        @Override
        public void reset() {
            this.resetCalled = true;
        }

        @Override
        public Map<String, Object> getDiagnostics() {
            return Map.of("id", id, "status", "OK");
        }
    }

    @BeforeEach
    void setUp() {
        simulatorA = new MockSimulator("sim-a", "Simulator Alpha");
        simulatorB = new MockSimulator("sim-b", "Simulator Beta");
        registry = new BackendSandboxRegistry(List.of(simulatorA, simulatorB));
    }

    @Test
    @DisplayName("Should auto-register and retrieve simulators by id")
    void shouldRegisterAndRetrieveSimulators() {
        assertEquals(2, registry.getAllSimulators().size());

        Optional<ExternalServiceSimulator> foundA = registry.getSimulator("sim-a");
        assertTrue(foundA.isPresent());
        assertEquals("Simulator Alpha", foundA.get().getName());

        Optional<ExternalServiceSimulator> foundNone = registry.getSimulator("unknown");
        assertTrue(foundNone.isEmpty());
    }

    @Test
    @DisplayName("Should invoke reset on all registered simulators during resetAll")
    void shouldResetAllSimulators() {
        assertFalse(simulatorA.resetCalled);
        assertFalse(simulatorB.resetCalled);

        registry.resetAll();

        assertTrue(simulatorA.resetCalled);
        assertTrue(simulatorB.resetCalled);
    }

    @Test
    @DisplayName("Should aggregate diagnostics from all active simulators")
    void shouldAggregateDiagnostics() {
        Map<String, Object> diag = registry.getAggregatedDiagnostics();
        assertNotNull(diag);
        assertEquals(2, diag.get("activeSimulatorsCount"));

        @SuppressWarnings("unchecked")
        Map<String, Object> sims = (Map<String, Object>) diag.get("simulators");
        assertTrue(sims.containsKey("sim-a"));
        assertTrue(sims.containsKey("sim-b"));
    }
}
