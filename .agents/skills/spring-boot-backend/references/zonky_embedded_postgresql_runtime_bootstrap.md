# Zonky Native Embedded PostgreSQL Runtime Bootstrap Pattern

## Context
When running local development or sandbox environments for complex Spring Boot / Spring Modulith applications without requiring an external Docker daemon, experimental WASM wrappers (e.g., PGlite) fail due to single-threaded runtime bottlenecks, missing system sequence views, or unsupported DDL constructs (partitioning, PL/pgSQL).

**Zonky Embedded Postgres** (`io.zonky.test:embedded-postgres`) provides 100% production-parity native PostgreSQL binaries across Windows, Linux, and macOS without synthetic mocks or Docker dependencies.

---

## 1. Maven Dependency Configuration
Import the PostgreSQL binary BOM to manage architecture-specific native packages:

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>io.zonky.test.postgres</groupId>
      <artifactId>embedded-postgres-binaries-bom</artifactId>
      <version>17.11.0</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <dependency>
    <groupId>io.zonky.test</groupId>
    <artifactId>embedded-postgres</artifactId>
    <version>2.1.0</version>
  </dependency>
  <dependency>
    <groupId>io.zonky.test.postgres</groupId>
    <artifactId>embedded-postgres-binaries-windows-amd64</artifactId>
  </dependency>
  <dependency>
    <groupId>io.zonky.test.postgres</groupId>
    <artifactId>embedded-postgres-binaries-linux-amd64</artifactId>
  </dependency>
  <dependency>
    <groupId>io.zonky.test.postgres</groupId>
    <artifactId>embedded-postgres-binaries-darwin-amd64</artifactId>
  </dependency>
  <dependency>
    <groupId>io.zonky.test.postgres</groupId>
    <artifactId>embedded-postgres-binaries-darwin-arm64v8</artifactId>
  </dependency>
</dependencies>
```

---

## 2. Dynamic Spring Boot Datasource Configuration

```java
@Configuration
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class EmbeddedPostgresDatasourceConfiguration {

    @Bean(destroyMethod = "close")
    public EmbeddedPostgres embeddedPostgres(SandboxProperties properties) throws IOException {
        EmbeddedPostgres.Builder builder = EmbeddedPostgres.builder();
        // Explicitly enforce US English locale to prevent Windows initdb.exe locale parsing crashes
        builder.setLocaleConfig("locale", "en_US");
        builder.setLocaleConfig("lc-messages", "en_US");

        int port = properties.getDatabase().getPort();
        builder.setPort(port > 0 ? port : 54329);

        if (properties.getMode() == SandboxProperties.SandboxMode.DEV) {
            File dataDir = new File(properties.getDatabase().getDevStoragePath());
            if (!dataDir.exists()) {
                dataDir.mkdirs();
            }
            builder.setDataDirectory(dataDir);
            builder.setCleanDataDirectory(false); // Retain data between reboots
        }
        return builder.start();
    }

    @Bean
    @Primary
    public DataSource sandboxDataSource(EmbeddedPostgres embeddedPostgres) {
        String jdbcUrl = embeddedPostgres.getJdbcUrl("postgres", "postgres");
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl);
        config.setDriverClassName("org.postgresql.Driver");
        config.setUsername("postgres");
        config.setPassword("postgres");
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(30000);
        return new HikariDataSource(config);
    }
}
```

---

## 3. Key Invariants
1. **Windows `initdb.exe` Locale Safety**: Always set `.setLocaleConfig("locale", "en_US")` and `.setLocaleConfig("lc-messages", "en_US")` on `EmbeddedPostgres.builder()`.
2. **Process Cleanup**: Ensure `EmbeddedPostgres` bean declares `destroyMethod = "close"` to terminate the child `postgres.exe` / `postgres` process on context termination.
3. **Standard Driver**: Use official `org.postgresql.Driver` with full HikariCP pooling; never synthetic or WASM wrappers.
