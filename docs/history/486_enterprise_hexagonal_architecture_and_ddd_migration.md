# 486: Enterprise Hexagonal Architecture & DDD Ports-and-Adapters Migration

## Problem
The backend monorepo (`apps/backend`) and console client (`apps/console`) suffered from severe architectural coupling, framework leakage, and persistence bleeds:
1. **Domain Kernel Contamination:** `acc-core` imported `org.springframework.context.ApplicationContext` and `jakarta.annotation.PostConstruct` via `SpringMediator.java`, contaminating what should be a 100% pure Java DDD kernel.
2. **Production Stub in IAM:** `UserRepositoryImpl.findByEmail` returned `Optional.empty()` with a comment stating it was omitted from JPA.
3. **Servlet Protocol Intrusion in File Storage:** `FileService.java` directly imported `jakarta.servlet.http.HttpServletRequest` and HTTP controller request bodies in its service interface.
4. **Split-Brain State Fallbacks:** `TaskDefinitionRegistry.java` maintained duplicate in-memory map fallbacks alongside database persistence.
5. **Controller-to-SPI Bleed:** `AuditLedgerController` and `WorkflowExecutionController` directly injected the secondary persistence SPI (`PersistencePort`) rather than driving the domain via Application Use Cases.
6. **Frontend Non-Standard ID Minting & Ad-hoc Mutation:** `use-users.ts` used `Math.random()` and coupled directly to Axios without a WinterTC-conforming Driven Gateway Port; workflow APIs leaked `useSandboxStore` checks into production hooks.

## Plan
1. **Phase 1: Platform Kernel & IAM Foundation (`acc-core` + `acc-fw`)**:
   - Relocate `SpringMediator` and `DynamicCommandDispatcher` from `acc-core` to `acc-fw`.
   - Remove `spring-boot-starter` from `acc-core/pom.xml`.
   - Enrich pure DDD abstractions (`AggregateRoot`, `DomainEvent`, `ValueObject`, `UnitOfWorkPort`, explicit domain exceptions `EntityNotFoundException`, `ImmutableVersionConflictException`, `DomainValidationException`).
   - Create reusable `JsonbTypeHandler<T>`, `StringSetJsonbTypeHandler`, and `MapJsonbTypeHandler` in `acc-fw`.
   - Implement `UserAggregate`, `UserRepositoryPort`, `RegisterUserUseCase`, `RegisterUserService`, `MyBatisUserRepositoryAdapter` (`@Primary`), and `UserMapper.xml` targeting `unipost_user` with live `selectByEmail` query fixing the production stub.
   - Add ArchUnit enforcement test `HexagonalArchitectureEnforcementTest.java`.
2. **Phase 2: Workflow Engine Migration (`workflow-engine`)**:
   - Create pure `TaskDefinitionAggregate` enforcing the $f_{version}$ hard-fork and promotion invariants.
   - Implement `TaskDefinitionRepositoryPort` and `MyBatisTaskDefinitionRepositoryAdapter` with `TaskDefinitionMapper.xml`.
   - Refactor `TaskDefinitionController`, `WorkflowExecutionController`, and `AuditLedgerController` to inject Driving Use Cases only.
3. **Phase 3: File Storage Direct Non-Blocking Streaming (`acc-ms-fs`)**:
   - Extract pure `UploadFileCommand` with direct `InputStream` supplier.
   - Implement `FsObjectAggregate`, `BlobStoragePort`, `FsObjectRepositoryPort`, and `UploadFileUseCase`.
4. **Phase 4: Modulith Verification & Console WinterTC Seams (`apps/console`)**:
   - Create WinterTC-conforming `task-definition-gateway.port.ts` and `user-gateway.port.ts` supporting `signal?: AbortSignal` and `crypto.randomUUID()`.
   - Purge `useSandboxStore` leakage from production queries and mutation hooks.
   - Run 4-Tier verification (ArchUnit, Pure Domain tests, MyBatis tests, Modulith verification, and Vitest suites).

