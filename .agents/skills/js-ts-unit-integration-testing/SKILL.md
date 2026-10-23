---
name: js-ts-unit-integration-testing
description: Design, write, execute, and debug unit and integration tests in JavaScript and TypeScript. Use when writing or fixing tests with Vitest, Jest, Node test runner, or React Testing Library, configuring test harnesses, mocking modules/APIs, or verifying domain logic and component integration.
---
# JavaScript & TypeScript Unit and Integration Testing

Design and execute robust, deterministic unit and integration test suites for JavaScript and TypeScript codebases across Node.js, Bun, and browser environments.

## When to Use

- Writing or refactoring unit tests for functions, classes, and business logic
- Creating integration tests for API endpoints, service layers, and database queries
- Testing UI components with React Testing Library or equivalent component test utilities
- Mocking external modules, HTTP requests, timers, or system environments
- Configuring Vitest, Jest, or Node test runner (`node:test`)
- Debugging failing, slow, or nondeterministic unit and integration tests

## Workflow Steps

### 1. Detect Runner and Project Setup

Inspect `package.json` to identify installed test frameworks and scripts:

- **Vitest:** Look for `vitest` in dependencies. Preferred standard for Vite, Fastify, and modern TypeScript projects (`npx vitest run`).
- **Jest:** Look for `jest` or `ts-jest` / `@swc/jest` (`npx jest`).
- **Node Test Runner:** Look for native `node --test` scripts in Node 18+ setups.

Preserve existing test naming conventions (`*.test.ts`, `*.spec.ts`, or files inside `__tests__/`).

### 2. Isolate and Structure Test Cases

Structure every test suite around Arrange-Act-Assert (AAA):

- **Arrange:** Set up isolated fixtures, mock parameters, and context before execution.
- **Act:** Execute the specific function, method, or component action under test.
- **Assert:** Validate precise return values, state mutations, or output contracts.

Cover three core scenarios:
1. **Happy Path:** Expected typical inputs and workflows.
2. **Boundary Conditions:** Empty arrays, zero, null/undefined, extreme values, off-by-one bounds.
3. **Failure Modes:** Rejected promises, custom application errors, HTTP status codes, malformed payloads.

### 3. Mock Boundaries, Not Domain Logic

- Mock only third-party boundaries: Network requests (via MSW or `vi.fn()` / `jest.fn()`), database connections, system clocks (`vi.useFakeTimers()`), and environment variables.
- Do not mock internal business logic or sibling utility functions within the same unit.
- Clear and reset mocks in `beforeEach` or `afterEach` hooks (`vi.clearAllMocks()`, `jest.clearAllMocks()`) to avoid state pollution between tests.

### 4. Component Integration Testing

When testing frontend UI components:

- Query by accessible roles and text using `@testing-library/react` (`getByRole`, `getByLabelText`) rather than test IDs or CSS selectors.
- Fire events using `@testing-library/user-event` instead of `fireEvent` to replicate real browser event dispatching.
- Avoid asserting on internal component state; assert strictly on rendered DOM output and user interactions.

### 5. Execution and Self-Healing Verification

Run the targeted test immediately:

```bash
# Vitest
npx vitest run path/to/file.test.ts

# Jest
npx jest path/to/file.test.ts --runInBand
```

If tests fail:
1. Check if mock setup lacks necessary return contracts.
2. Inspect async resolution (missing `await` or unhandled promises).
3. Distinguish test assertion flaws from real production bugs before patching.

## Gotchas

- **Unawaited Async Assertions:** Omitting `await` on `expect(promise).rejects.toThrow()` causes false passes or unhandled rejections.
- **Shared State Across Tests:** Mutating global singletons or shared objects leads to order-dependent test failures. Always use clean fixtures per test.
- **Vacuous Assertions:** Checking only `expect(res).toBeDefined()` masks silent failures. Assert concrete data structures and values.
