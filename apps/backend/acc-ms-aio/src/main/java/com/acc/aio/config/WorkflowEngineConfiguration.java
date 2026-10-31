package com.acc.aio.config;

import com.acc.aio.worker.PostgresNotificationListener;
import com.acc.aio.worker.SystemTaskWorkerPool;
import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.adapters.storage.PostgresJdbcPersistenceAdapter;
import com.acc.workflow.adapters.storage.SqliteJdbcPersistenceAdapter;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.decider.PureDecider;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.ports.PersistencePort;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import com.acc.workflow.core.model.WorkflowDefinitionRecord;
import com.acc.workflow.core.model.WorkflowVersionStatus;

@Configuration
@EnableScheduling
public class WorkflowEngineConfiguration {

    private static final Logger log = LoggerFactory.getLogger(WorkflowEngineConfiguration.class);

    @Value("${spring.datasource.url:jdbc:postgresql://localhost:54329/postgres}")
    private String dbUrl;

    @Value("${spring.datasource.username:postgres}")
    private String dbUser;

    @Value("${spring.datasource.password:postgres}")
    private String dbPassword;

    @Bean(name = "workflowDataSource")
    @ConditionalOnMissingBean(name = "workflowDataSource")
    public DataSource workflowDataSource(@Autowired(required = false) DataSource primaryDataSource) {
        String effectiveUrl = dbUrl;
        String effectiveUser = dbUser;
        String effectivePass = dbPassword;

        if (primaryDataSource instanceof HikariDataSource hikariPrimary && hikariPrimary.getJdbcUrl() != null) {
            effectiveUrl = hikariPrimary.getJdbcUrl();
            if (hikariPrimary.getUsername() != null) {
                effectiveUser = hikariPrimary.getUsername();
            }
            if (hikariPrimary.getPassword() != null) {
                effectivePass = hikariPrimary.getPassword();
            }
        }

        if (effectiveUrl != null && effectiveUrl.startsWith("jdbc:postgresql:")) {
            try {
                HikariConfig config = new HikariConfig();
                config.setJdbcUrl(effectiveUrl);
                config.setUsername(effectiveUser);
                config.setPassword(effectivePass);
                config.setPoolName("HikariPool-WorkflowEngine");
                config.setMinimumIdle(2);
                config.setMaximumPoolSize(4);
                config.setConnectionTimeout(15000);
                log.info("Provisioning isolated workflow connection pool 'HikariPool-WorkflowEngine' (min=2, max=4) for {}", effectiveUrl);
                return new HikariDataSource(config);
            } catch (Exception e) {
                log.warn("Could not initialize dedicated HikariPool-WorkflowEngine, falling back to primary DataSource: {}", e.getMessage());
            }
        }
        return primaryDataSource;
    }