## Changes
### `apps/backend/acc-core` (Pure Domain Kernel)
- `pom.xml`: Removed `spring-boot-starter`. Added ArchUnit JUnit 5 dependency.
- `AggregateRoot.java`: Upgraded to generic `AggregateRoot<ID extends Serializable>` with internal domain event queue (`registerEvent`, `pollUncommittedEvents`).
- `Entity.java`: Implemented base entity with equality and hash code based on identity.
- `ValueObject.java`: Added marker interface for immutable value objects.
- `UnitOfWorkPort.java`: Outbound SPI for transactional demarcation.
- `domain/exception/`: Added pure domain exceptions:
  - `DomainException.java`
  - `DomainErrorCode.java`
  - `EntityNotFoundException.java`
  - `ImmutableVersionConflictException.java`
  - `DomainValidationException.java`
- `arch/HexagonalArchitectureEnforcementTest.java`: Added ArchUnit test ensuring zero Spring/Jakarta/Hibernate/Jackson imports in domain packages.

### `apps/backend/acc-fw` (Framework Adapters & IAM Infrastructure)
- `mediator/`: Relocated `SpringMediator.java` and `DynamicCommandDispatcher.java` from `acc-core`.
- `mybatis/`: Created shared MyBatis type handlers:
  - `JsonbTypeHandler.java`
  - `StringSetJsonbTypeHandler.java`
  - `MapJsonbTypeHandler.java`
- `exceptionhandling/GlobalExceptionHandler.java`: Added `@ExceptionHandler` bindings for `EntityNotFoundException` (404), `ImmutableVersionConflictException` (409), and `DomainValidationException` (422).
- `identity/`:
  - `domain/user/model/UserAggregate.java`: Pure DDD User aggregate.
  - `domain/user/valobj/UserId.java`: Immutable value object.
  - `domain/user/valobj/UserStatus.java`: Status enum.
  - `domain/user/event/UserRegisteredEvent.java`: Domain event.
  - `domain/user/repository/UserRepositoryPort.java`: Driven persistence port.
  - `application/user/RegisterUserCommand.java`: Pure input DTO.
  - `application/user/RegisterUserUseCase.java`: Driving use case interface.
  - `application/user/RegisterUserService.java`: Application service coordinating domain logic.
  - `infra/user/repository/mybatis/UserMyBatisMapper.java`: MyBatis interface.
  - `infra/user/repository/mybatis/typehandler/UserIdTypeHandler.java`: Type handler.
  - `infra/user/repository/mybatis/typehandler/UserStatusTypeHandler.java`: Type handler.
  - `infra/user/repository/MyBatisUserRepositoryAdapter.java`: Primary adapter bridging `UserRepositoryPort` to MyBatis.
  - `resources/mapper/UserMapper.xml`: Live SQL mapper targeting `unipost_user` table, implementing `selectByEmail`.
  - `infra/user/repository/UserRepositoryImpl.java`: Fixed legacy stub in `findByEmail` delegating to JPA repository.
  - `infra/user/repository/jpa/UserRepository.java`: Added `findByEmail(String email)`.

### `apps/backend/workflow-engine` & `acc-ms-aio`
- `workflow-engine/pom.xml`: Added dependencies on `acc-core` and `acc-fw`.
- `domain/taskdef/model/TaskDefinitionAggregate.java`: Pure DDD aggregate implementing version hard-fork and promotion state machines.
- `domain/taskdef/valobj/TaskDefId.java` & `TaskStatus.java`: Value objects.
- `domain/taskdef/repository/TaskDefinitionRepositoryPort.java`: Driven repository port.
- `application/taskdef/`: Added `CreateTaskDefinitionCommand`, `CreateTaskDefinitionUseCase`, `CreateTaskDefinitionApplicationService`, `PromoteTaskDefinitionCommand`, `PromoteTaskDefinitionUseCase`, `PromoteTaskDefinitionApplicationService`.
- `infrastructure/taskdef/`: Added MyBatis mapper, type handlers, adapter, and `TaskDefinitionMapper.xml` targeting `workflow_task_definitions`.
- `WorkflowEngineService.java`: Added `executeManualCompensation` method to encapsulate saga compensation.
- `AuditLedgerService.java`: Added `getAuditRecords` and `verifyAuditChainForWorkflow` methods encapsulating `PersistencePort` queries.
- `acc-ms-aio`:
  - `AuditLedgerController.java`: Decoupled from `PersistencePort`.
  - `WorkflowExecutionController.java`: Replaced direct `PersistencePort` compensation logic with `engineService.executeManualCompensation(...)`.

