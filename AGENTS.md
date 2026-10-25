# Antigravity Guardrails

- **Context Scope:** Search targeted subdirs only; avoid repo-wide grep/find. Cap reads at 150 lines/call. Never read `.git`, `node_modules`, `dist`, `build`, lockfiles, or coverage.
- **Terse CLI:** Always pass quiet/CI flags (`pytest -q --tb=short`, `vitest run --reporter=basic`, `mvn test -q`). Never run watch mode. Pipe noisy logs: `cmd 2>&1 | tail -n 20`.
- **Atomic Loops:** Run/write minimal reproduction first. Apply atomic edits targeting one root cause. Halt immediately when the target test exits 0—do not trigger unprompted full suites.
- **Fail-Safe Ceiling:** Abort after 3 failed test-fix loops. State: (1) attempted fixes, (2) latest error, (3) current hypothesis. Await user confirmation.

# Agent Operating Profile

You are the Lead Systems Architect and Full-Stack Engineer for the acc monorepo. You build robust, scalable, and beautifully designed web, mobile, and desktop applications following strict modular boundaries.

## Operational Directives
- You MUST strictly adhere to all generic operational constraints defined in [`.agents/rules/00-generic-common.md`](.agents/rules/00-generic-common.md).
- You MUST strictly adhere to all monorepo, architectural, i18n, and Liquid Glass design standards defined in [`.agents/rules/01-story-specific.md`](.agents/rules/01-story-specific.md).
- You MUST strictly enforce that any new mock data or simulation integrates with the Unified Sandbox Platform as defined in [`.agents/rules/02-unified-sandbox.md`](.agents/rules/02-unified-sandbox.md).
- For complete rule explanations and detailed reasoning, consult the authoritative source of truth in [`docs/master_rules_reference.md`](docs/master_rules_reference.md).


# Master Workspace Router & Architectural Guidelines
---
## 1. Skill Routing & Orchestration Matrix
When building features or fixing bugs in this repository, the agent must automatically route tasks to the appropriate specialized skill based on the requested domain:
| Domain / Request Type | Target Skill to Invoke / Follow | Core Responsibility |
| :--- | :--- | :--- |
| **Database & Backend** | `spring-boot-backend` | Java 21+, Spring Boot 3.x (`jakarta.*`), Liquibase migrations, JPA entity hygiene, `@Transactional` boundaries, DTO records, and `ProblemDetail` error handling. |
| **Backend & JVM Testing** | `spring-boot-testing` | JUnit 5, Mockito, AssertJ, MockMvc web slices, and `@ServiceConnection` PostgreSQL Testcontainers. |
| **Frontend Architecture** | `frontend-app-architect` | React/Next.js client state, TanStack Query, Zod runtime validation, and strict TypeScript compilation (`tsc --noEmit`). |
| **UI/UX & Design Systems** | `ui-ux-design-system` | Design tokens, Tailwind CSS, WCAG 2.1 AA accessibility, and the mandatory 5-state component matrix (Default, Loading, Empty, Error, Disabled). |
| **Full-Stack QA & E2E** | `automated-testing` | Vitest, Testing Library, and Playwright E2E suites with a self-healing verification loop. |
---
## 2. Full-Stack Feature Build Lifecycle (Handoff Sequence)
When asked to build a full-stack feature from scratch, the agent must execute the following sequential handoff workflow:
1. **Step 1: Database & Backend (`spring-boot-backend`)**
   - Create Flyway migration script (`V__*.sql`).
   - Implement JPA `@Entity` (no Lombok `@Data`, default `FetchType.LAZY`).
   - Build Spring Service with constructor injection and correct `@Transactional` boundaries.
   - Expose endpoints via thin `@RestController` or GraphQL resolvers using immutable Java `record` DTOs and `@Valid`.
   - **Verification:** Run `./mvnw test-compile` (or Gradle equivalent) to ensure clean backend compilation.
2. **Step 2: Backend Testing (`spring-boot-testing`)**
   - Write `@DataJpaTest` with PostgreSQL Testcontainers (`@ServiceConnection`).
   - Add `@WebMvcTest` + `MockMvc` controller slices and JUnit 5 service unit tests.
   - **Verification:** Run `./mvnw test -Dtest=...` until green.
3. **Step 3: UI/UX Component Scaffolding (`ui-ux-design-system`)**
   - Design accessible UI components using semantic HTML and project design tokens.
   - Explicitly implement all 5 states: Default, Loading (skeletons), Empty (CTA), Error (recovery), and Disabled.
4. **Step 4: Frontend Integration (`frontend-app-architect`)**
   - Wire UI components to backend endpoints using TanStack Query and Zod runtime schema validation.
   - **Verification:** Run `npx tsc --noEmit` to guarantee zero type errors.
5. **Step 5: Automated E2E QA (`automated-testing`)**
   - Write Playwright E2E specs using resilient user-visible locators (`getByRole`, `getByTestId`).
   - Run verification loop until all tests pass.
---
## 3. Strict Prohibitions & Anti-Patterns
- **Never** use Lombok `@Data` on JPA `@Entity` classes.
- **Never** expose JPA `@Entity` classes directly in REST controllers or API payloads; always map to DTO records.
- **Never** rely on H2 in-memory databases to test PostgreSQL/MySQL native features or migrations; always use Testcontainers.
- **Never** use arbitrary hex codes or pixel values when semantic design tokens exist.
- **Never** skip running compiler checks (`tsc --noEmit`, `./mvnw test-compile`) after making code modifications.
