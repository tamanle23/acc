package com.acc.sandbox.db;

import com.acc.sandbox.config.SandboxProperties;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.io.File;
import java.sql.Connection;
import java.sql.Statement;

/**
 * Datasource configuration for embedded PGlite.
 * Activated strictly when application.sandbox.enabled=true and
 * application.sandbox.database.embedded-pglite=true.
 * Provides ephemeral in-memory database for TEST mode and file-backed database
 * for DEV mode.
 */
@Configuration
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class PgLiteDatasourceConfiguration {

  private static final Logger log = LoggerFactory.getLogger(PgLiteDatasourceConfiguration.class);
  public static final String PGLITE_DRIVER = "io.roastedroot.pglite4j.jdbc.PgLiteDriver";

  private final SandboxProperties properties;

  public PgLiteDatasourceConfiguration(SandboxProperties properties) {
    this.properties = properties;
  }

  @Bean
  @Primary
  public DataSource sandboxDataSource() {
    try {
      Class.forName(PGLITE_DRIVER);
    } catch (ClassNotFoundException e) {
      throw new IllegalStateException(
          "Failed to initialize embedded PGlite WASM driver (" + PGLITE_DRIVER + "): " + e.getMessage(), e);
    }

    boolean isTestMode = properties.getMode() == SandboxProperties.SandboxMode.TEST;
    String jdbcUrl;

    if (isTestMode) {
      jdbcUrl = "jdbc:pglite:memory://";
      log.info("Configuring PGlite in-memory datasource for TEST mode: {}", jdbcUrl);
    } else {
      String storagePath = properties.getDatabase().getDevStoragePath();
      File dbFile = new File(storagePath);
      // PGlite expects a file snapshot, NOT a directory.
      // If an erroneous directory was previously created at storagePath, delete it to avoid AccessDeniedException.
      if (dbFile.exists()) {
        if (dbFile.isDirectory()) {
          log.warn("Storage path {} is a directory, but PGlite expects a file snapshot. Deleting directory.", storagePath);
          deleteRecursively(dbFile);
        } else if (dbFile.length() < 100) {
          log.warn("Storage file {} is empty or invalid (length={}). Removing to allow clean initialization.", storagePath, dbFile.length());
          dbFile.delete();
        }
      }
      if (properties.getDev().isPristine() && dbFile.exists()) {
        log.info("DEV mode pristine flag active. Wiping persistent scratch database file: {}", storagePath);
        deleteRecursively(dbFile);
      }
      File parentDir = dbFile.getParentFile();
      if (parentDir != null && !parentDir.exists()) {
        parentDir.mkdirs();
      }
      jdbcUrl = "jdbc:pglite:" + storagePath;
      log.info("Configuring PGlite persistent file-backed datasource for DEV mode (pristine={}): {}",
          properties.getDev().isPristine(), jdbcUrl);
    }

    HikariDataSource ds = DataSourceBuilder.create()
        .type(HikariDataSource.class)
        .driverClassName(PGLITE_DRIVER)
        .url(jdbcUrl)
        .username("postgres")
        .password("postgres")
        .build();
    ds.setMaximumPoolSize(10);
    ds.setMinimumIdle(1);
    ds.setConnectionTimeout(30000);

    // Self-contained Sandbox schema initialization: pre-provision base audit table
    // so downstream core components (like AuditPartitionProvisioner) find the table
    // ready in embedded PGlite without requiring any modifications to core code.
    try (Connection conn = ds.getConnection();
         Statement stmt = conn.createStatement()) {
      stmt.execute("CREATE TABLE IF NOT EXISTS UNIPOST_RECORD_AUDIT_LOG (" +
          "id BIGSERIAL, " +
          "tenant_id VARCHAR(64) NOT NULL, " +
          "record_id VARCHAR(128) NOT NULL, " +
          "entity_type_id VARCHAR(64) NOT NULL, " +
          "actor_id VARCHAR(64) NOT NULL, " +
          "action VARCHAR(32) NOT NULL, " +
          "payload JSONB, " +
          "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), " +
          "PRIMARY KEY (id, created_at)" +
          ") PARTITION BY RANGE (created_at)");
      stmt.execute("CREATE TABLE IF NOT EXISTS UNIPOST_RECORD_AUDIT_LOG_DEFAULT " +
          "PARTITION OF UNIPOST_RECORD_AUDIT_LOG DEFAULT");
      log.info("PGlite: UNIPOST_RECORD_AUDIT_LOG base partition table verified/initialized.");
    } catch (Exception e) {
      log.warn("PGlite: Base partition table setup skipped (will be created by Liquibase/runtime): {}", e.getMessage());
    }

    return ds;
  }

  private void deleteRecursively(File file) {
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
