# Architecture Blueprint: Clean Architecture & CQRS Refactoring

## 1. Design Strategy
**Chosen Patterns & Rationale:**
- **Clean Architecture:** To strictly decouple the core domain logic (Entities, Use Cases) from external concerns (Frameworks, DBs, UI). The domain relies on nothing; outer layers rely on the domain.
- **CQRS (Command Query Responsibility Segregation):** Separates write operations (Commands) from read operations (Queries). This optimizes performance, simplifies complex queries, and avoids polluting domain models with read-specific DTO logic.
- **Mediator (via Command/Query Dispatchers):** Decouples controllers from specific handlers. Controllers just dispatch a Command or Query object, and the Mediator routes it to the correct handler.
- **Repository Pattern & Dependency Injection:** Abstracts data access. The domain layer defines Repository interfaces, and the infrastructure layer implements them (e.g., using Spring Data JPA).

## 2. Architecture Structure
The refactoring applies a layered structure per bounded context (e.g., `identity`, `article`):

**Domain Layer (Core)**
- `com.acc.domain.[context].model`: Entities, Value Objects, Aggregates.
- `com.acc.domain.[context].repository`: Repository Interfaces.
- `com.acc.domain.[context].exception`: Domain-specific exceptions.

**Application Layer (Use Cases)**
- `com.acc.app.[context].command`: Command records and Command Handlers.
- `com.acc.app.[context].query`: Query records and Query Handlers.
- `com.acc.app.shared.mediator`: Interfaces for `CommandDispatcher` and `QueryDispatcher`.

**Infrastructure Layer (Adapters)**
- `com.acc.infra.[context].repository`: Spring Data JPA implementations of domain repositories.
- `com.acc.infra.[context].entity`: JPA Entities (mapped to/from Domain Entities).
- `com.acc.infra.shared.mediator`: Spring-based implementation of dispatchers.

**Presentation Layer (Web)**
- `com.acc.web.[context].controller`: REST Controllers dispatching commands/queries.

## 3. Implementation: Proof-of-Concept (User Registration)

### Application Layer (Mediator & Command)
```java
public interface Command<R> {}

public interface CommandHandler<C extends Command<R>, R> {
    R handle(C command);
}

public interface CommandDispatcher {
    <R, C extends Command<R>> R dispatch(C command);
}

// Command
public record RegisterUserCommand(String username, String email) implements Command<UserId> {}

// Command Handler
@Service
public class RegisterUserCommandHandler implements CommandHandler<RegisterUserCommand, UserId> {
    private final UserRepository repository;

    public RegisterUserCommandHandler(UserRepository repository) {
        this.repository = repository;
    }

    @Override
    public UserId handle(RegisterUserCommand command) {
        // Business logic & validation
        if (repository.existsByEmail(command.email())) {
            throw new DuplicateEmailException(command.email());
        }
        User user = User.create(command.username(), command.email());
        return repository.save(user).getId();
    }
}
```

### Domain Layer (Entity & Repository)
```java
public class User {
    private final UserId id;
    private final String username;
    private final String email;

    private User(UserId id, String username, String email) {
        this.id = id;
        this.username = username;
        this.email = email;
    }

    public static User create(String username, String email) {
        return new User(UserId.generate(), username, email);
    }
    // getters
}

public interface UserRepository {
    User save(User user);
    boolean existsByEmail(String email);
}
```

### Presentation Layer (Controller)
```java
@RestController
@RequestMapping("/api/users")
public class UserController {
    private final CommandDispatcher commandDispatcher;

    public UserController(CommandDispatcher commandDispatcher) {
        this.commandDispatcher = commandDispatcher;
    }

    @PostMapping
    public ResponseEntity<UserId> register(@RequestBody RegisterUserRequest request) {
        var command = new RegisterUserCommand(request.username(), request.email());
        UserId id = commandDispatcher.dispatch(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(id);
    }
}
```

## 4. Extensibility (OCP)
The Open/Closed Principle is naturally enforced through the combination of CQRS and the Mediator pattern.
- **Adding New Features:** To add a new feature (e.g., `UpdateUserEmail`), you simply create a new `UpdateUserEmailCommand` and a corresponding `UpdateUserEmailCommandHandler`.
- **Zero Modification:** You do not need to modify existing services, handlers, or controllers. The Mediator automatically discovers and routes the new command to the new handler based on its type signature via Spring's dependency injection mechanisms.
- **Cross-Cutting Concerns:** Validation, logging, and metrics can be added via Decorator pattern or AOP around the `CommandDispatcher` without modifying the core handlers.