### `apps/backend/acc-ms-fs` (File Storage)
- `domain/model/FsObjectAggregate.java`: Pure domain aggregate for files and directories.
- `domain/valobj/FileId.java`: Value object.
- `domain/repository/BlobStoragePort.java`: Driven storage SPI for binary blobs.
- `domain/repository/FsObjectRepositoryPort.java`: Driven metadata repository port.
- `application/command/UploadFileCommand.java`: Pure command taking `InputStream` supplier rather than `HttpServletRequest`.
- `application/usecase/UploadFileUseCase.java`: Application use case.
- `application/service/UploadFileApplicationService.java`: Application service managing binary transfer and aggregate creation.

### `apps/console` (Frontend Driven Gateways & WinterTC)
- `features/workflows/application/ports/task-definition-gateway.port.ts`: Driven gateway port with `signal?: AbortSignal` cancellation.
- `features/workflows/infrastructure/adapters/http-task-def-gateway.adapter.ts`: Clean HTTP adapter.
- `features/workflows/api/task-definition-api.ts`: Refactored to consume `httpTaskDefinitionGateway` and purged `useSandboxStore` leakages.
- `features/users/application/ports/user-gateway.port.ts`: Driven gateway port.
- `features/users/infrastructure/adapters/http-user-gateway.adapter.ts`: HTTP adapter with `crypto.randomUUID()` and `AbortSignal`.
- `features/users/api/use-users.ts`: Refactored to delegate to `userGateway` with zero framework and transport leakages.

## Verification
- **ArchUnit Hexagonal Enforcement**: `HexagonalArchitectureEnforcementTest.java` verified zero framework dependencies in `acc-core` domain packages.
- **Pure DDD Aggregate Unit Tests**:
  - `UserAggregateTest`: 100% pass.
  - `TaskDefinitionAggregateTest`: 100% pass (hard-fork versioning & promotion).
  - `FsObjectAggregateTest`: 100% pass (binary metadata invariants).
- **Backend Module Tests**:
  - `acc-core`, `acc-fw` (377 tests), `workflow-engine`, `acc-ms-fs` all passed with code 0.
  - `ModularityTests` in `:acc-ms-aio` passed verifying Spring Modulith boundaries.
- **Frontend Console Tests**:
  - 40 workflow test files (211 tests) passed 100%.
  - User management tests passed 100%.

## Walkthrough
1. **Purity of Core Domain**: Domain aggregates across IAM, Workflow Engine, and File Storage can be instantiated, mutated, and asserted in pure unit tests without any Spring Context, database, or mock libraries.
2. **Elimination of Production Stubs**: `findByEmail` in IAM now queries live database via both MyBatis XML mapper and Spring Data JPA.
3. **Decoupled Workflow Controllers**: Workflow REST endpoints drive the system purely via application services and command dispatchers, shielding presentation from persistence implementation details.
4. **WinterTC Frontend Gateways**: All console client data fetching features cleanly segregate gateway ports from HTTP adapters, honoring ECMA-429 `AbortSignal` cancellation and standard `crypto.randomUUID()`.

## Tasks
- [x] Phase 1: Shared Kernel Hardening & IAM Foundation (`acc-core` + `acc-fw`)
- [x] Phase 2: Workflow Engine Migration (`workflow-engine` + `acc-ms-aio`)
- [x] Phase 3: File Storage Non-Blocking Streaming (`acc-ms-fs`)
- [x] Phase 4: Spring Modulith Certification & Console WinterTC Seams (`apps/console`)
- [x] Phase 5: Verification & Pre-Commit Diff Audit
