---
name: spring-boot-testing
description: Design, generate, execute, and debug Java and Spring Boot unit, sliced integration, API contract, and Testcontainers tests. Use when the user asks to write or fix JUnit 5, Mockito, AssertJ, MockMvc, WebTestClient, DataJpaTest, SpringBootTest, Testcontainers, or Spring Modulith tests.
---
# Spring Boot Testing

Automate JVM and Spring Boot quality assurance by selecting the lightest appropriate test slice, pairing persistence tests with real Testcontainers database engines, and running a self-healing verification loop via Maven or Gradle.

## When to Use

- Writing unit tests for Spring `@Service` and domain classes using `JUnit 5`, `Mockito`, and `AssertJ`
- Writing sliced web tests for `@RestController` or GraphQL handlers using `@WebMvcTest`, `MockMvc`, or `WebTestClient`
- Writing persistence and repository integration tests using `@DataJpaTest`, `@MybatisTest`, or `@SpringBootTest` with `Testcontainers`
- Verifying Spring Modulith module boundaries (`ApplicationModules.of(...).verify()`) and event publication (`@ApplicationModuleTest`)
- Debugging failing, slow, or flaky Maven (`./mvnw test`) or Gradle (`./gradlew test`) test suites

## Steps

### 1. Inspect the Build & Test Stack

Examine `pom.xml` or `build.gradle` (`.kts`) and `src/test/` before generating test code:

- Check existing test dependencies (`spring-boot-starter-test`, `org.testcontainers:postgresql`, `rest-assured`, `wiremock`, `spring-modulith-starter-test`).
- Check naming conventions: unit tests typically end in `*Test.java` (Maven Surefire) and integration tests in `*IT.java` or `*IntegrationTest.java` (Maven Failsafe).
- Check `src/test/resources/` for an existing `BaseIntegrationTest` or Testcontainers singleton configuration before creating a new container setup.

### 2. Select the Lightest Test Slice

Avoid booting the full `@SpringBootTest` application context when a narrower slice can verify the behavior in milliseconds:

- **Domain & Service Logic (Unit):** Use `@ExtendWith(MockitoExtension.class)` with `@Mock` and `@InjectMocks`. Do not load Spring at all. Assert outcomes with AssertJ (`assertThat(...)`) and verify collaborator calls with Mockito.
- **Controller & Serialization Slice:** Use `@WebMvcTest(TargetController.class)` with `MockMvc` (or `MockMvcTester` / `WebTestClient`). Verify HTTP routing, `@Valid` Bean Validation `400` responses, security annotations (`@WithMockUser`), and RFC 7807 `ProblemDetail` JSON payloads.
- **Persistence Slice:** Use `@DataJpaTest` (or `@MybatisTest`) + `@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)` wired to a real **Testcontainers** database via `@ServiceConnection`.
- **Modulith / End-to-End API Integration:** Use `@ApplicationModuleTest` to test a single Spring Modulith module in isolation, or `@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)` with `Testcontainers` for full multi-layer flows.

### 3. Write Deterministic, Isolated JVM Tests

Structure every test around the **Given-When-Then** or **Arrange-Act-Assert** pattern covering happy paths, boundary conditions, and exception paths:

- **Reuse Testcontainers:** Declare the container with `@Container @ServiceConnection static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");` (or inherit from a shared abstract base test class) so the container starts once per JVM run.
- **Flush and Clear Persistence Context:** Inside `@DataJpaTest` or `@Transactional` tests, always call `entityManager.flush()` and `entityManager.clear()` after saving entities and before executing queries under test. Otherwise, Hibernate returns cached first-level context objects and masks broken SQL mappings or `LazyInitializationException` bugs.
- **Mock External Boundaries Only:** Use WireMock or `@MockBean` / `@MockitoBean` strictly for third-party HTTP clients, external queues, or `java.time.Clock`. Never mock the repository in a persistence test or the service under test.

### 4. Execute and Verify (Self-Healing Loop)

Run the targeted test class immediately to confirm compilation and green execution:

```bash
# Maven - run a single test class
./mvnw test -Dtest=<TestClassName> -q

# Gradle - run a single test class
./gradlew test --tests "<fully.qualified.TestClassName>" --console=plain
```

If the test fails, diagnose the failure before editing:

1. **Test setup issue** (missing `@AutoConfigureTestDatabase(replace = Replace.NONE)`, unmocked collaborator in `@WebMvcTest`, missing `entityManager.flush()`, or Docker daemon not running for Testcontainers): Fix the test configuration and re-run.
2. **Application bug** (broken JPQL query, missing `@Valid` annotation, wrong HTTP status code, or transaction rollback defect): Report the root cause clearly or fix the source class if requested, then re-run until the test exits with code `0`.

## Gotchas

- **H2 masking production SQL defects:** Never rely on H2 in-memory defaults to test PostgreSQL JSONB queries, CTEs, custom types, or Flyway migrations. Always include `@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)` so Spring Boot uses your Testcontainers data source.
- **`@SpringBootTest` context proliferation:** Using different `@MockBean` / `@MockitoBean` or `@DynamicPropertySource` combinations across every test class forces Spring TestContext to reboot the entire application context repeatedly. Group shared integration configurations into a single base class or `@TestConfiguration`.
- **Vacuous AssertJ assertions:** Assert exact field values or recursive DTO comparisons (`assertThat(result).usingRecursiveComparison().ignoringFields("id", "createdAt").isEqualTo(expected)`) rather than only checking `assertThat(result).isNotNull()`.
