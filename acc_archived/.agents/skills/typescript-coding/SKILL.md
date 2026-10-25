---
name: typescript-coding
description: "Design, optimize, and refactor Node.js, Bun, and TypeScript backend applications and modern full-stack systems. Use when the user asks to apply clean architecture and GoF design patterns, leverage modern TypeScript language features (satisfies, const type parameters, explicit resource management, erasable syntax), optimize V8/JavaScriptCore performance, manage memory, implement robust error handling, or write production-grade TypeScript code."
---
# TypeScript Node & Bun Architect

Build robust, high-performance, strictly typed backend services and modern systems using TypeScript, Node.js, and Bun. Emphasize clean code architecture, modern TypeScript language features, event-loop optimization, memory leak prevention, and functional/object-oriented patterns.

## When to Use

- Designing, writing, or refactoring backend logic, microservices, CLI tools, or background workers in Node.js or Bun.
- Leveraging modern TypeScript capabilities (`satisfies`, `<const T>`, template literal types, discriminated unions, `using` resource management).
- Applying enterprise design patterns (Hexagonal/Clean Architecture, Dependency Injection, Strategy, Observer, Factory, Repository, Result pattern).
- Optimizing V8 and JavaScriptCore execution (inline caches, monomorphism, heap footprint, event-loop latency).
- Hardening asynchronous control flow (`AbortController`, `Promise.withResolvers`, structured concurrency, cancellation tokens).
- Eliminating memory leaks, dangling handlers, unhandled rejections, and un-erasable syntax.

---

## 1. Modern TypeScript Language Standards

Write idiomatic, future-proof TypeScript that aligns with modern ECMAScript and TypeScript compiler standards:

- **Erasable Syntax First (`--erasableSyntaxOnly`):** Avoid legacy non-standard runtime extensions (no `enum`, no `namespace`, no `parameter properties`). Use `as const` object literals with union types instead of `enum`:
  ```ts
  export const TaskStatus = {
    Pending: 'PENDING',
    Running: 'RUNNING',
    Completed: 'COMPLETED',
  } as const;
  export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];
  ```
- **Type-Safe Validation with `satisfies`:** Use `satisfies` to validate object configurations against contracts without widening inferred literal types:
  ```ts
  const routes = {
    users: '/api/v1/users',
    health: '/healthz',
  } satisfies Record<string, string>;
  ```
- **Const Type Parameters (`<const T>`):** Capture literal types without requiring call-site `as const`:
  ```ts
  function defineEndpoints<const T extends readonly string[]>(endpoints: T): T {
    return endpoints;
  }
  ```
- **Discriminated Unions & Exhaustiveness Checking:** Model business domain states with discriminated unions and enforce strict exhaustiveness using an unreachable assertion:
  ```ts
  function assertNever(x: never): never {
    throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
  }
  ```
- **Strict Narrowing & Boundaries:** Forbid `any`. Use `unknown` at untrusted boundaries (network inputs, JSON payloads, dynamic queues) and narrow using runtime validators (Zod/TypeBox) or user-defined type predicates (`val is Type`). Enable `noUncheckedIndexedAccess`.
- **Import Attributes & Modern ESM:** Use standard import attributes (`import config from './config.json' with { type: 'json' }`) and explicit `node:` protocol imports for Node.js built-ins.

---

## 2. General Programming & Architecture Principles

Structure applications to be modular, testable, and resilient against regression:

- **Clean / Hexagonal Architecture:**
  - **Core Domain:** Pure entity logic, domain models, and business invariants with zero framework or database dependencies.
  - **Application Layer:** Use-case orchestrators and command/query handlers depending only on domain interfaces.
  - **Infrastructure Adapters:** External clients (PostgreSQL, Redis, RabbitMQ, HTTP clients) implementing domain interfaces.
- **Dependency Inversion & Composition:**
  - Pass dependencies through constructors or factory functions.
  - Prefer composition over class inheritance: compose small, cohesive interfaces (Interface Segregation Principle).
