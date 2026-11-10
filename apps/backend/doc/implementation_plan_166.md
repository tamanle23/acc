# Backend Implementation Plan - Iteration 166
# Enterprise Hexagonal Architecture & DDD Ports-and-Adapters Migration for Whole Backend

**Companion Master Plan:** [`docs/iterations/master_implementation_plan_iteration_87.md`](file:///c:/Users/Admin/workspace/git/acc/docs/iterations/master_implementation_plan_iteration_87.md)  
**Target Modules:** Whole `@acc/backend` ecosystem ([`workflow-engine`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine), [`acc-ms-fs`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-fs), [`acc-fw`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw), [`acc-ms-worker`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-worker), [`acc-ms-aio`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio), [`acc-core`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-core))

---

## 1. Executive Summary

This plan details the full monorepo backend refactoring to isolate pure domain logic from Spring Boot, Jakarta Persistence, Hibernate, and Jackson libraries across all bounded contexts in `apps/backend`:
1. **Workflow Engine (`workflow-engine`):** `TaskDefinitionAggregate` and `WorkflowExecutionAggregate`.
2. **File Storage Subsystem (`acc-ms-fs`):** `FsObjectAggregate`, `FileQuota`, and `Checksum` VOs, eliminating `HttpServletRequest` and Jakarta Servlet imports from business services.
3. **Identity & User Management (`acc-fw`):** Pure `UserAggregate` and `TenantAggregate` replacing legacy JPA/Hibernate base models (`UserBaseModel`), and fixing the live `findByEmail` stub in `UserRepositoryImpl.java`.
4. **Worker, Sagas & Outbox (`acc-ms-worker`):** Scheduled Driving Adapters delegating to Driving Ports for transactional outbox dispatch and distributed sagas (`UserRegistrationSaga`).
5. **Platform Kernel (`acc-core`, `acc-fw`):** Relocation of `SpringMediator` to `acc-fw` to ensure `acc-core` is 100% framework-free, pure DDD primitives, reusable MyBatis `JsonbTypeHandler<T>`, and centralized domain error handling via `GlobalExceptionHandler`.

---

## 2. Whole-Backend Phased Technical Implementation

### Phase 1: Shared Kernel, Driven Ports & Central Error Handling
- **`acc-core`:**
  - Relocate `SpringMediator.java` to `com.acc.fw.mediator.SpringMediator` in `acc-fw`.
  - Enrich pure DDD base types (`AggregateRoot`, `DomainEvent`, `ValueObject`). Pure CQRS interfaces (`Command`, `Query`).
- **`acc-fw`:**
  - Create reusable `JsonbTypeHandler<T>` in `com.acc.fw.mybatis.typehandler`.
  - Extend `GlobalExceptionHandler` with `@ExceptionHandler` methods for pure domain exceptions (`EntityNotFoundException`, `ImmutableVersionConflictException`, `DomainValidationException`).
- **ArchUnit Enforcement:**
  - Implement `HexagonalArchitectureEnforcementTest.java` in `acc-core` asserting that all `com.acc..domain..` packages have zero dependencies on `org.springframework..`, `jakarta.persistence..`, `org.hibernate..`, `com.fasterxml.jackson..`, or `org.apache.ibatis..`.
- **Declare Driven Ports (SPIs):**
  - Workflow: `TaskDefinitionRepositoryPort`, `WorkflowExecutionRepositoryPort`, `WorkerTransportPort`.
  - File Storage: `FsObjectRepositoryPort`, `BlobStoragePort` (S3/Disk), `AntivirusScannerPort`.
  - IAM: `UserRepositoryPort`, `TenantRepositoryPort`, `PasswordEncoderPort`.
  - Worker: `OutboxRepositoryPort`, `SagaStateRepositoryPort`.

### Phase 2: Pure Domain Core Extraction Across Contexts
- **Workflow Engine:** `TaskDefinitionAggregate` with version bumping ($f_{version}$) and `WorkflowExecutionAggregate`.
- **File Storage (`acc-ms-fs`):** `FsObjectAggregate` encapsulating storage keys, checksum validation, and quotas without Jakarta annotations.
- **Identity & User (`acc-fw`):** `UserAggregate` and `TenantAggregate` encapsulating authentication state, roles, and password hashing.
- **Test Doubles:** Create `InMemory*RepositoryAdapter` test doubles for each context for instant (<50ms) unit testing.

### Phase 3: Outbound MyBatis XML Adapters & Driving REST Adapters
- **MyBatis XML Mappers:**
  - `TaskDefinitionMapper.xml` in `workflow-engine/src/main/resources/mapper/`
  - `FsObjectMapper.xml` in `acc-ms-fs/src/main/resources/mapper/`
  - `UserMapper.xml` in `acc-fw/src/main/resources/mapper/` (including live query for `selectByEmail`)
- **Outbound Adapters:**
  - `MyBatisTaskDefinitionRepositoryAdapter`
  - `MyBatisFsObjectRepositoryAdapter` & `S3BlobStorageAdapter`
  - `MyBatisUserRepositoryAdapter` (replaces JPA `UserRepositoryImpl` stub)
  - `SpringModulithOutboxDispatcherAdapter`
- **Inbound Driving REST Adapters:**
  - Refactor `WorkflowExecutionController`, `TaskDefinitionController`, `FileSystemController`, and `UserController` into pure Inbound Adapters: convert HTTP requests -> Commands -> call Driving Use Cases -> map Views to REST DTOs.
  - Decouple cross-controller calls using Spring Modulith `@ApplicationModuleListener` and event outbox.

### Phase 4: Spring Modulith Verification & Pruning
- Add `package-info.java` with `@ApplicationModule` and `@NamedInterface("ports")` to each module.
- Retire legacy in-memory map fallbacks, deprecated `UserService`, and dead JPA stubs.
- Execute full 4-tier verification matrix.

---

## 3. Formal Verification Commands
```bash
# 1. Pure domain aggregate test suite across all bounded contexts (<100ms)
mvn test -Dtest=*AggregateTest -q

# 2. ArchUnit whole-backend architecture enforcement
mvn test -pl :acc-core -Dtest=HexagonalArchitectureEnforcementTest -q

# 3. Persistence contract parity tests (MyBatis XML vs InMemory)
mvn test -Dtest=*RepositoryContractTest -q

# 4. Spring Modulith module verification in acc-ms-aio
mvn test -pl :acc-ms-aio -Dtest=ModuleStructureTests -q
```
