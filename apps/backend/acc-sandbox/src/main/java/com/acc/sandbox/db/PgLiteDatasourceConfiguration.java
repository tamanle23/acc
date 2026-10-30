package com.acc.sandbox.db;

import com.acc.sandbox.config.SandboxProperties;
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
      if (dbFile.exists() && dbFile.isDirectory()) {
        log.warn("Storage path {} is a directory, but PGlite expects a file snapshot. Deleting directory.", storagePath);
        deleteRecursively(dbFile);
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

    return DataSourceBuilder.create()
        .driverClassName(PGLITE_DRIVER)
        .url(jdbcUrl)
        .username("postgres")
        .password("postgres")
        .build();
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
