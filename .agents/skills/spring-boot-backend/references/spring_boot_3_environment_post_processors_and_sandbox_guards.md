# Spring Boot 3 EnvironmentPostProcessor & Sandbox Safeguards Reference

## Critical Discovery: Registration Mechanism in Spring Boot 3.x
Unlike `@AutoConfiguration` beans which migrated to `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`, Spring Boot 3 **strictly continues to use `META-INF/spring.factories`** for early lifecycle extensions:
- `EnvironmentPostProcessor`
- `ApplicationContextInitializer`
- `SpringApplicationRunListener`

There is **NO** `org.springframework.boot.env.EnvironmentPostProcessor.imports` file. Attempting to use `.imports` causes the processor to be silently ignored.

### 1. Implementation Pattern
```java
package com.acc.sandbox.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.ConfigurableEnvironment;

import java.util.Set;

@Order(Ordered.HIGHEST_PRECEDENCE)
public class SandboxEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    private static final Set<String> RESTRICTED_PROFILES = Set.of("prod", "production", "sit", "uat");

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Boolean sandboxEnabled = environment.getProperty("application.sandbox.enabled", Boolean.class, false);
        if (Boolean.TRUE.equals(sandboxEnabled)) {
            for (String profile : environment.getActiveProfiles()) {
                if (RESTRICTED_PROFILES.contains(profile.toLowerCase())) {
                    throw new SecurityException(
                        "CRITICAL SECURITY VIOLATION: acc-sandbox cannot be enabled under restricted profile '" + profile + "'!"
                    );
                }
            }
        }
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
```

### 2. Registration in `src/main/resources/META-INF/spring.factories`
```properties
org.springframework.boot.env.EnvironmentPostProcessor=\
  com.acc.sandbox.config.SandboxEnvironmentPostProcessor
```

### 3. In-Process WebAssembly PostgreSQL (pglite4j)
For zero-dependency in-process PostgreSQL 17 execution in Spring Boot:
```xml
<dependency>
    <groupId>io.roastedroot</groupId>
    <artifactId>pglite4j</artifactId>
    <version>0.0.3</version>
</dependency>
```
Driver class: `io.roastedroot.pglite4j.jdbc.PgLiteDriver`
- In-memory: `jdbc:pglite:memory://`
- Persistent file: `jdbc:pglite:file:<path>`
