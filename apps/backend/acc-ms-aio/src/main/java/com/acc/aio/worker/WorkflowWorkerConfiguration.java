package com.acc.aio.worker;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

/**
 * Autonomously wires worker slice beans without creating reverse dependencies from config.
 */
@Configuration
public class WorkflowWorkerConfiguration {

    @Value("${spring.datasource.url:jdbc:postgresql://localhost:54329/postgres}")
    private String dbUrl;

    @Value("${spring.datasource.username:postgres}")
    private String dbUser;

    @Value("${spring.datasource.password:postgres}")
    private String dbPassword;

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
}
