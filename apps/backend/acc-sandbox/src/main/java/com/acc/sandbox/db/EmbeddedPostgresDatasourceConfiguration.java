package com.acc.sandbox.db;

import com.acc.sandbox.config.SandboxProperties;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.io.File;
import java.io.IOException;

/**
 * Datasource configuration for embedded native PostgreSQL powered by Zonky Embedded Postgres.
 * Activated strictly when application.sandbox.enabled=true.
 * Provides 100% production-parity PostgreSQL engine with native support for:
 * - PL/pgSQL functions and triggers
 * - Partitioned tables (UNIPOST_RECORD_AUDIT_LOG)
 * - Information schema and sequence catalogs
 * - Full HikariCP multi-connection pooling without WASM single-thread constraints
 */
@Configuration
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class EmbeddedPostgresDatasourceConfiguration {

    private static final Logger log = LoggerFactory.getLogger(EmbeddedPostgresDatasourceConfiguration.class);
    public static final String POSTGRES_DRIVER = "org.postgresql.Driver";
    public static final int DEFAULT_SANDBOX_PORT = 54329;

    private final SandboxProperties properties;

    public EmbeddedPostgresDatasourceConfiguration(SandboxProperties properties) {
        this.properties = properties;
    }

    @Bean(destroyMethod = "close")
    public EmbeddedPostgres embeddedPostgres() throws IOException {
        log.info("================================================================");
        log.info("  🚀 Starting Zonky Native Embedded PostgreSQL Engine...        ");
        log.info("================================================================");

        EmbeddedPostgres.Builder builder = EmbeddedPostgres.builder();
        builder.setLocaleConfig("locale", "en_US");
        builder.setLocaleConfig("lc-messages", "en_US");

        int desiredPort = properties.getDatabase().getPort();
        if (desiredPort <= 0) {
            desiredPort = DEFAULT_SANDBOX_PORT;
        }
        builder.setPort(desiredPort);

        if (properties.getMode() == SandboxProperties.SandboxMode.DEV) {
            String storagePath = properties.getDatabase().getDevStoragePath();
            File dataDir = new File(storagePath);
            if (properties.getDev().isPristine() && dataDir.exists()) {
                log.info("Pristine DEV mode active: purging existing database at {}", storagePath);
                deleteRecursively(dataDir);
            }
            if (!dataDir.exists()) {
                dataDir.mkdirs();
            }
            builder.setDataDirectory(dataDir);
            builder.setCleanDataDirectory(false);
            log.info("Configuring persistent PostgreSQL storage directory: {}", storagePath);
        } else {
            log.info("TEST mode active: using ephemeral in-memory PostgreSQL cluster");
        }

        EmbeddedPostgres instance = builder.start();
        log.info("Zonky Embedded PostgreSQL started successfully on port: {}", instance.getPort());
        return instance;
    }

    @Bean
    @Primary
    public DataSource sandboxDataSource(EmbeddedPostgres embeddedPostgres) {
        String jdbcUrl = embeddedPostgres.getJdbcUrl("postgres", "postgres");
        log.info("Initializing HikariCP connection pool for Embedded PostgreSQL: {}", jdbcUrl);

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl);
        config.setDriverClassName(POSTGRES_DRIVER);
        config.setUsername("postgres");
        config.setPassword("postgres");
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(30000);
        config.setPoolName("SandboxEmbeddedPgHikariPool");

        return new HikariDataSource(config);
    }

    private static void deleteRecursively(File file) {
        if (file == null || !file.exists()) {
            return;
        }
        if (file.isDirectory()) {
            File[] files = file.listFiles();
            if (files != null) {
                for (File child : files) {
                    deleteRecursively(child);
                }
            }
        }
        try {
            file.delete();
        } catch (Exception ignored) {
        }
    }
}