- **Domain Modeling with the Result Pattern:**
  - Distinguish between expected operational failures (e.g., user not found, balance insufficient) and unexpected fatal defects (network partition, disk full).
  - Model operational failures as typed `Result<T, E>` unions rather than throwing arbitrary exceptions:
    ```ts
    export type Result<T, E = Error> =
      | { readonly ok: true; readonly value: T }
      | { readonly ok: false; readonly error: E };
    ```
- **Immutability by Default:** Protect state from unintended mutation using `Readonly<T>`, `readonly` arrays, and frozen objects for configuration maps.

---

## 3. Explicit Resource Management & Modern Async Control

- **Resource Disposal (`using` / `await using`):** Use explicit resource management (`Symbol.dispose` and `Symbol.asyncDispose`) to guarantee cleanup of database connections, file handles, locks, and network sockets:
  ```ts
  class DatabaseSession implements AsyncDisposable {
    async [Symbol.asyncDispose]() {
      await this.release();
    }
  }
  ```
- **Cooperative Cancellation:** Accept and propagate `AbortSignal` across all asynchronous boundaries. Use `AbortSignal.any()` to combine client timeouts and application shutdown signals:
  ```ts
  const timeoutSignal = AbortSignal.timeout(5_000);
  const combinedSignal = AbortSignal.any([shutdownSignal, timeoutSignal]);
  ```
- **Structured Async Workflows:**
  - Use `Promise.withResolvers<T>()` for clean deferred promise management without manual boilerplate.
  - Prefer `Promise.allSettled()` over `Promise.all()` for independent parallel jobs to avoid fail-fast cascade failures.
  - Always handle promise rejection branches; never leave unhandled rejections.

---

## 4. Runtime & Engine Optimization (Node.js, Bun, V8 / JSC)

- **Runtime Detection & Native Specialization:**
  - **Bun:** Leverage native high-speed primitives (`Bun.serve()`, `Bun.file()`, `bun:ffi`, `Bun.Worker`).
  - **Node.js:** Leverage `node:http`, `node:fs/promises`, and `node:worker_threads`. Always prefix built-ins with `node:`.
- **Monomorphism & Hidden Classes:** Maintain uniform object shapes and call-site monomorphism. Avoid dynamically adding or deleting properties from hot objects (`delete obj.prop` deoptimizes V8 hidden classes).
- **Collections Selection:** Use `Map` and `Set` over plain objects for high-frequency dynamic key insertions, lookups, and deletions. Use typed arrays (`Uint8Array`, `ArrayBuffer`) for binary streaming.
- **Event Loop & Offloading:**
  - Keep the main loop unblocked. Use `queueMicrotask()` for deferral in the current turn.
  - Offload CPU-heavy computation (cryptography, large JSON parsing, image/video transformations) to worker threads or native worker pools.

---

## 5. Memory Management & Production Hygiene

- **Listener & Timer Teardown:** Clean up event listeners (`emitter.off()`, `removeEventListener`) and timers (`clearTimeout`, `clearInterval`) using `finally` blocks, `AbortSignal` `abort` listeners, or disposable patterns.
- **Bounded In-Memory State:** Enforce strict size limits and eviction policies (LRU/TTL) for caches and buffers. Never allow unbounded arrays or Maps to grow indefinitely in memory.
- **Safe Date & Time Operations:** Use the native `Temporal` API for ISO-compliant date, time, and timezone calculations, avoiding legacy `Date` mutation bugs.

---

## Gotchas & Anti-Patterns to Avoid

- **`any` Sprawl:** Never bypass the type checker with `any`. Use `unknown`, generic parameters, or narrowed unions.
- **Blocking I/O:** Never call synchronous I/O methods (`fs.readFileSync`, `child_process.execSync`) in request-response lifecycles or background workers.
- **Unbounded Streams:** Always handle backpressure when working with Node.js/Web streams (`stream.pipeline` or `pipeTo`).
- **Ignoring Node.js Process Signals:** Gracefully handle `SIGINT` and `SIGTERM` by closing HTTP servers, draining queues, and flushing logs before `process.exit()`.
