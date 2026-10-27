# History Entry 144: Fix Multiple Primary DataSource Beans in Backend Sandbox Startup

## Problem Statement
When running `pnpm dev:sandbox` at the monorepo root (which launches `turbo dev --filter=@acc/backend --filter=@acc/console` with Spring Boot profile `local` and `application.sandbox.enabled=true`), Spring Boot aborted with:
```
Caused by: org.springframework.beans.factory.NoUniqueBeanDefinitionException: No qualifying bean of type 'javax.sql.DataSource' available: more than one 'primary' bean found among candidates: [masterDatabase, sandboxDataSource]
```

## Root Cause Analysis
1. `MasterDatabaseConfiguration.java` was previously compiled in `acc-fw.jar` with `@Primary` and without `@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "false", matchIfMissing = true)`. Because maven multi-module builds compile sub-projects incrementally, `acc-fw` had not been packaged and installed to `.m2`, leading Spring Boot to load the old bytecode.
2. In `PgLiteDatasourceConfiguration.java`, the class-level condition was `@ConditionalOnProperty(prefix = "application.sandbox.database", name = "embedded-pglite", havingValue = "true", matchIfMissing = true)`. Because `matchIfMissing=true`, Spring's classpath scanner registered `PgLiteDatasourceConfiguration` early during standard component scanning before `SandboxAutoConfiguration` ran.
3. Because `PgLiteDatasourceConfiguration` required constructor parameter `SandboxProperties`, which lacked `@Component`, Spring could not resolve the parameter when `PgLiteDatasourceConfiguration` was discovered during component scan.

## Solution Applied
1. **Added `@Component` to `SandboxProperties.java`**:
   - Ensures `SandboxProperties` is always registered as a valid autowire candidate during component scan or auto-configuration.
2. **Hardened `PgLiteDatasourceConfiguration.java`**:
   - Updated condition to `@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")` so the sandbox datasource bean is strictly and only activated when the sandbox is explicitly enabled.
3. **Confirmed `MasterDatabaseConfiguration.java`**:
   - `masterDatabase` is explicitly gated with `@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "false", matchIfMissing = true)` and does NOT have `@Primary`.
4. **Rebuilt & Installed Modules**:
   - Recompiled and packaged `acc-fw`, `acc-sandbox`, and `acc-ms-aio`.
   - Verified that running `pnpm dev:sandbox` / `spring-boot:run` starts Jetty on port 8000 in 16.8 seconds, exposes `/actuator/health` returning HTTP 200 `{"status":"UP"}`, and runs with zero bean conflict.

## Verification
- `node apps/backend/mvnw.cjs -pl acc-ms-aio spring-boot:run ...` started with 0 errors.
- `curl http://localhost:8000/actuator/health` returned HTTP 200 OK.
- `pnpm test:backend:sandbox` ran 33/33 tests passing.
