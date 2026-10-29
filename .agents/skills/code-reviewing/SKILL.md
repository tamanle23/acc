---
name: code-reviewing
description: Audit and review implemented code against an architecture or implementation plan to uncover mismatches, missing requirements, hidden stubs or mocks, anti-patterns, silent failures, and runtime edge cases. Use when the user asks for a code review, post-implementation audit, plan-to-code verification, PR review, or wants to check if an implementation matches its specification without shortcuts or defects.
---
# Code Reviewing

Rigorous post-implementation code review and verification workflow that audits executed code against its original implementation plan, architectural spec, or requirements to catch drift, incomplete work, stubs, anti-patterns, and failure modes before production.

## When to Use

- Auditing newly written or refactored code after an implementation plan has been executed
- Verifying that every requirement, file, endpoint, and edge case in a technical specification was genuinely implemented
- Scanning a codebase or pull request for leftover stubs, hardcoded mocks, TODOs, or superficial happy-path shortcuts
- Identifying architectural violations, resource leaks, concurrency bugs, or anti-patterns introduced during implementation

## Steps

### 1. Reconstruct the Baseline Contract

Extract a concrete checklist of expected deliverables from the implementation plan, ADR, or user prompt:

1. **Structural Deliverables**: Expected files, modules, classes, database migrations, and configuration changes.
2. **Behavioral Contracts**: Input/output schemas, state transitions, validation rules, error handling, and business logic invariants.
3. **Integration Boundaries**: External API calls, database queries, event publishing/consumption, and dependency injection wiring.
4. **Non-Functional Requirements**: Concurrency safety, memory management, latency bounds, idempotency, and security constraints.

### 2. Perform Plan-vs-Code Traceability Matrix

Map each planned item directly to its exact location in the implementation:

- Mark each requirement as **Verified** (fully implemented and wired), **Partial** (implemented but missing edge cases or integration), **Drifted** (implemented differently than planned), or **Missing** (not implemented).
- Verify **end-to-end wiring**: Ensure newly created services, handlers, or components are actually registered, exported, injected, and invoked by the application entry points rather than sitting as dead code.
- Flag any **unplanned scope creep** or silent omissions where complex logic was simplified without authorization.

### 3. Hunt for Stubs, Mocks, and Deceptive Completeness

Scan all modified and newly created files for signs of incomplete or fake implementation:

- **Explicit Placeholders**: `TODO`, `FIXME`, `HACK`, `WIP`, `throw new Error("Not implemented")`, `pass`, `unimplemented!()`, or empty function bodies.
- **Hardcoded & Mocked Returns**: Functions returning static literals, dummy arrays, fake IDs, `Promise.resolve(true)`, or mocked objects in production code paths.
- **Bypassed Validations & Types**: Overuse of `any`, `@ts-ignore`, `@SuppressWarnings`, type casting (`as unknown as T`), or disabled linter/compiler rules used to force code to compile.
- **Disconnected Persistence/IO**: In-memory maps or arrays substituting for real database queries, cache layers, or network calls specified in the plan.

### 4. Audit for Faults, Anti-Patterns, and What Could Go Sideways

Evaluate the code critically for runtime failure modes and architectural degradation:

- **Error Handling & Silent Failures**: Empty `catch` blocks, swallowed promises/exceptions, generic `500` responses without context, or logging an error and continuing execution with corrupted state.
- **Resource & Memory Leaks**: Unclosed file handles, database connections, streams, timers, event listeners, or native objects (e.g., `VideoFrame`, `ImageBitmap`, `OffscreenCanvas`, WebGL contexts) missing `try/finally` or explicit disposal (`using` / `close()`).
- **Concurrency & Race Conditions**: Unbounded `Promise.all` over large datasets, shared mutable state across async boundaries, missing database transaction boundaries (`@Transactional`), lock contention, or check-then-act race conditions.
- **Performance & Data Access Anti-Patterns**: N+1 query problems, unbounded `SELECT *` queries without pagination, blocking synchronous I/O or heavy CPU loops on the main event loop/UI thread, and unnecessary object allocations in hot paths.
- **Boundary & Security Violations**: Missing input sanitization, injection vulnerabilities, broken module boundaries (e.g., reaching into internal packages of another module), or leaked internal domain entities in public API responses.

### 5. Produce the Audit Report

Present findings in a structured, actionable format prioritized by severity:

1. **Executive Verdict**: Overall readiness status (`PASS`, `PASS WITH MINOR ISSUES`, `FAIL - REQUIRES REWORK`) and a 2-sentence summary of alignment with the plan.
2. **Plan-to-Code Traceability Table**: Markdown table mapping Planned Item | Implementation Location | Status (`Verified`, `Partial`, `Drifted`, `Missing`) | Notes.
3. **Stubs, Mocks & Incomplete Wiring**: Exact file and line references where fake data, placeholders, or disconnected code exist.
4. **Critical & High-Severity Faults**: Bugs, race conditions, resource leaks, or security flaws that will break in production, including the exact failure scenario ("What goes sideways") and the concrete code fix.
5. **Anti-Patterns & Architectural Drift**: Code smells, maintainability issues, and deviations from the agreed design patterns, paired with refactoring instructions.

## Gotchas

- **Never trust file existence or function names alone**: A function named `validateAndChargeCard()` might just return `{ success: true }`. Always inspect the implementation body and trace data flow from ingress to egress.
- **Watch for test-only illusions**: Verify that unit or integration tests actually assert against real business logic and state changes rather than asserting that a mock called another mock.
- **Avoid stylistic nitpicking when real faults exist**: Prioritize functional mismatches, missing logic, stubs, and runtime hazards over minor formatting preferences.
