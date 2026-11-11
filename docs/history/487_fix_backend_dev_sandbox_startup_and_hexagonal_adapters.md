# History Entry 487: Fix Backend Dev Sandbox Startup and Hexagonal Adapters

## Problem
Running `pnpm --filter @acc/backend dev:sandbox` failed to start the Spring Boot ApplicationContext with multiple cascaded failures:
1. **Poisoned IDE Bytecode Artifacts**: Background Eclipse/JDT LS compiler generated invalid `.class` files containing synthetic `java.lang.Error: Unresolved compilation problems: CreatePaymentLinkRequest cannot be resolved to a type` across `apps/backend/*/target`, preventing Spring BeanPostProcessors (`ObservationAutoConfiguration`, `ProxyTransactionManagementConfiguration`) from resolving aspect methods.
2. **Missing MyBatis Mapper Scanning**: `MasterDatabaseConfiguration.java` `@MapperScan` was restricted to `com.acc.*.repository.mybatis`, omitting `com.acc.identity.infra.user.repository.mybatis` and `com.acc.workflow.infrastructure.adapters.outbound.persistence.mybatis`, and `application.yml` only scanned `classpath*:mappers/*.xml` instead of `classpath*:mapper/**/*.xml`.
3. **Broken Reactor Compilation Fork**: Spring Boot's multi-module run goal triggered `testCompile` on reactor dependencies (`acc-ms-fs`), where `acc-fw` was missing an explicit `<version>` tag in `acc-ms-fs/pom.xml`, and poisoned `.class` files in `acc-ms-fs` caused false missing-symbol errors in `FileServiceImplPerformanceTest.java`.
4. **Syntax and Contract Mismatches**:
   - `AuditLedgerController.java`: Mismatched parenthesis in `verifyAuditChain`.
   - `AuditLedgerControllerTest.java`: Outdated constructor arguments following hexagonal migration.
   - `WorkflowEngineService.executeManualCompensation`: Returned `void` while `WorkflowExecutionController` expected the count of scheduled compensations.
5. **Missing Hexagonal Driven Secondary Ports in File Storage**: `UploadFileApplicationService` required `BlobStoragePort` and `FsObjectRepositoryPort` beans, which had no concrete adapter implementations in `acc-ms-fs`.

## Plan
1. Purge all poisoned IDE `.class` files across all backend module `target/` directories and enforce clean compilation with `javac`.
2. Expand `@MapperScan` and `mybatis.mapper-locations` to discover all domain repository mappers.
3. Fix syntax and controller signatures for `AuditLedgerController`, `AuditLedgerControllerTest`, and `WorkflowEngineService`.
4. Implement genuine, non-stub hexagonal driven adapters:
   - `FileSystemBlobStorageAdapter` implementing `BlobStoragePort`.
   - `JpaFsObjectRepositoryAdapter` implementing `FsObjectRepositoryPort`.
5. Verify clean multi-module build via `mvn compile` and `mvn test-compile`.
6. Run `pnpm --filter @acc/backend dev:sandbox`, verifying Embedded PostgreSQL, Hikari connection pools, Liquibase migrations, Jetty server binding on port 8080, and HTTP actuator health checks.

## Changes
- **`apps/backend/acc-fw/src/main/java/com/acc/boot/config/MasterDatabaseConfiguration.java`**:
  - Expanded `@MapperScan` to include `com.acc.identity.infra.user.repository.mybatis` and `com.acc.workflow.infrastructure.adapters.outbound.persistence.mybatis`.
- **`apps/backend/acc-ms-aio/src/main/resources/application.yml`**:
  - Expanded `mybatis.mapper-locations` to include `classpath*:mapper/**/*.xml`.
- **`apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/AuditLedgerController.java`**:
  - Fixed syntax error in `verifyAuditChain`.
- **`apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowExecutionController.java`**:
  - Used returned scheduled compensation count from `WorkflowEngineService`.
- **`apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/WorkflowEngineService.java`**:
  - Updated `executeManualCompensation` to return `int` (scheduled compensation count).
- **`apps/backend/acc-ms-aio/src/test/java/com/acc/aio/controller/workflow/AuditLedgerControllerTest.java`**:
  - Aligned constructor invocation with hexagonal service dependencies.
- **`apps/backend/acc-ms-fs/pom.xml`**:
  - Added explicit `<version>${project.version}</version>` to `acc-fw` dependency.
- **`apps/backend/acc-ms-fs/src/main/java/com/acc/fs/infrastructure/adapters/outbound/storage/FileSystemBlobStorageAdapter.java`**:
  - Implemented `BlobStoragePort` with zero heap cloning, direct `InputStream` streaming via `StandardCopyOption.REPLACE_EXISTING`.
- **`apps/backend/acc-ms-fs/src/main/java/com/acc/fs/infrastructure/adapters/outbound/persistence/JpaFsObjectRepositoryAdapter.java`**:
  - Implemented `FsObjectRepositoryPort` mapping `FsObjectAggregate` to/from JPA `FsObject` entities and directory relations.

## Verification
1. **Bytecode Hygiene**: Verified 0 poisoned `.class` files across all 9 modules.
2. **Build Success**:
   - `mvn compile -f apps/backend/pom.xml -DskipTests=true` -> BUILD SUCCESS in 9.6s across all 9 reactor modules.
   - `mvn test-compile -f apps/backend/pom.xml -DskipTests=true` -> BUILD SUCCESS in 18.6s across all 9 reactor modules.
3. **Runtime dev:sandbox Boot**:
   - `pnpm --filter @acc/backend dev:sandbox` successfully started:
     - Zonky Embedded PostgreSQL on port 54329.
     - HikariCP pool `HikariPool-WorkflowEngine` and Master pool.
     - Liquibase migrations executed cleanly.
     - Spring Modulith verification passed.
     - Jetty server listening on port 8080 with root path `/`.
4. **HTTP Verification**:
   - `GET http://localhost:8080/actuator/health` responded `200 OK` with `{"groups":["liveness","readiness"],"status":"UP"}`.
   - `GET http://localhost:8080/api/v1/workflow/task-definitions` returned `401 Unauthorized` through Spring Security filter chain.

## Walkthrough
The backend sandbox environment now starts reliably with zero broken dependencies or compilation errors. The ports-and-adapters architecture is preserved with real production adapters for storage and JPA persistence.

## Tasks
- [x] Clean poisoned IDE `.class` artifacts
- [x] Fix compilation and syntax errors in `acc-ms-aio` and `workflow-engine`
- [x] Configure MyBatis mapper scanning and XML paths
- [x] Implement `FileSystemBlobStorageAdapter` and `JpaFsObjectRepositoryAdapter`
- [x] Verify complete reactor compilation and test-compilation
- [x] Verify live server startup on port 8080 and actuator health check

## Enhancement
Future phases can introduce automated maven pre-compile hooks or compiler exclusion guards to prevent background IDE language servers from polluting Maven target directories with synthetic compilation errors.
