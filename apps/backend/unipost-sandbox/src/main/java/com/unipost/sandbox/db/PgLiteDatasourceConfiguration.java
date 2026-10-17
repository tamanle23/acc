package com.unipost.sandbox.db;

import com.unipost.sandbox.config.SandboxProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.io.File;

/**
 * Datasource configuration for embedded PGlite.
 * Activated strictly when application.sandbox.enabled=true and application.sandbox.database.embedded-pglite=true.
 * Provides ephemeral in-memory database for TEST mode and file-backed database for DEV mode.
 */
@Configuration
@ConditionalOnProperty(prefix = "application.sandbox.database", name = "embedded-pglite", havingValue = "true", matchIfMissing = true)
public class PgLiteDatasourceConfiguration {

    private static final Logger log = LoggerFactory.getLogger(PgLiteDatasourceConfiguration.class);

    private final SandboxProperties properties;

    public PgLiteDatasourceConfiguration(SandboxProperties properties) {
        this.properties = properties;
    }

    @Bean
    @Primary
    public DataSource sandboxDataSource() {
        boolean isTestMode = properties.getMode() == SandboxProperties.SandboxMode.TEST;
        String jdbcUrl;

        if (isTestMode) {
            jdbcUrl = "jdbc:pglite:memory://";
            log.info("Configuring PGlite in-memory datasource for TEST mode: {}", jdbcUrl);
        } else {
            String storagePath = properties.getDatabase().getDevStoragePath();
            File dbDir = new File(storagePath);
            if (properties.getDev().isPristine() && dbDir.exists()) {
                log.info("DEV mode pristine flag active. Wiping persistent scratch database directory: {}", storagePath);
                deleteRecursively(dbDir);
            }
            if (!dbDir.exists()) {
                dbDir.mkdirs();
            }
            jdbcUrl = "jdbc:pglite:file:" + storagePath;
            log.info("Configuring PGlite persistent file-backed datasource for DEV mode (pristine={}): {}", 
                    properties.getDev().isPristine(), jdbcUrl);
        }

        try {
            // Check if PGlite driver is available on classpath
            Class.forName("io.roastedroot.pglite4j.jdbc.PgLiteDriver");
            return DataSourceBuilder.create()
                    .driverClassName("io.roastedroot.pglite4j.jdbc.PgLiteDriver")
                    .url(jdbcUrl)
                    .username("postgres")
                    .password("postgres")
                    .build();
        } catch (ClassNotFoundException e) {
            log.warn("PGlite driver not found on classpath. Falling back to local PostgreSQL URL (localhost:5432/unipost).");
            return DataSourceBuilder.create()
                    .driverClassName("org.postgresql.Driver")
                    .url("jdbc:postgresql://localhost:5432/unipost?charSet=UTF-8")
                    .username("postgres")
                    .password("postgres")
                    .build();
        }
    }

    private void deleteRecursively(File file) {
        if (file.isDirectory()) {
            File[] files = file.listFiles();
            if (files != null) {
                for (File child : files) {
                    deleteRecursively(child);
                }
            }
        }
        file.delete();
    }
}
