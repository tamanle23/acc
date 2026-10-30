package com.acc.sandbox.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.io.File;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Early startup safeguard and environment normalizer for the acc-sandbox platform.
 *
 * 1. Halts Spring Boot immediately with SecurityException if sandbox is enabled under
 *    restricted production/SIT/UAT profiles.
 * 2. Injects PGlite datasource properties at highest precedence to ensure no component
 *    ever falls back to external PostgreSQL instances during sandbox execution.
 *
 * Registered via META-INF/spring.factories and executed at HIGHEST_PRECEDENCE before
 * bean instantiation, DataSource creation, or network port binding.
 */
public class SandboxEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

  private static final Logger log = LoggerFactory.getLogger(SandboxEnvironmentPostProcessor.class);

  public static final Set<String> RESTRICTED_PROFILES = Set.of("prod", "production", "sit", "uat");
  public static final String PGLITE_DRIVER = "io.roastedroot.pglite4j.jdbc.PgLiteDriver";

  @Override
  public int getOrder() {
    return Ordered.HIGHEST_PRECEDENCE;
  }

  @Override
  public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
    Set<String> activeProfiles = new HashSet<>();
    for (String p : environment.getActiveProfiles()) {
      if (p != null) {
        activeProfiles.add(p.trim().toLowerCase(Locale.ROOT));
      }
    }

    // Also inspect property-driven active profile definitions
    String propertyProfiles = environment.getProperty("spring.profiles.active");
    if (propertyProfiles != null && !propertyProfiles.isBlank()) {
      Arrays.stream(propertyProfiles.split(","))
          .map(String::trim)
          .map(s -> s.toLowerCase(Locale.ROOT))
          .forEach(activeProfiles::add);
    }

    String enabledProp = environment.getProperty("application.sandbox.enabled");
    boolean sandboxEnabled = Boolean.parseBoolean(enabledProp) || activeProfiles.contains("sandbox");

    if (!sandboxEnabled) {
      return;
    }

    for (String restricted : RESTRICTED_PROFILES) {
      if (activeProfiles.contains(restricted)) {
        String violationMsg = String.format(
            "CRITICAL SECURITY VIOLATION: acc-sandbox cannot be enabled under restricted profile '%s'. "
                + "Aborting Spring Boot initialization immediately.",
            restricted);
        log.error("================================================================================");
        log.error("  🚨 {}", violationMsg);
        log.error("================================================================================");
        throw new SecurityException(violationMsg);
      }
    }

    // Inject sandbox properties at highest precedence so DataSourceAutoConfiguration and MyBatis
    // connect seamlessly to embedded PGlite WASM with zero external PostgreSQL dependencies
    String mode = environment.getProperty("application.sandbox.mode", "DEV");
    String devStorage = environment.getProperty("application.sandbox.database.dev-storage-path", "../../tmp/db/pglite-sandbox.db");

    String jdbcUrl;
    if ("TEST".equalsIgnoreCase(mode)) {
      jdbcUrl = "jdbc:pglite:memory://";
    } else {
      File storageFile = new File(devStorage);
      if (storageFile.exists()) {
        if (storageFile.isDirectory()) {
          log.warn("Storage path {} is a directory, but PGlite expects a file snapshot. Deleting directory.", devStorage);
          deleteRecursively(storageFile);
        } else if (storageFile.length() < 100) {
          log.warn("Storage file {} is empty or invalid (length={}). Removing to allow clean initialization.", devStorage, storageFile.length());
          storageFile.delete();
        }
      }
      File parentDir = storageFile.getParentFile();
      if (parentDir != null && !parentDir.exists()) {
        parentDir.mkdirs();
      }
      jdbcUrl = "jdbc:pglite:" + devStorage;
    }

    Map<String, Object> sandboxOverrides = new HashMap<>();
    sandboxOverrides.put("application.sandbox.enabled", "true");
    sandboxOverrides.put("spring.datasource.url", jdbcUrl);
    sandboxOverrides.put("spring.datasource.driver-class-name", PGLITE_DRIVER);
    sandboxOverrides.put("spring.datasource.username", "postgres");
    sandboxOverrides.put("spring.datasource.password", "postgres");
    sandboxOverrides.put("spring.datasource.hikari.maximum-pool-size", 10);
    sandboxOverrides.put("spring.datasource.hikari.minimum-idle", 1);
    sandboxOverrides.put("spring.datasource.hikari.connection-timeout", 30000);

    environment.getPropertySources().addFirst(new MapPropertySource("sandboxEnvironmentOverrides", sandboxOverrides));

    log.info("SandboxEnvironmentPostProcessor: acc-sandbox active (url={}, profiles={})", jdbcUrl, activeProfiles);
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
