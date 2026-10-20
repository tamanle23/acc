---
name: spring-boot-backend
description: Design, implement, and verify Java Spring Boot backend services, REST and GraphQL APIs, Spring Data JPA or MyBatis persistence layers, Flyway or Liquibase migrations, and Spring Security or Modulith architectures. Use when the user asks to build or refactor Spring Boot endpoints, entities, DTOs, services, database schemas, or backend business logic.
---
# Spring Boot Backend

Design and build production-grade Java Spring Boot backend features using strict layered or modular architectures, immutable DTO contracts, safe transaction boundaries, and automated build verification.

## When to Use

- Creating or refactoring Spring Boot REST controllers, GraphQL resolvers (`@Controller` / `@QueryMapping`), or API contracts
- Designing JPA `@Entity` models, Spring Data repositories, MyBatis mappers, or Flyway/Liquibase migrations
- Implementing `@Service` business logic, `@Transactional` boundaries, or Spring Modulith domain events
- Configuring Spring Security filter chains, JWT/OAuth2 authentication, or method-level authorization
- Standardizing exception handling with `@RestControllerAdvice` and RFC 7807 `ProblemDetail`

## Steps

### 1. Inspect Build Configuration and Architecture

Before generating code, examine `pom.xml` or `build.gradle` (`.kts`) and existing package structures to match the repository's conventions:

- **Java & Spring Boot Version:** Check the Java version (e.g., Java 21+) and confirm Spring Boot 3.x+ (`jakarta.*` imports, never legacy `javax.*`).
- **Architecture Style:** Identify whether the project uses package-by-feature / Spring Modulith (`com.example.order`, `com.example.inventory`) or traditional layered packages (`controller`, `service`, `repository`, `domain`). Preserve module boundaries and avoid circular dependencies.
- **Persistence & Tooling:** Detect whether the project uses Spring Data JPA, MyBatis, jOOQ, Flyway (`src/main/resources/db/migration`), Liquibase, Lombok, or MapStruct.

### 2. Design the Data & Migration Layer

When introducing or modifying database tables:

- **Schema First:** Create a versioned migration script (e.g., `V<next>__<description>.sql` for Flyway) rather than relying on `spring.jpa.hibernate.ddl-auto=update`.
- **Entity Hygiene:**
  - Never use Lombok `@Data` on `@Entity` classes; it generates `equals()`, `hashCode()`, and `toString()` across all fields, triggering unintended lazy-loading queries and breaking Hibernate Set collections. Use explicit `@Getter`, `@Setter`, and ID-based `equals`/`hashCode`.
  - Default all `@ManyToOne` and `@OneToOne` associations to `FetchType.LAZY` (`@ManyToOne(fetch = FetchType.LAZY)`).
  - Prevent N+1 queries in repositories by using `@EntityGraph`, `JOIN FETCH` JPQL queries, or interface/record projections.

### 3. Implement Service & Transaction Boundaries

Encapsulate business rules inside `@Service` components using constructor injection:

- **Constructor Injection:** Declare dependencies as `private final` fields (or use `@RequiredArgsConstructor` if Lombok is present). Never use `@Autowired` field injection.
- **Transaction Scope:**
  - Annotate read-heavy services with `@Transactional(readOnly = true)` at the class level, and override with `@Transactional` on mutating methods.
  - Never perform external HTTP/RPC calls, file I/O, or slow message broker publishing inside an open database `@Transactional` block to avoid exhausting the HikariCP connection pool.
  - When publishing domain events in modular monoliths, use `ApplicationEventPublisher` with `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)` or `@ApplicationModuleListener`.

### 4. Build the API & Validation Layer

Keep controllers thin and strictly decoupled from persistence models:

- **Immutable DTOs:** Use Java `record` types for all request payloads and response bodies. Never accept or return JPA `@Entity` classes directly in `@RestController` or GraphQL handlers.
- **Input Validation:** Annotate request bodies with `@Valid` and apply Jakarta Bean Validation constraints (`@NotBlank`, `@NotNull`, `@Positive`, `@Size`) directly on the request `record` components.
- **Unified Error Responses:** Route domain exceptions (`ResourceNotFoundException`, `BusinessRuleException`) and `MethodArgumentNotValidException` through a `@RestControllerAdvice` class returning Spring's standard `ProblemDetail` (RFC 7807) with explicit HTTP status codes (`400`, `404`, `409`, `422`).

### 5. Compile and Verify

After generating or modifying Java sources and configurations, run the build tool to verify that annotations, MapStruct mappers, and types compile cleanly:

```bash
# Maven
./mvnw test-compile -q

# Gradle
./gradlew compileJava compileTestJava --console=plain
```

If compilation fails, inspect the compiler output, fix missing imports or type mismatches, and re-run until the build succeeds with exit code `0`.

## Gotchas

- **Self-invocation bypasses Spring proxies:** Calling a `@Transactional`, `@Async`, or `@Cacheable` method from another method within the same class bypasses the Spring AOP proxy. Extract the target method into a separate bean or inject self/use programmatic `TransactionTemplate`.
- **`LazyInitializationException` outside transactions:** Accessing uninitialized lazy collections after the service method returns will crash during JSON serialization. Map entities to DTO records inside the `@Transactional` service boundary or fetch projections directly from the repository.
- **Mixing `javax.*` and `jakarta.*`:** Spring Boot 3+ strictly uses `jakarta.persistence.*`, `jakarta.validation.*`, and `jakarta.servlet.*`. Mixing legacy `javax.*` annotations causes validation annotations (`@Valid`, `@NotNull`) to silently fail without throwing compilation errors.
