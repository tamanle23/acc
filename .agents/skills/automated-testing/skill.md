---
name: automated-testing
description: Design, generate, execute, and debug automated tests across unit, integration, API, and end-to-end (E2E) browser layers. Use when the user asks to write tests, automate QA workflows, set up Playwright, Vitest, Jest, or pytest suites, run TDD cycles, fix flaky or failing tests, or audit test coverage.
---

# Automated Testing

Automate software quality assurance by detecting the project stack, generating deterministic unit, integration, and end-to-end (E2E) tests, and executing a self-healing verification loop until all suites pass.

## When to Use

- Writing unit, integration, API, or E2E browser tests for new or existing code
- Running Test-Driven Development (TDD) red-green-refactor workflows
- Debugging, reproducing, and fixing failing or flaky test suites
- Setting up test runners and configurations in an untested repository
- Auditing edge-case coverage before a pull request or release

## Steps

### 1. Inspect the Project and Detect the Test Runner

Examine configuration files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, or `playwright.config.*`) and existing test directories (`tests/`, `e2e/`, `__tests__/`) before writing any code. Matching existing conventions prevents duplicate dependencies and runner conflicts.

If no test framework exists, select one default for the stack:

- **JavaScript / TypeScript Unit & Integration:** Use Vitest (`npx vitest run`). If the project already depends on Jest, use Jest (`npx jest`).
- **Python Unit & Integration:** Use pytest (`pytest -q --tb=short`).
- **Web UI / End-to-End (E2E):** Use Playwright (`npx playwright test`).

### 2. Analyze Target Code and Map Test Cases

Read the target source files and identify all observable behaviors before generating test code. Structure test cases around the **Arrange-Act-Assert (AAA)** pattern covering three categories:

- **Happy path:** Verify standard inputs produce expected return values, state transitions, or UI states.
- **Boundary and edge cases:** Test empty collections, null or undefined values, zero/negative numbers, boundary lengths, and pagination limits.
- **Error and failure paths:** Verify invalid inputs, rejected promises, HTTP 4xx/5xx responses, and unauthorized access throw or render the expected error state.

### 3. Write Deterministic, Isolated Tests

Create or update the test file following the repository naming pattern (`*.test.ts`, `*.spec.ts`, or `test_*.py`). Apply these isolation rules so tests remain fast and reliable in CI:

- **Mock external boundaries only:** Mock third-party HTTP APIs, payment gateways, clocks, and randomness at the boundary. Keep internal business logic unmocked so tests verify real integration behavior.
- **Use resilient E2E locators:** In Playwright or browser automation, locate elements by user-visible role, label, or explicit test ID (`page.getByRole()`, `page.getByLabel()`, `page.getByTestId()`). Avoid brittle CSS class chains or XPath selectors because styling refactors break them.
- **Rely on web-first auto-waiting assertions:** Use `await expect(locator).toBeVisible()` instead of hardcoded sleeps (`waitForTimeout`), which slow down suites and cause timing flakiness.
- **Seed and reset state:** Ensure each test initializes its own data and cleans up afterward so tests pass when executed in any order or in parallel.

### 4. Execute and Verify (Self-Healing Loop)

Run the targeted test file immediately after writing it to verify that it compiles and passes:

```bash
# JavaScript / TypeScript (Vitest or Jest)
npx vitest run <path/to/file.test.ts>

# Playwright E2E
npx playwright test <path/to/file.spec.ts> --reporter=list

# Python (pytest)
pytest <path/to/test_file.py> -q --tb=short
```

If a test fails, determine the root cause before editing:

1. **Test bug** (bad mock setup, wrong selector, missing `await`, or outdated assertion): Fix the test file and re-run.
2. **Application bug** (the implementation violates the specification or crashes on an edge case): Report the uncovered bug clearly or fix the source code if requested, then re-run the suite to confirm green status.

Repeat up to 3 iterations until the targeted test suite exits with code `0` and zero skipped or failing assertions.

## Gotchas

- **False positives from vacuous assertions:** Always assert specific output values or state changes rather than only checking `toBeDefined()` or `not.toBeNull()`. Every async assertion in Playwright or Jest must be preceded by `await`.
- **Testing implementation details:** Do not assert on private helper methods or internal component state. Test public functions, API responses, and rendered DOM output so refactoring internals does not break the suite.
- **Shared mutable state across tests:** Never reuse mutated global objects across `it()` or `test_*` blocks. Initialize fresh fixtures inside `beforeEach` or pytest fixtures.
- **Leaky network calls in unit tests:** Block or mock outbound network requests in unit tests so offline environments and CI runners execute deterministically.
