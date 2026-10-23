---
name: web-e2e-automated-testing
description: Architect, implement, and maintain automated web end-to-end (E2E) test suites. Use when writing or debugging browser tests using Playwright, Cypress, or WebdriverIO, implementing Page Object Models, configuring browser matrices, handling resilient locators, or fixing flaky web tests.
---
# Web Automated End-to-End Testing

Architect, write, and maintain reliable, high-speed end-to-end (E2E) web test suites that simulate genuine user journeys across modern browsers.

## When to Use

- Writing browser E2E test suites for web applications
- Designing Page Object Models (POM) or component fixtures for browser automation
- Setting up or configuring Playwright, Cypress, or WebdriverIO
- Debugging flaky, timing-sensitive, or hanging browser tests
- Managing authenticated test states and storage state reuse
- Setting up cross-browser test matrices and CI execution workflows

## Workflow Steps

### 1. Select and Configure the E2E Framework

- **Playwright (Recommended Default):** High-speed multi-browser automation with native auto-waiting, trace viewer, and parallel execution (`playwright.config.ts`).
- **Cypress:** Component and E2E testing with interactive browser runner (`cypress.config.ts`).
- **WebdriverIO:** Multi-platform or Selenium grid integrations.

Ensure configuration enables:
- Tracing or video capture on first retry or failure (`trace: 'on-first-retry'`).
- Isolated worker processes for parallel test execution.
- Configurable base URLs via environment variables.

### 2. Adopt Resilient Locator Strategy

Target elements using user-facing attributes rather than brittle DOM hierarchy:

1. **Role and Accessible Name:** `page.getByRole('button', { name: 'Submit' })`
2. **Form Labels:** `page.getByLabel('Email address')`
3. **Placeholder / Display Text:** `page.getByPlaceholder('Search products')` or `page.getByText('Welcome back')`
4. **Explicit Test IDs:** `page.getByTestId('checkout-summary')` as an escape hatch when accessibility attributes are insufficient.

Avoid styling-dependent CSS class selectors (such as `.btn-primary.active`) and fragile XPath expressions.

### 3. Implement Page Object Models (POM)

Encapsulate DOM queries and page interactions inside reusable classes or helper modules:

- Keep page objects focused on user actions (e.g., `loginPage.submitCredentials(email, password)`).
- Return page objects or locator handles from methods to facilitate chaining.
- Keep assertions within test files rather than burying assertions inside page object methods, preserving clear test failure reporting.

### 4. Manage Authentication and Test State

- Avoid logging in via the UI before every single test.
- Use Playwright `storageState` or API-based token caching to store authenticated cookies and local storage tokens.
- Reuse pre-authenticated states across tests, reserving UI login tests for dedicated authentication spec files.
- Ensure test data is created via backend API calls or isolated database seeds before the test runs.

### 5. Leverage Auto-Waiting and Assertions

- Use web-first assertions that poll automatically until conditions are satisfied (`await expect(locator).toBeVisible()`, `await expect(locator).toHaveText(...)`).
- Never use arbitrary fixed delays (`page.waitForTimeout(5000)`). If waiting is necessary, wait on explicit network responses (`page.waitForResponse(...)`) or UI states.

### 6. Verify and Debug

Execute targeted browser specs:

```bash
# Playwright
npx playwright test e2e/checkout.spec.ts --headed
npx playwright show-trace trace.zip

# Cypress
npx cypress run --spec "cypress/e2e/checkout.cy.ts"
```

## Gotchas

- **Hardcoded Sleeps:** Hardcoded pauses cause flaky CI runs under varying CPU load. Rely exclusively on auto-waiting locators and event promises.
- **Shared Test Data Collisions:** Multiple parallel workers editing the same database record will produce random failures. Use unique identifiers (such as UUID or timestamps) per test run.
- **Over-testing Static Content:** E2E tests should focus on critical end-to-end user workflows, not validating static copy or CSS margins.
