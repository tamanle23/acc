# Migration Plan: Migrating `prjz` to Java 17 LTS, Spring Boot 4.1 & Spring Modulith 2

This plan details the full architectural and technical transition of the application from **Java 8 / Spring Boot 2.3.12 / Spring Cloud Hoxton** to **Java 17 LTS**, **Spring Boot 4.1**, **Spring Framework 7**, **Jakarta EE 11**, and **Spring Modulith 2.1.1**.

---

## Target Architecture & Technology Stack

| Component | Initial Version | Target Version |
| :--- | :--- | :--- |
| **Java JDK** | Java 8 (Temurin 1.8.0_504) | **Java 17 LTS** (Temurin 17.0.20 via `vfox`) |
| **Spring Framework** | 5.2.15.RELEASE | **Spring Framework 7.x** (Java 17 baseline) |
| **Spring Boot** | 2.3.12.RELEASE | **Spring Boot 4.1.x** |
| **Spring Modulith** | *(None)* | **Spring Modulith 2.1.1** (BOM-managed) |
| **Jakarta EE** | Java EE 7/8 (`javax.*`) | **Jakarta EE 11** (`jakarta.*` Servlet 6.1, JPA 3.2) |
| **Persistence / ORM** | Hibernate 5.4, QueryDSL 4.x | **Hibernate 6.6+ / 7.x**, **QueryDSL 5.x (Jakarta)** |
| **Security & Auth** | Spring Security OAuth2 2.4.0 (Deprecated) | **Spring Security 7.x** (Native OAuth2 Resource Server) |
| **API Docs / OpenAPI**| Springfox Swagger 2.8.0 (Deprecated) | **Springdoc OpenAPI 2.x+ / OpenAPI 3** |
| **Integration** | Apache Camel 2.24.2 | **Apache Camel 4.x** (Jakarta EE compatible) |

---

## Phased Execution Strategy

1. **Step 1: Environment & Toolchain Configuration**
   - Switch active JDK to Java 17 LTS (`vfox use java@17.0.20+8-tem`).
   - Upgrade Maven Wrapper to Apache Maven 3.9.9.
   - Configure Java 17 compiler release targets in root POM.
2. **Step 2: Root POM & Dependency Management Upgrades**
   - Import Spring Boot 4.1.1, Spring Cloud 2025.1.1, and Spring Modulith 2.1.1 BOMs.
   - Upgrade Lombok 1.18.34, MapStruct 1.6.0, and QueryDSL 5 (Jakarta apt).
3. **Step 3: Jakarta EE 11 Namespace Migration**
   - Refactor `javax.*` to `jakarta.*` across all modules:
     - `javax.servlet.*` &rarr; `jakarta.servlet.*`
     - `javax.persistence.*` &rarr; `jakarta.persistence.*`
     - `javax.annotation.*` &rarr; `jakarta.annotation.*`
     - `javax.validation.*` &rarr; `jakarta.validation.*`
     - `javax.jms.*` &rarr; `jakarta.jms.*`
4. **Step 4: Module Modernization**
   - **`acc-core`**: Commons FileUpload 2 (`commons-fileupload2-jakarta-servlet6:2.0.0-M2`).
   - **`acc-fw`**: Spring Boot 4 modular packages, Spring Security 7 `SecurityFilterChain`, SpringDoc OpenAPI 3, Spring 7 `Assert.notNull` signatures.
   - **`acc-report-engine`**: Replace Undertow `LocaleUtils` with Spring 7 `StringUtils.parseLocaleString`.
   - **`acc-ms-worker`**: Replace dead Spring Batch Admin with Spring Batch 6 (`JobBuilder`, `StepBuilder`, `Chunk<T>`, `TaskExecutorJobLauncher`).
5. **Step 5: Spring Modulith Setup in `acc-ms-aio`**
   - Add Spring Modulith starters (`core`, `jpa`, `test`).
   - Configure `@Modulithic(systemName = "acc", useFullyQualifiedModuleNames = true)` on `AppConfig`.
   - Add `ModularityTests.java` with `ApplicationModules.of(AppConfig.class).verify();`.
