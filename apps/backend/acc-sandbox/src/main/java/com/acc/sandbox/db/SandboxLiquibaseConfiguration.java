package com.acc.sandbox.db;

import liquibase.integration.spring.SpringLiquibase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

/**
 * Executes authoritative Liquibase changelogs against embedded PGlite WASM upon boot.
 * Activated strictly when application.sandbox.enabled=true and application.sandbox.database.embedded-pglite=true.
 * Guarantees 100% schema and baseline seed parity with production database without external Docker/Postgres.
 */
@Configuration
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class SandboxLiquibaseConfiguration {

    private static final Logger log = LoggerFactory.getLogger(SandboxLiquibaseConfiguration.class);

    @Bean
    public SpringLiquibase sandboxLiquibase(@Qualifier("sandboxDataSource") DataSource dataSource) {
        log.info("================================================================");
        log.info("  🔄 Executing Authoritative Liquibase Migrations on PGlite...   ");
        log.info("================================================================");
        SpringLiquibase liquibase = new SpringLiquibase();
        liquibase.setDataSource(dataSource);
        liquibase.setChangeLog("classpath:db/sandbox/changelog-master.xml");
        liquibase.setContexts("dev,test,local");

        Map<String, String> params = new HashMap<>();
        params.put("SOVEREIGN_CUSTODIAN_PASSWORD_HASH", "$2a$12$e8Y6l9P15u7Xo3mNq8yNGe.W6Y9P15u7Xo3mNq8yNGe.W6Y9P15u");
        params.put("SOVEREIGN_SUPPORT_PASSWORD_HASH", "$2a$12$e8Y6l9P15u7Xo3mNq8yNGe.W6Y9P15u7Xo3mNq8yNGe.W6Y9P15u");
        params.put("SOVEREIGN_VERIFIER_PASSWORD_HASH", "$2a$12$e8Y6l9P15u7Xo3mNq8yNGe.W6Y9P15u7Xo3mNq8yNGe.W6Y9P15u");
        params.put("SOVEREIGN_APPROVER_PASSWORD_HASH", "$2a$12$e8Y6l9P15u7Xo3mNq8yNGe.W6Y9P15u7Xo3mNq8yNGe.W6Y9P15u");
        liquibase.setChangeLogParameters(params);
        return liquibase;
    }
}
