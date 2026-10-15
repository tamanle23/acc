package com.unipost.aio.config;

import com.unipost.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.unipost.workflow.adapters.storage.PostgresJdbcPersistenceAdapter;
import com.unipost.workflow.adapters.storage.SqliteJdbcPersistenceAdapter;
import com.unipost.workflow.application.WorkflowEngineService;
import com.unipost.workflow.core.decider.PureDecider;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.ports.PersistencePort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Configuration
@EnableScheduling
public class WorkflowEngineConfiguration {

    private static final Logger log = LoggerFactory.getLogger(WorkflowEngineConfiguration.class);

    @Bean
    @ConditionalOnMissingBean(PersistencePort.class)
    public PersistencePort persistencePort(@Autowired(required = false) DataSource dataSource) {
        if (dataSource != null) {
            try (Connection conn = dataSource.getConnection()) {
                String dbProduct = conn.getMetaData().getDatabaseProductName().toLowerCase();
                log.info("Wiring Workflow PersistencePort for detected DB product: {}", dbProduct);
                if (dbProduct.contains("postgres")) {
                    return new PostgresJdbcPersistenceAdapter(dataSource);
                } else if (dbProduct.contains("sqlite")) {
                    String url = conn.getMetaData().getURL();
                    return new SqliteJdbcPersistenceAdapter(url);
                }
            } catch (Exception e) {
                log.warn("Failed checking DataSource metadata, defaulting to InMemoryPersistenceAdapter: {}", e.getMessage());
            }
        }
        log.info("Wiring default thread-safe InMemoryPersistenceAdapter for workflow engine");
        return new InMemoryPersistenceAdapter();
    }

    @Bean
    @ConditionalOnMissingBean(PureDecider.class)
    public PureDecider pureDecider() {
        return new PureDecider();
    }

    @Bean
    @ConditionalOnMissingBean(WorkflowEngineService.class)
    public WorkflowEngineService workflowEngineService(PersistencePort persistencePort, PureDecider decider) {
        return new WorkflowEngineService(persistencePort, decider);
    }

    @Bean
    public WorkflowDefinitionRegistry workflowDefinitionRegistry() {
        return new WorkflowDefinitionRegistry();
    }

    @Bean
    public ScheduledLeaseSweeper scheduledLeaseSweeper(
        WorkflowEngineService workflowEngineService,
        WorkflowDefinitionRegistry registry
    ) {
        return new ScheduledLeaseSweeper(workflowEngineService, registry);
    }

    /**
     * In-memory / tenant-partitioned registry for WorkflowDefinitions.
     */
    public static class WorkflowDefinitionRegistry {
        private final Map<String, Map<String, WorkflowDefinition>> tenantDefinitions = new ConcurrentHashMap<>();

        public void register(String tenantId, WorkflowDefinition definition) {
            tenantDefinitions.computeIfAbsent(tenantId, t -> new ConcurrentHashMap<>())
                .put(definition.workflowKey(), definition);
        }

        public Optional<WorkflowDefinition> get(String tenantId, String workflowKey) {
            Map<String, WorkflowDefinition> defs = tenantDefinitions.get(tenantId);
            if (defs != null && defs.containsKey(workflowKey)) {
                return Optional.of(defs.get(workflowKey));
            }
            // Fallback to "system" default catalog
            Map<String, WorkflowDefinition> systemDefs = tenantDefinitions.get("system");
            return Optional.ofNullable(systemDefs != null ? systemDefs.get(workflowKey) : null);
        }

        public Map<String, WorkflowDefinition> list(String tenantId) {
            return tenantDefinitions.getOrDefault(tenantId, Map.of());
        }
    }

    /**
     * Periodic background recovery runner sweeping expired task leases.
     */
    public static class ScheduledLeaseSweeper {
        private final WorkflowEngineService engineService;
        private final WorkflowDefinitionRegistry registry;

        public ScheduledLeaseSweeper(WorkflowEngineService engineService, WorkflowDefinitionRegistry registry) {
            this.engineService = engineService;
            this.registry = registry;
        }

        @Scheduled(fixedDelay = 5000)
        public void sweep() {
            long now = System.currentTimeMillis();
            for (Map.Entry<String, Map<String, WorkflowDefinition>> tenantEntry : registry.tenantDefinitions.entrySet()) {
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
}
