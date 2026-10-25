# Migration Walkthrough: Spring Modulith 2 & Spring Boot 4.1 on Java 17 LTS

## Overview

We successfully completed the end-to-end migration of the entire multi-module project to:
- **Java 17 LTS**
- **Spring Boot 4.1.1**
- **Spring Framework 7.0.9**
- **Spring Modulith 2.1.1**
- **Spring Cloud 2025.1.1 (Oakwood)**
- **Jakarta EE 11** (`jakarta.*` namespace across all modules)

All 10 modules in the Maven reactor compile, package, and install with **`BUILD SUCCESS`**, and Spring Modulith 2 modularity verification tests pass.

---

## Changes by Module

### 1. Build Environment & Root POM (`pom.xml`)
- Upgraded Maven Wrapper to **Apache Maven 3.9.9** (`.mvn/wrapper/maven-wrapper.properties`).
- Configured Java 17 release targets (`<java.version>17</java.version>`, `maven.compiler.release=17`).
- Configured dependency management BOMs:
  - `org.springframework.boot:spring-boot-dependencies:4.1.1`
  - `org.springframework.cloud:spring-cloud-dependencies:2025.1.1`
  - `org.springframework.modulith:spring-modulith-bom:2.1.1`
  - `software.amazon.awssdk:bom:2.29.0`
- Updated annotation processing with `maven-compiler-plugin 3.13.0`:
  - Lombok `1.18.34`, MapStruct `1.6.0`, `lombok-mapstruct-binding:0.2.0`, QueryDSL 5 (Jakarta apt).
- Replaced legacy global `javax.annotation-api` and `javax.inject` with `jakarta.annotation-api:3.0.0` and `jakarta.inject-api:2.0.1`.

### 2. Common & Core
- **`core`**: Migrated `javax.servlet` to `jakarta.servlet`. Upgraded to Apache Commons FileUpload 2 (`commons-fileupload2-jakarta-servlet6:2.0.0-M2`) and `commons-io:2.16.1`.
- **`resources`**: Built and verified against Java 17.
- **`db`**: Replaced obsolete `mysql:mysql-connector-java` with `com.mysql:mysql-connector-j`.

### 3. Framework (`fw`)
- Migrated 147 source files from `javax.*` to `jakarta.*`.
- **Spring Boot 4 Modularization**:
  - Web MVC error attributes moved to `org.springframework.boot.webmvc.error.*` (`DefaultErrorAttributes`, `ErrorAttributes`).
  - JPA builders adapted to `org.springframework.boot.jpa.EntityManagerFactoryBuilder`.
  - Added modular dependencies: `spring-boot`, `spring-boot-autoconfigure`, `spring-boot-webmvc`, `spring-boot-jpa`, `spring-boot-jdbc`, `spring-boot-jms`.
- **Spring Security 7**:
  - Replaced deprecated `WebSecurityConfigurerAdapter` with modern `SecurityFilterChain` bean and `AuthenticationManager` configuration.
- **OpenAPI 3 / Swagger**:
  - Replaced legacy Springfox Swagger 2 with `springdoc-openapi-starter-webmvc-ui:2.8.0`.
- **Spring Framework 7 Assertion**:
  - Updated `Assert.notNull(...)` calls to include descriptive failure messages per Spring 7 API contract.
- **Interceptors**:
  - Adapted `TraceLoggingInterceptor` to `implements HandlerInterceptor`.

### 4. File Storage Service (`ms-fs`)
- Updated `FileSystemController` and `FileServiceImpl` to consume `FileItemInput.getInputStream()` from Apache Commons FileUpload 2.

### 5. Identity Service (`ms-identity`)
- Recompiled 97 Java source files against Jakarta EE 11, Spring Security 7, and MapStruct 1.6.0.

### 6. Report Engine (`report-engine`)
- Replaced Undertow-specific `io.undertow.util.LocaleUtils` with Spring 7 `org.springframework.util.StringUtils.parseLocaleString(...)`.
- Compiled JasperReports templates and Java classes with `BUILD SUCCESS`.

### 7. Worker Service (`ms-worker`)
- Removed obsolete `spring-batch-admin-manager:1.3.1.RELEASE`.
- Added `spring-batch-core` and `spring-batch-infrastructure` (version 6.0.5).
- **Spring Batch 6 Migration**:
  - Replaced removed `JobBuilderFactory` and `StepBuilderFactory` with `new JobBuilder(...)` and `new StepBuilder(...)`.
  - Updated `chunk(50, transactionManager)` and `TaskExecutorJobLauncher`.
  - Replaced `JobRegistryBeanPostProcessor` with `JobRegistrySmartInitializingSingleton`.
  - Updated `ItemWriter` and `ItemLogListener` to use `Chunk<? extends T>` instead of `List<? extends T>`.
  - Adapted `TruyenCuoiVietSkipPolicy` (`shouldSkip(Throwable, long skipCount)`).
  - Updated `WorkerServiceImpl` to use `JobExecution.getJobInstanceId()`.

### 8. All-in-One & Spring Modulith (`ms-aio`)
- Added Spring Modulith starters (`spring-modulith-starter-core`, `spring-modulith-starter-jpa`, `spring-modulith-starter-test`).
- Configured `@Modulithic(systemName = "acc", useFullyQualifiedModuleNames = true)` on `AppConfig`.
- Added Spring Modulith verification test `ModularityTests.java` (`ApplicationModules.of(AppConfig.class).verify();`).
- Packaged executable Fat JAR with `spring-boot-maven-plugin:4.1.1`.
