package com.acc.sandbox.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Early startup safeguard to prevent acc-sandbox from running under live production,
 * SIT, or UAT profiles.
 *
 * Registered via META-INF/spring.factories and executed at HIGHEST_PRECEDENCE before
 * bean instantiation, DataSource creation, or network port binding.
 */
public class SandboxEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

  private static final Logger log = LoggerFactory.getLogger(SandboxEnvironmentPostProcessor.class);

  public static final Set<String> RESTRICTED_PROFILES = Set.of("prod", "production", "sit", "uat");

  @Override
  public int getOrder() {
    return Ordered.HIGHEST_PRECEDENCE;
  }

  @Override
  public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
    String enabledProp = environment.getProperty("application.sandbox.enabled");
    boolean sandboxEnabled = Boolean.parseBoolean(enabledProp);

    if (!sandboxEnabled) {
      return;
    }

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

    log.info("SandboxEnvironmentPostProcessor: acc-sandbox enabled safely under profiles {}", activeProfiles);
  }
}
