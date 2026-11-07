package com.acc.aio.worker;

import com.acc.workflow.application.WorkflowDefinitionRegistry;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.model.WorkflowDefinition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Periodic background recovery runner sweeping expired task leases in the worker slice.
 */
@Component
public class ScheduledLeaseSweeper {

    private static final Logger log = LoggerFactory.getLogger(ScheduledLeaseSweeper.class);

    private final WorkflowEngineService engineService;
    private final WorkflowDefinitionRegistry registry;

    public ScheduledLeaseSweeper(WorkflowEngineService engineService, WorkflowDefinitionRegistry registry) {
        this.engineService = engineService;
        this.registry = registry;
    }

    @Scheduled(fixedDelay = 5000)
    public void sweep() {
        long now = System.currentTimeMillis();
        for (Map.Entry<String, Map<String, WorkflowDefinition>> tenantEntry : registry.tenantDefinitions().entrySet()) {
            for (WorkflowDefinition def : tenantEntry.getValue().values()) {
                try {
                    int swept = engineService.sweepExpiredTasks(def, now);
                    if (swept > 0) {
                        log.info("Swept {} expired tasks for definition: {}", swept, def.workflowKey());
                    }
                } catch (Exception e) {
                    log.warn("Error sweeping expired tasks for {}: {}", def.workflowKey(), e.getMessage());
                }
            }
        }
    }
}
