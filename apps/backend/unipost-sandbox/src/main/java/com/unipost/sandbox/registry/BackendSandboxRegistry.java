package com.unipost.sandbox.registry;

import com.unipost.sandbox.spi.ExternalServiceSimulator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Thread-safe registry that discovers and manages all active ExternalServiceSimulator beans.
 */
@Component
public class BackendSandboxRegistry {

    private static final Logger log = LoggerFactory.getLogger(BackendSandboxRegistry.class);

    private final Map<String, ExternalServiceSimulator> simulators = new ConcurrentHashMap<>();

    public BackendSandboxRegistry(List<ExternalServiceSimulator> discoveredSimulators) {
        if (discoveredSimulators != null) {
            for (ExternalServiceSimulator sim : discoveredSimulators) {
                register(sim);
            }
        }
        log.info("BackendSandboxRegistry initialized with {} simulators: {}", simulators.size(), simulators.keySet());
    }

    public void register(ExternalServiceSimulator simulator) {
        simulators.put(simulator.getId(), simulator);
        log.debug("Registered sandbox simulator: {} ({})", simulator.getName(), simulator.getId());
    }

    public Optional<ExternalServiceSimulator> getSimulator(String id) {
        return Optional.ofNullable(simulators.get(id));
    }

    public Collection<ExternalServiceSimulator> getAllSimulators() {
        return Collections.unmodifiableCollection(simulators.values());
    }

    /**
     * Resets all registered simulators.
     */
    public void resetAll() {
        log.info("Resetting all {} sandbox simulators...", simulators.size());
        for (ExternalServiceSimulator sim : simulators.values()) {
            try {
                sim.reset();
            } catch (Exception e) {
                log.error("Failed to reset simulator: " + sim.getId(), e);
            }
        }
    }

    /**
     * Aggregates diagnostics across all active simulators.
     */
    public Map<String, Object> getAggregatedDiagnostics() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("activeSimulatorsCount", simulators.size());
        Map<String, Object> details = new LinkedHashMap<>();
        for (ExternalServiceSimulator sim : simulators.values()) {
            details.put(sim.getId(), Map.of(
                    "name", sim.getName(),
                    "diagnostics", sim.getDiagnostics()
            ));
        }
        result.put("simulators", details);
        return result;
    }
}
