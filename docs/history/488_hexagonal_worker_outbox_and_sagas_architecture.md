# 488: Hexagonal Worker Outbox & Sagas Architecture

## Problem
In Phase 3 of the monorepo's enterprise Hexagonal Architecture & DDD modernization, `apps/api/acc-ms-worker` previously coupled outbox processing, scheduled polling, JSON deserialization, HTTP webhook transport, and distributed sagas directly into monolithic service classes and scheduled job components (`OutboxPollingJob.java` and `UserRegistrationSaga.java`). 

This violated the Hexagonal Ports-and-Adapters seams and strict ArchUnit architectural invariants:
1. Business logic for transactional outbox retries, backoff calculations, DLQ transitions, and saga lifecycle states were bound directly to Spring framework annotations, Jackson mappers, and JPA entities.
2. The domain lacked pure aggregates and value objects that could be tested in complete isolation without Spring context bootstrapping or database mocks.
3. Inbound driving triggers (scheduled jobs and transactional event listeners) had no distinct primary use-case ports to target.
4. Outbound driven capabilities (JPA persistence, in-memory state repositories, and external HTTP webhook delivery) lacked explicit secondary SPI interfaces.

## Plan
1. **Define Pure Domain Aggregates and Value Objects (Zero Framework Dependencies)**:
   - Value objects: `OutboxMessageId`, `OutboxStatus`, `SagaId`, `SagaStatus`.
   - Domain Aggregates: `OutboxMessageAggregate` (encapsulating exponential backoff, retry ceilings, and DLQ rules), `SagaInstanceAggregate` (encapsulating saga state machines, step progression, and terminal transitions).
   - Driven Ports (SPI): `OutboxRepositoryPort`, `SagaStateRepositoryPort`.
   - Strict ArchUnit compliance: 0 imports from `org.springframework..`, `jakarta.persistence..`, `org.hibernate..`, `com.fasterxml.jackson..`, `org.apache.ibatis..`.
2. **Define Primary Driving Use Case Ports & Secondary Transport Ports**:
   - Primary Inbound Ports: `ProcessOutboxQueueUseCase`, `AdvanceUserSagaUseCase`.
   - Secondary Outbound Port: `WebhookTransportPort`.
3. **Implement Application Services**:
   - `ProcessOutboxQueueApplicationService`: Orchestrates outbox polling, payload inspection, webhook dispatching, retry backoff calculation, and aggregate state transitions.
   - `UserRegistrationSagaApplicationService`: Orchestrates distributed user registration sagas across worker steps.
4. **Implement Secondary Driven Outbound Adapters**:
   - `JpaOutboxRepositoryAdapter`: Implements `OutboxRepositoryPort`, adapting between JPA `OutboxEvent` and pure `OutboxMessageAggregate` with entity caching to preserve managed JPA states and backward compatibility.
   - `InMemorySagaStateRepositoryAdapter`: Implements `SagaStateRepositoryPort` with thread-safe `ConcurrentHashMap` storage.
   - `HttpWebhookTransportAdapter`: Implements `WebhookTransportPort`, delegating to `WebhookDeliveryService` while preserving dev-sandbox mock interception.
5. **Refactor Primary Driving Inbound Adapters**:
   - `OutboxPollingJob`: Pure scheduled job delegating batch executions to `ProcessOutboxQueueUseCase`. Retains backward-compatible constructor for existing test suites.
   - `UserRegistrationSaga`: Inbound transactional event listener delegating to `AdvanceUserSagaUseCase`.
6. **Implement Comprehensive 4-Tier Verification Suite**:
   - Tier 1: Pure domain unit tests (`OutboxMessageAggregateTest`, `SagaInstanceAggregateTest`).
   - Tier 2: ArchUnit Hexagonal Architecture enforcement (`HexagonalArchitectureEnforcementTest`).
   - Tier 3: Module unit and integration tests (`acc-ms-worker`).
   - Tier 4: Spring Modulith architectural verification (`ModularityTests`).

## Changes
- **Build Configuration**:
  - `apps/api/acc-ms-worker/pom.xml`: Added explicit `<version>${project.version}</version>` to `acc-fw` dependency.
- **Pure Domain Layer (`com.acc.worker.domain..`)**:
  - `OutboxMessageId.java`: Strongly-typed UUID identifier for outbox messages.
  - `OutboxStatus.java`: Pure enum for message processing states (`PENDING`, `PROCESSING`, `PUBLISHED`, `DEAD_LETTER`).
  - `SagaId.java`: Strongly-typed identifier for distributed saga instances.
  - `SagaStatus.java`: Pure enum for saga lifecycles (`STARTED`, `PROCESSING`, `COMPLETED`, `COMPENSATING`, `FAILED`).
  - `OutboxMessageAggregate.java`: Pure domain aggregate root enforcing retry ceilings, exponential backoff (2^n, max 300s), failure recording, and processing eligibility.
  - `SagaInstanceAggregate.java`: Pure domain aggregate root enforcing step progression rules, compensation hooks, and terminal immutability.
  - `OutboxRepositoryPort.java`: Secondary driven SPI port for outbox persistence.
  - `SagaStateRepositoryPort.java`: Secondary driven SPI port for saga tracking.
