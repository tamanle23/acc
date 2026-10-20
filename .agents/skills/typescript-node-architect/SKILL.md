---
name: typescript-node-architect
description: Design, optimize, and refactor Node.js, Bun, and TypeScript backend applications. Use when the user asks to apply Gang of Four design patterns, optimize V8/JavaScriptCore performance, manage memory, implement distributed task orchestration, or write high-performance TypeScript code.
---
# TypeScript Node & Bun Architect

Build high-performance, strictly typed backend services using Node.js and Bun. Emphasize classic design patterns, event-loop optimization, memory leak prevention, and modern TypeScript capabilities.

## When to Use

- Writing or refactoring backend logic, CLI tools, or background workers in Node.js or Bun.
- Applying GoF design patterns (Strategy, Dependency Injection, Observer, Builder) to TypeScript codebases.
- Troubleshooting memory leaks, Event Loop blocking, or garbage collection issues.
- Optimizing data structures (e.g., `Map`/`Set` vs plain objects) and asynchronous flows (`AbortController`, `queueMicrotask`).

## Steps

### 1. Detect the Target Runtime
Before writing implementation details, determine if the target is Node.js or Bun:
- **Bun:** Leverage native APIs like `Bun.serve()`, `Bun.file()`, and `Bun.Worker` for superior performance.
- **Node.js:** Use standard `node:http`, `node:fs/promises`, and `node:worker_threads`.
- Always prefix built-in Node modules with `node:` (e.g., `node:crypto`) to bypass module resolution caching.

### 2. Enforce Structural Design Patterns
Structure business logic decoupled from the framework:
- **Dependency Injection:** Pass dependencies via constructors. Never instantiate heavy clients (e.g., Database connections, Event Buses) directly inside business logic classes.
- **Strategy Pattern:** Abstract volatile logic (like execution engines or payment gateways) behind interfaces (`IExecutionStrategy`) so they can be swapped at runtime without modifying core logic.
- **Observer Pattern:** Use `EventEmitter` or custom Pub/Sub buses to decouple side-effects (like logging or metrics) from the main execution path.

### 3. Apply V8 & JavaScriptCore Optimizations
Write code that the JavaScript engine can easily optimize:
- Use `Map` and `Set` instead of POJOs (`{}`) for dictionaries requiring frequent insertions, deletions, or size checks. This prevents hidden class de-optimizations and prototype pollution.
- Avoid megamorphic functions: Keep function arguments consistent in type and shape to maintain V8 inline caching.
- Use `queueMicrotask()` for deferring execution to the end of the current tick, which is faster and more semantic than `setTimeout(fn, 0)`.

### 4. Master Asynchronous Control Flow
- **Cancellation:** Always accept and pass down an `AbortSignal` for any long-running async operation, fetch request, or file read.
- **Concurrency Safety:** Prefer `Promise.allSettled()` over `Promise.all()` when mapping over arrays of independent tasks so one rejected promise doesn't destroy the entire batch.
- **Offload CPU Work:** If a task involves heavy cryptography, image processing, or massive JSON parsing, move it to a `Worker` thread to avoid blocking the main event loop.

### 5. Memory Management Hygiene
- Always remove event listeners (`removeEventListener`, `off`) and clear timers (`clearTimeout`, `clearInterval`) in a `finally` block or a teardown method.
- Avoid unbounded caches (e.g., pushing to an array indefinitely). Use LRU caches for in-memory storage.

## Gotchas
- **Dangling Promises:** A common cause of memory leaks is a promise chain that neither resolves nor rejects. Always ensure every path resolves or times out.
- **`any` typing:** Forbid `any`. Use `unknown` and narrow it with Zod, TypeBox, or custom type guards (`typeof x === 'string'`).
- **Synchronous I/O:** Never use `*Sync` methods (like `readFileSync`) outside of the initial application startup phase.