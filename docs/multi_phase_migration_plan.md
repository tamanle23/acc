# Comprehensive Multi-Phase Architectural Migration Plan

This plan details the phased strategy for refactoring the `@acc` monorepo toward a modern, highly maintainable, and fully decoupled software architecture leveraging Clean Architecture, CQRS, Mediator, and Event Sourcing patterns.

## Goal
Deliver a scalable and extensible system adhering to SOLID, DRY, and KISS principles.

---

## Phase 1: Foundational Abstractions & Strategy Alignment (Current)
**Objective**: Establish core interfaces and baseline patterns without rewriting entire subsystems. Prove out patterns on an isolated slice.
1. **Define the Core Domain (`acc-core`)**:
   - Establish `Command`, `CommandHandler`, `Query`, `QueryHandler`, and the `SpringMediator` dispatchers.
   - Introduce Domain concepts: `AggregateRoot`, `DomainEvent`.
2. **Identity Domain PoC (`acc-ms-identity`)**:
   - Apply the Clean Architecture structure to the `user` context.
   - Implement `UserRepository` domain interface and adapt it in infrastructure (Spring Data JPA).
   - Implement a specific use-case (`RegisterUserCommand`) and wire it via CQRS.
3. **Frontend Architecture Standards**:
   - Establish foundational UI patterns (Facade) to decouple React components from networking/state logic.

---

## Phase 2: Complete Identity Bounded Context Migration
**Objective**: Fully decouple the first major subsystem from the legacy, monolithic Spring MVC controller structure.
1. **CQRS Transition**:
   - Migrate all existing User management logic (create, update, delete, deactivate) to Commands.
   - Migrate all User retrieval operations (search, fetch by ID, role assignment queries) to Queries.
2. **Infrastructure Adaptation**:
   - Move all JPA Repositories to the `infrastructure` layer and ensure they only implement interfaces defined in the `domain` layer.
3. **Deprecation**:
   - Deprecate old monolithic `UserService` and `UserFacade` implementations.

---

## Phase 3: Monolith to Modulith Event-Driven Decoupling
**Objective**: Break down tight coupling between internal microservices/modules using Event Sourcing and the Saga pattern.
1. **Module Independence**:
   - Remove direct dependencies between `ms-identity`, `ms-worker`, `ms-fs`, and `ms-aio`.
2. **Saga Orchestration**:
   - Implement Sagas for cross-module operations (e.g., User is created in `identity`, causing a profile setup in `aio`, generating default resources in `fs`).
3. **Event Bus**:
   - Utilize Spring Modulith's application event publication registry to guarantee event delivery across boundaries.

---

## Phase 4: Frontend and Shared UI Architecture Overhaul
**Objective**: Guarantee UI/UX consistency (Liquid Glass) and architectural separation of concerns on the client side.
1. **Liquid Glass UI System (`@acc/ui`)**:
   - Implement standardized presentation components (`GlassCard`, `GlassButton`) adhering to design standards.
2. **State Decoupling (`console` & `tekgo-ui`)**:
   - Refactor screens to exclusively use Mediator-style dispatch hooks (Zustand + TanStack Query) rather than inline fetch/axios logic.
3. **Internationalization (i18n) Synchronization**:
   - Consolidate all shared translation keys into `packages/i18n/src/locales` and app-specific keys locally.

---

## Conclusion
Executing this plan sequentially ensures system stability while steadily increasing modularity and conformance to Clean Architecture principles.