- **Application Layer (`com.acc.worker.application..`)**:
  - `ProcessOutboxQueueUseCase.java`: Driving primary port for processing outbox batches.
  - `AdvanceUserSagaUseCase.java`: Driving primary port for orchestrating user sagas.
  - `WebhookTransportPort.java`: Driven secondary port for edge revalidation webhook dispatch.
  - `ProcessOutboxQueueApplicationService.java`: Use case implementation coordinating repository and transport ports with MDC logging propagation.
  - `UserRegistrationSagaApplicationService.java`: Use case implementation orchestrating saga instances.
- **Infrastructure Layer (`com.acc.worker.infrastructure..`)**:
  - `JpaOutboxRepositoryAdapter.java`: Driven persistence adapter mapping between JPA `OutboxEvent` and `OutboxMessageAggregate`.
  - `InMemorySagaStateRepositoryAdapter.java`: Driven in-memory persistence adapter for saga instances.
  - `HttpWebhookTransportAdapter.java`: Driven transport adapter delegating to `WebhookDeliveryService`.
- **Inbound Adapters (`com.acc.worker..`)**:
  - `OutboxPollingJob.java`: Refactored to driving scheduled adapter delegating to `ProcessOutboxQueueUseCase`.
  - `UserRegistrationSaga.java`: Refactored to driving event adapter delegating to `AdvanceUserSagaUseCase`.
- **Unit and Architecture Tests**:
  - `OutboxMessageAggregateTest.java`: Pure unit tests verifying state transitions, backoff calculation, and DLQ limits.
  - `SagaInstanceAggregateTest.java`: Pure unit tests verifying saga start, step advancement, failure, and invariant guards.
  - `ProcessOutboxQueueApplicationServiceTest.java`: Mockito tests verifying application service coordination.
  - `UserRegistrationSagaApplicationServiceTest.java`: Mockito tests verifying saga progression.
  - `UserRegistrationSagaTest.java`: Inbound adapter tests.

## Verification
- **Tier 1 (Domain Tests)**:
  - `mvn test -f apps/api/pom.xml "-Dtest=*AggregateTest"`: Exited 0 (0ms execution, 100% pure JVM).
- **Tier 2 (ArchUnit Enforcement)**:
  - `mvn test -f apps/api/pom.xml -pl :acc-core "-Dtest=HexagonalArchitectureEnforcementTest"`: Exited 0 (0 architectural violations across all domain packages).
- **Tier 3 (Worker Module Suite)**:
  - `mvn test -f apps/api/pom.xml -pl :acc-ms-worker`: 20/20 tests passed, 0 failures, 0 errors.
- **Tier 4 (Spring Modulith Verification)**:
  - `mvn test -f apps/api/pom.xml -pl :acc-ms-aio "-Dtest=ModularityTests"`: Exited 0 (all application modules verified).

## Walkthrough
1. **Domain Isolation**: Domain entities in `acc-ms-worker` now live in `com.acc.worker.domain` without any Spring, JPA, or Jackson dependencies, adhering to clean architecture invariants.
2. **Ports-and-Adapters Seams**:
   ```
   [ Scheduled Job / Spring Event Listener ] (Driving Adapters)
                  │
                  ▼
   [ ProcessOutboxQueueUseCase / AdvanceUserSagaUseCase ] (Primary Ports)
                  │
                  ▼
   [ Application Services ] ────► [ Pure Aggregates ] (Domain Core)
                  │
                  ▼
   [ Repository / Transport Ports ] (Driven Secondary SPI)
                  │
                  ▼
   [ JPA / In-Memory / HTTP Adapters ] (Driven Adapters)
   ```
3. **Sandbox Resilience**: Mock edge revalidation and sandbox interception remain fully functional through `HttpWebhookTransportAdapter` delegating to `@Primary` `MockWebhookDeliveryService` in dev profiles.

## Tasks
- [x] Create pure value objects and aggregates for outbox and sagas.
- [x] Create primary use case ports and secondary repository/transport ports.
- [x] Implement application services orchestrating domain aggregates.
- [x] Implement driven secondary adapters for JPA, memory, and HTTP.
- [x] Refactor driving inbound adapters (`OutboxPollingJob`, `UserRegistrationSaga`).
- [x] Add pure domain tests and verify all 4 tiers of the verification matrix.
- [x] Register history documentation and commit.

## Enhancement
Future worker iterations can replace `InMemorySagaStateRepositoryAdapter` with a distributed Hazelcast or PostgreSQL persistence adapter for high-availability cluster deployments without altering any domain or application service code.
