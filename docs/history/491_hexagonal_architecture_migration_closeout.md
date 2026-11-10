# 491. Hexagonal Architecture & DDD Migration Final Closeout

## Problem Statement
The backend architecture previously exhibited classical architectural erosion across bounded contexts:
1. Framework bleeding into domain kernels (`acc-core` importing Spring `ApplicationContext` via `SpringMediator`).
2. Production repository stubs in IAM (`UserRepositoryImpl.findByEmail` returning empty Optional).
3. Competing sources of truth with in-memory fallbacks (`TaskDefinitionRegistry.inMemoryFallbacks`).
4. Servlet API pollution in business services (`FileService` importing `HttpServletRequest`).
5. Permissive module boundaries in Spring Modulith without explicit `@NamedInterface` package encapsulation.
6. Ad-hoc client-side mocks and un-cancellable asynchronous API calls.

## Plan & Execution
A phased 4-phase, 4-tier migration was architected and executed to completion:
- **Phase 1: Pure Domain Kernel & IAM Foundation**
  - Hardened `acc-core` as a 100% pure Java DDD kernel (`AggregateRoot`, `DomainEvent`, `ValueObject`).
  - Relocated `SpringMediator` to `com.acc.fw.mediator.SpringMediator` in `acc-fw`.
  - Built pure `UserAggregate`, `UserId`, `UserStatus` and implemented `UserMapper.xml` targeting `unipost_identity_user`.
  - Added ArchUnit bytecode enforcement test (`HexagonalArchitectureEnforcementTest`).
  - *Committed under `e4d77685` (History 486).*
- **Phase 2: Seam Decoupling & In-Memory Removal**
  - Removed `inMemoryFallbacks` from `TaskDefinitionRegistry`, binding to PostgreSQL persistence seams.
  - Decoupled REST controllers from direct repository SPIs into explicit Use Cases (`CreateTaskDefinitionUseCase`, `PromoteTaskDefinitionUseCase`, etc.).
  - Built pure `PureDecider` DAG engine without Spring or database dependencies.
  - Resolved dev sandbox startup reflection issues in `acc-ms-aio`.
  - *Committed under `4b1897d9` (History 487).*
- **Phase 3: File Storage & Worker Hexagonalization**
  - Modeled `FsObjectAggregate` and `UploadFileCommand` with non-blocking streaming.
  - Created `OutboxMessageAggregate` and `SagaInstanceAggregate` with pure lifecycle invariants.
  - Declared secondary Driven Ports for `OutboxRepositoryPort`, `SagaStateRepositoryPort`, and `BlobStoragePort`.
  - Created outbound adapters: `QuartzOutboxDispatcherAdapter`, `RedisSagaRepositoryAdapter`.
  - *Committed under `9ed21275` (History 488).*
- **Phase 4: Spring Modulith Package Encapsulation & Console Seams**
  - Annotated `package-info.java` across `acc-ms-aio`, `acc-ms-fs`, and `acc-ms-worker` with `@ApplicationModule(type = OPEN)` and `@NamedInterface("ports")` / `@NamedInterface("workflow")`.
  - Upgraded Modulith verification with `ApplicationModules` and `Documenter` generating live AsciiDoc/PlantUML module canvases.
  - Established WinterTC ECMA-429 compliant `TaskDefinitionGatewayPort` accepting `signal?: AbortSignal` in `@acc/console`.
  - *Committed under `12fcba0a` (History 489).*
- **Tier 3 Persistence Verification**
  - Implemented and verified live PostgreSQL contract tests across `UserRepositoryMyBatisTest`, `TaskDefRepositoryMyBatisTest`, and `FsObjectRepositoryMyBatisTest`.
  - Verified JSONB schema handlers (`MapJsonbTypeHandler`, `StringSetJsonbTypeHandler`).
  - *Committed under `ef3e2a48` (History 490).*

## Changes Summary Across Repositories
- **Kernel (`acc-core`)**: Pure domain types, zero framework dependencies, ArchUnit test suite.
- **Framework & IAM (`acc-fw`)**: `UserAggregate`, `UserMapper.xml`, `UserRepositoryMyBatisTest`, `SpringMediator` relocation.
- **Workflow (`workflow-engine`)**: `TaskDefinitionAggregate`, `PureDecider`, `TaskDefinitionMapper.xml`, `TaskDefRepositoryMyBatisTest`.
- **File Storage (`acc-ms-fs`)**: `FsObjectAggregate`, `FsObjectMapper.xml`, `MyBatisFsObjectRepositoryAdapter`, `FsObjectRepositoryMyBatisTest`.
- **Worker (`acc-ms-worker`)**: `OutboxMessageAggregate`, `SagaInstanceAggregate`, `QuartzOutboxDispatcherAdapter`, `RedisSagaRepositoryAdapter`.
- **AIO Host (`acc-ms-aio`)**: `package-info.java` boundaries, `ModularityTests` AsciiDoc canvas generator.
- **Console (`apps/console`)**: `TaskDefinitionGatewayPort`, `HttpTaskDefinitionGatewayAdapter` with WHATWG `AbortSignal` cancellation.

## Verification
- **Tier 1 (Pure Domain Unit Tests)**:
  `mvn test -Dtest=*AggregateTest -q` -> **100% Pass** (0 Spring boots, pure domain invariants).
- **Tier 2 (ArchUnit Enforcement)**:
  `mvn test -pl :acc-core -Dtest=HexagonalArchitectureEnforcementTest -q` -> **100% Pass** (zero framework imports in `..domain..`).
- **Tier 3 (PostgreSQL MyBatis Contract Tests)**:
  `mvn test -pl :acc-fw,:workflow-engine,:acc-ms-fs -Dtest=*MyBatisTest -q` -> **100% Pass** (live PostgreSQL execution).
- **Tier 4 (Modulith Verification & Console Vitest)**:
  `mvn test -pl :acc-ms-aio -Dtest=ModularityTests -q` -> **100% Pass** (clean module boundaries).
  `pnpm --filter @acc/console exec vitest run src/features/workflows/__tests__/` -> **100% Pass** (11/11 tests pass).

## Walkthrough & Architectural Artifacts
- Master Plan: [`master_implementation_plan_iteration_87.md`](file:///c:/Users/Admin/workspace/git/acc/docs/iterations/master_implementation_plan_iteration_87.md)
- Backend Plan: [`apps/backend/doc/implementation_plan_166.md`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/doc/implementation_plan_166.md)
- Console Plan: [`apps/console/doc/implementation_plan_176.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/implementation_plan_176.md)
- Technical Specification Artifact: [`hexagonal_architecture_and_ddd_migration_plan.md`](file:///c:/Users/Admin/.gemini/antigravity/brain/f10cce1a-c362-4eb9-b89a-360213e357f4/hexagonal_architecture_and_ddd_migration_plan.md)
