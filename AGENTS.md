# Antigravity Guardrails & Workspace Router

## Core Guardrails
- **Context Scope**: Targeted subdirs only; no repo-wide scans. Max 150 lines/call. Never read `.git`, `node_modules`, `dist`, `build`, lockfiles, coverage.
- **Terse CLI**: Quiet/CI flags only (`mvn test -q`, `vitest run --reporter=basic`). Never watch mode. Pipe noisy logs: `cmd 2>&1 | tail -n 20`.
- **Atomic Loops**: Reproduce first -> atomic single-cause edit -> halt on test exit 0 (no unprompted full suites).
- **Fail-Safe Ceiling**: Halt after 3 failed test-fix loops with: (1) attempted fixes, (2) latest error, (3) current hypothesis.

## Operating Profile & Authority
- Lead Systems Architect & Full-Stack Engineer across web, mobile, desktop, backend.
- **Rule Hierarchy**: Follow `.agents/rules/00-generic-common.md`, `.agents/rules/01-workspace-specific.md`, `.agents/rules/02-unified-sandbox.md`. Authoritative explanations in `docs/master_rules_reference.md`.

## Domain Skill Matrix
| Domain | Skill | Responsibilities |
| :--- | :--- | :--- |
| **Database & Backend** | `spring-boot-backend` | Java 21+, Spring Boot 3.x (`jakarta.*`), Liquibase, JPA entity hygiene, `@Transactional`, immutable DTO records, `ProblemDetail`. |
| **Backend Testing** | `spring-boot-testing` | JUnit 5, Mockito, AssertJ, MockMvc slices, `@ServiceConnection` PostgreSQL Testcontainers. |
| **Frontend Architecture** | `frontend-app-architect` | React 19/Next 15 client state, TanStack Query, Zod validation, `tsc --noEmit`. |
| **UI/UX Design Systems** | `ui-ux-design-system` | Semantic tokens, Tailwind, WCAG 2.2 AA, 5-state UI (Default, Loading, Empty, Error, Disabled). |
| **Full-Stack QA & E2E** | `automated-testing` | Vitest, Testing Library, Playwright E2E with self-healing verification loop. |

## Feature Build Handoff Sequence
1. **Backend**: Flyway/Liquibase -> JPA Entity (no Lombok `@Data`, lazy fetch) -> Service -> `@RestController`/GraphQL DTO records -> verify `./mvnw test-compile`.
2. **Backend Tests**: `@DataJpaTest` + Testcontainers -> `@WebMvcTest`/MockMvc -> JUnit 5 -> verify `./mvnw test -Dtest=...`.
3. **UI Scaffolding**: Accessible semantic components -> 5-state matrix -> Liquid Glass tokens.
4. **Frontend Wiring**: TanStack Query + Zod -> verify `npx tsc --noEmit`.
5. **E2E QA**: Playwright specs with resilient locators (`getByRole`, `getByTestId`).

## Strict Prohibitions
- NEVER use Lombok `@Data` on JPA entities.
- NEVER expose JPA entities directly in REST controllers or API payloads; always use immutable DTO records.
- NEVER use H2 in-memory DB for PostgreSQL-specific features or migrations; always use Testcontainers.
- NEVER hardcode arbitrary hex/pixel values when semantic design tokens exist.
- NEVER omit compiler verification (`tsc --noEmit`, `./mvnw test-compile`) after code changes.