    @Bean
    @ConditionalOnMissingBean(PersistencePort.class)
    @SuppressWarnings("deprecation")
    public PersistencePort persistencePort(
        @Autowired(required = false) @Qualifier("workflowDataSource") DataSource workflowDataSource,
        @Autowired(required = false) DataSource primaryDataSource
    ) {
        DataSource targetDs = workflowDataSource != null ? workflowDataSource : primaryDataSource;
        if (targetDs != null) {
            DataSource proxyDataSource = (targetDs instanceof org.springframework.jdbc.datasource.TransactionAwareDataSourceProxy)
                ? targetDs
                : new org.springframework.jdbc.datasource.TransactionAwareDataSourceProxy(targetDs);
            try (Connection conn = proxyDataSource.getConnection()) {
                String dbProduct = conn.getMetaData().getDatabaseProductName().toLowerCase();
                log.info("Wiring Workflow PersistencePort for detected DB product: {}", dbProduct);
                if (dbProduct.contains("postgres")) {
                    return new PostgresJdbcPersistenceAdapter(proxyDataSource);
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

    @Bean(initMethod = "start", destroyMethod = "stop")
    @ConditionalOnMissingBean(PostgresNotificationListener.class)
    public PostgresNotificationListener postgresNotificationListener(
        SystemTaskWorkerPool workerPool,
        @Autowired(required = false) @Qualifier("workflowDataSource") DataSource workflowDataSource
    ) {
        String effectiveUrl = dbUrl;
        String effectiveUser = dbUser;
        String effectivePass = dbPassword;
        if (workflowDataSource instanceof HikariDataSource hikariDs && hikariDs.getJdbcUrl() != null) {
            effectiveUrl = hikariDs.getJdbcUrl();
            if (hikariDs.getUsername() != null) {
                effectiveUser = hikariDs.getUsername();
            }
            if (hikariDs.getPassword() != null) {
                effectivePass = hikariDs.getPassword();
            }
        }
        return new PostgresNotificationListener(effectiveUrl, effectiveUser, effectivePass, workerPool);
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
    public WorkflowDefinitionRegistry workflowDefinitionRegistry(PersistencePort persistencePort) {
        return new WorkflowDefinitionRegistry(persistencePort);
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
        private final PersistencePort persistencePort;

        public WorkflowDefinitionRegistry() {
            this(null);
        }

        public WorkflowDefinitionRegistry(PersistencePort persistencePort) {
            this.persistencePort = persistencePort;
        }

        public PersistencePort persistencePort() {
            return this.persistencePort;
        }

        public void register(String tenantId, WorkflowDefinition definition) {
            tenantDefinitions.computeIfAbsent(tenantId, t -> new ConcurrentHashMap<>())
                .put(definition.workflowKey(), definition);

            if (persistencePort != null) {
                String defId = tenantId + "_" + definition.workflowKey() + "_v" + definition.version();
                long now = System.currentTimeMillis();
                persistencePort.saveDefinitionVersion(new com.acc.workflow.core.model.WorkflowDefinitionRecord(
                    defId, tenantId, definition.workflowKey(), definition.version(),
                    com.acc.workflow.core.model.WorkflowVersionStatus.ACTIVE,
                    definition.name(), definition.description(), definition,
                    now, "SYSTEM", now, now
                ));
            }
        }

        public Optional<WorkflowDefinition> get(String tenantId, String workflowKey) {
            Map<String, WorkflowDefinition> defs = tenantDefinitions.get(tenantId);
            if (defs != null && defs.containsKey(workflowKey)) {
                return Optional.of(defs.get(workflowKey));
            }
            // Check persistencePort
            if (persistencePort != null) {
                List<com.acc.workflow.core.model.WorkflowDefinitionRecord> list = persistencePort.listDefinitionVersions(tenantId, workflowKey);
                if (!list.isEmpty()) {
                    return Optional.of(list.get(list.size() - 1).definition());
                }
            }
            // Fallback to "system" default catalog
            Map<String, WorkflowDefinition> systemDefs = tenantDefinitions.get("system");
            return Optional.ofNullable(systemDefs != null ? systemDefs.get(workflowKey) : null);
        }

        public Optional<com.acc.workflow.core.model.WorkflowDefinitionRecord> getVersion(String tenantId, String workflowKey, int version) {
            if (persistencePort != null) {
                return persistencePort.getDefinitionVersion(tenantId, workflowKey, version);
            }
            return get(tenantId, workflowKey).map(def -> new com.acc.workflow.core.model.WorkflowDefinitionRecord(
                tenantId + "_" + workflowKey + "_v" + version, tenantId, workflowKey, version,
                com.acc.workflow.core.model.WorkflowVersionStatus.ACTIVE,
                def.name(), def.description(), def, System.currentTimeMillis(), "SYSTEM", System.currentTimeMillis(), System.currentTimeMillis()
            ));
        }

        public List<com.acc.workflow.core.model.WorkflowDefinitionRecord> listVersions(String tenantId, String workflowKey) {
            if (persistencePort != null) {
                return persistencePort.listDefinitionVersions(tenantId, workflowKey);
            }
            Optional<WorkflowDefinition> defOpt = get(tenantId, workflowKey);
            return defOpt.map(def -> List.of(new com.acc.workflow.core.model.WorkflowDefinitionRecord(
                tenantId + "_" + workflowKey + "_v" + def.version(), tenantId, workflowKey, def.version(),
                com.acc.workflow.core.model.WorkflowVersionStatus.ACTIVE,
                def.name(), def.description(), def, System.currentTimeMillis(), "SYSTEM", System.currentTimeMillis(), System.currentTimeMillis()
            ))).orElse(List.of());
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
