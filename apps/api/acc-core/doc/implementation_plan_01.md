# Architecture Blueprint: Clean Architecture & CQRS Refactoring

## 1. Design Strategy
**Goal:** Introduce strict boundaries between core domain logic and infrastructure using Clean Architecture and CQRS patterns.

**Chosen Patterns & Rationale:**
- **Clean Architecture:** To strictly decouple the core domain logic (Entities, Use Cases) from external concerns (Frameworks, DBs, UI). The domain relies on nothing; outer layers rely on the domain.
- **CQRS (Command Query Responsibility Segregation):** Separates write operations (Commands) from read operations (Queries). This optimizes performance, simplifies complex queries, and avoids polluting domain models with read-specific DTO logic.
- **Mediator (via Command/Query Dispatchers):** Decouples controllers from specific handlers. Controllers just dispatch a Command or Query object, and the Mediator routes it to the correct handler.
- **Repository Pattern & Dependency Injection:** Abstracts data access. The domain layer defines Repository interfaces, and the infrastructure layer implements them (e.g., using Spring Data JPA).

## 2. Architecture Structure
**Domain Layer (Core)**
- `com.acc.identity.domain.user.repository`: Repository Interfaces.

**Application Layer (Use Cases)**
- `com.acc.identity.app.user.command`: Command records and Command Handlers.
- `com.acc.core.mediator`: Core interfaces for `CommandDispatcher`, `QueryDispatcher`, etc.

**Infrastructure Layer (Adapters)**
- `com.acc.identity.infra.user.repository`: Spring Data JPA implementations of domain repositories, wrapping `com.acc.user.repository.jpa.UserRepository`.
- `com.acc.core.mediator.SpringMediator`: Spring-based implementation of dispatchers utilizing `ResolvableType`.

**Presentation Layer (Web)**
- `com.acc.identity.web.user.controller`: REST Controllers dispatching commands/queries (`UserCQRSController`).

## 3. Implementation: Proof-of-Concept (User Registration)
The PoC introduces a `RegisterUserCommand` which is handled by `RegisterUserCommandHandler`. It utilizes the `UserRepository` interface which is implemented in the `UserRepositoryImpl` infrastructure class. The web layer is managed by the `UserCQRSController`.

## 4. Extensibility (OCP)
The Open/Closed Principle is naturally enforced through the combination of CQRS and the Mediator pattern.
- **Adding New Features:** To add a new feature, you simply create a new Command and a corresponding CommandHandler.
- **Zero Modification:** You do not need to modify existing services, handlers, or controllers. The Mediator automatically discovers and routes the new command to the new handler based on its type signature.
