package com.acc.aio.config;

import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.adapters.storage.PostgresJdbcPersistenceAdapter;
import com.acc.workflow.adapters.storage.SqliteJdbcPersistenceAdapter;
import com.acc.workflow.application.AuditLedgerService;
import com.acc.workflow.application.WorkflowDefinitionRegistry;
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

import javax.sql.DataSource;
import java.sql.Connection;

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

    @Bean
    @ConditionalOnMissingBean(PureDecider.class)
    public PureDecider pureDecider() {
        return new PureDecider();
    }

    @Bean
    @ConditionalOnMissingBean(AuditLedgerService.class)
    public AuditLedgerService auditLedgerService() {
        return new AuditLedgerService();
    }

    @Bean
    @ConditionalOnMissingBean(WorkflowEngineService.class)
    public WorkflowEngineService workflowEngineService(PersistencePort persistencePort, PureDecider decider) {
        return new WorkflowEngineService(persistencePort, decider);
    }

    @Bean
    @ConditionalOnMissingBean(WorkflowDefinitionRegistry.class)
    public WorkflowDefinitionRegistry workflowDefinitionRegistry(PersistencePort persistencePort) {
        return new WorkflowDefinitionRegistry(persistencePort);
    }
}
