# 489: Spring Modulith Package Encapsulation & Named Interfaces

## Problem
In Phase 4 of the Hexagonal Architecture & DDD modernization, the backend architecture required formal module encapsulation and package boundary enforcement using Spring Modulith 2.1.1. While `acc-ms-aio` had an initial `@Modulithic` annotation, the monorepo bounded contexts (`com.acc.aio.config`, `com.acc.aio.controller`, `com.acc.aio.worker`, `com.acc.workflow`, `com.acc.fs`, `com.acc.worker`, and `com.acc.identity`) lacked declarative `package-info.java` descriptors.

Without explicit `@ApplicationModule` and `@NamedInterface` annotations:
1. Module boundaries, display metadata, and exposed interface contracts were implicit rather than statically declared.
2. Inbound driving REST controllers and outbound driven SPI ports lacked architectural visibility demarcation.
3. Automated architecture documentation (`Documenter`) and component canvas generation were unconfigured in verification suites.

## Plan
1. **Declare `spring-modulith-api` in Bounded Context POMs**:
   - Add `org.springframework.modulith:spring-modulith-api` (managed by parent BOM) to `acc-fw`, `workflow-engine`, `acc-ms-fs`, and `acc-ms-worker`.
2. **Implement Package-Level Encapsulation Descriptors (`package-info.java`)**:
   - `acc-ms-aio`:
     - `com.acc.aio.config`: `@ApplicationModule(displayName = "AIO Bootstrap & Configuration")`
     - `com.acc.aio.controller`: `@ApplicationModule(displayName = "AIO Driving REST Controllers")`
     - `com.acc.aio.controller.workflow`: `@NamedInterface("workflow")`
     - `com.acc.aio.worker`: `@ApplicationModule(displayName = "AIO Background Workers & Event Listeners")`
   - `workflow-engine`:
     - `com.acc.workflow`: `@ApplicationModule(displayName = "Workflow & Orchestration Engine", type = Type.OPEN)`
     - `com.acc.workflow.ports`: `@NamedInterface("ports")`
     - `com.acc.workflow.application`: `@NamedInterface("application")`
   - `acc-ms-fs`:
     - `com.acc.fs`: `@ApplicationModule(displayName = "File Storage & Media Asset Service", type = Type.OPEN)`
     - `com.acc.fs.application.ports.in`: `@NamedInterface("ports")`
     - `com.acc.fs.application.ports.out`: `@NamedInterface("spi")`
   - `acc-ms-worker`:
     - `com.acc.worker`: `@ApplicationModule(displayName = "Worker, Sagas & Transactional Outbox Dispatcher", type = Type.OPEN)`
     - `com.acc.worker.application.outbox.ports.in`: `@NamedInterface("ports")`
     - `com.acc.worker.application.saga.ports.in`: `@NamedInterface("ports")`
   - `acc-fw`:
     - `com.acc.identity`: `@ApplicationModule(displayName = "Identity & Access Management", type = Type.OPEN)`
     - `com.acc.identity.application.user.port.in`: `@NamedInterface("ports")`
3. **Enhance `ModularityTests`**:
   - Add automated verification for package encapsulation and module interfaces.
   - Add `Documenter(modules).writeDocumentation()` to output AsciiDoc canvas specifications and PlantUML diagrams into `target/spring-modulith-docs`.
4. **Execute 4-Tier Verification Suite**:
   - Tier 1: Pure domain aggregate tests (`*AggregateTest`).
   - Tier 2: ArchUnit Hexagonal Architecture rules (`HexagonalArchitectureEnforcementTest`).
   - Tier 3: Core module test suites (`workflow-engine`, `acc-ms-fs`, `acc-ms-worker`).
   - Tier 4: Spring Modulith verification (`ModularityTests`).

## Changes
- **Maven Reactor POMs**:
  - `apps/api/acc-fw/pom.xml`: Added `spring-modulith-api`.
  - `apps/api/workflow-engine/pom.xml`: Added `spring-modulith-api`.
  - `apps/api/acc-ms-fs/pom.xml`: Added `spring-modulith-api`.
  - `apps/api/acc-ms-worker/pom.xml`: Added `spring-modulith-api`.
- **Package Encapsulation Descriptors (`package-info.java`)**:
  - `apps/api/acc-ms-aio/src/main/java/com/acc/aio/config/package-info.java`
  - `apps/api/acc-ms-aio/src/main/java/com/acc/aio/controller/package-info.java`
  - `apps/api/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/package-info.java`
  - `apps/api/acc-ms-aio/src/main/java/com/acc/aio/worker/package-info.java`
  - `apps/api/workflow-engine/src/main/java/com/acc/workflow/package-info.java`
  - `apps/api/workflow-engine/src/main/java/com/acc/workflow/ports/package-info.java`
  - `apps/api/workflow-engine/src/main/java/com/acc/workflow/application/package-info.java`
  - `apps/api/acc-ms-fs/src/main/java/com/acc/fs/package-info.java`
  - `apps/api/acc-ms-fs/src/main/java/com/acc/fs/application/ports/in/package-info.java`
  - `apps/api/acc-ms-fs/src/main/java/com/acc/fs/application/ports/out/package-info.java`
  - `apps/api/acc-ms-worker/src/main/java/com/acc/worker/package-info.java`
  - `apps/api/acc-ms-worker/src/main/java/com/acc/worker/application/outbox/ports/in/package-info.java`
  - `apps/api/acc-ms-worker/src/main/java/com/acc/worker/application/saga/ports/in/package-info.java`
  - `apps/api/acc-fw/src/main/java/com/acc/identity/package-info.java`
  - `apps/api/acc-fw/src/main/java/com/acc/identity/application/user/port/in/package-info.java`
- **Modulith Verification & Documentation**:
  - `apps/api/acc-ms-aio/src/test/java/com/acc/aio/ModularityTests.java`: Added `@DisplayName` and `Documenter.writeDocumentation()` generation step.

## Verification
- **Tier 1 (Domain Tests)**:
  - `mvn test -f apps/api/pom.xml "-Dtest=*AggregateTest"`: Exited 0.
- **Tier 2 (ArchUnit Enforcement)**:
  - `mvn test -f apps/api/pom.xml -pl :acc-core "-Dtest=HexagonalArchitectureEnforcementTest"`: Exited 0 (0 framework leaks in any domain package).
- **Tier 3 (Module Suites)**:
  - `mvn test -f apps/api/pom.xml -pl :workflow-engine,:acc-ms-fs,:acc-ms-worker`: All module unit and integration tests passed with 0 failures, 0 errors.
- **Tier 4 (Spring Modulith Verification & Documentation)**:
  - `mvn test -f apps/api/pom.xml -pl :acc-ms-aio "-Dtest=ModularityTests"`: Exited 0. Verified all modules and generated PlantUML/AsciiDoc diagrams under `target/spring-modulith-docs/`.

## Walkthrough
1. **Module Registry**: Spring Modulith verifies `com.acc.aio.config`, `com.acc.aio.controller`, and `com.acc.aio.worker` with explicit named interfaces for workflow REST endpoints.
2. **Ports Encapsulation**: Driving primary ports (`com.acc.worker.application.*.ports.in`, `com.acc.fs.application.ports.in`, `com.acc.workflow.ports`) and driven secondary SPI ports (`com.acc.fs.application.ports.out`) are registered as explicit `@NamedInterface("ports")` / `@NamedInterface("spi")` boundaries.
3. **Architecture Diagrams**: AsciiDoc component documentation and PlantUML component maps are generated deterministically during test execution.

## Tasks
- [x] Declare `spring-modulith-api` in `acc-fw`, `workflow-engine`, `acc-ms-fs`, `acc-ms-worker`.
- [x] Create package-info descriptors across all application modules and port packages.
- [x] Configure and verify `ModularityTests` with `Documenter` in `acc-ms-aio`.
- [x] Run full 4-tier verification matrix.
- [x] Register history entry and commit.

## Enhancement
In subsequent deployments, the generated PlantUML diagrams from `target/spring-modulith-docs` can be rendered in CI/CD pipelines to monitor structural drift on pull requests.
