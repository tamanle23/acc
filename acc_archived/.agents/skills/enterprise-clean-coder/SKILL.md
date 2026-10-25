---
name: enterprise-clean-coder
description: Produce clean, maintainable, and regression-free code with applied design patterns at enterprise grade quality. Use when writing, refactoring, or reviewing production-ready software, implementing GoF design patterns, or adhering to SOLID principles across backends and frontends.
---
# Enterprise Clean Coder

A specialized skill for engineering robust, highly maintainable, and regression-free software systems by enforcing clean code heuristics, SOLID principles, and appropriate design patterns.

## When to Use This Skill

- Writing new enterprise-grade services, modules, or component layers.
- Refactoring legacy code or addressing technical debt and tight coupling.
- Implementing Gang of Four (GoF) or enterprise architectural design patterns (e.g., Factory, Strategy, Repository, Pipeline).
- Performing code reviews for testability, extensibility, and error resilience.

---

## Core Principles

### 1. SOLID Architecture
* **Single Responsibility (SRP):** Every class, module, or function should have one, and only one, reason to change. Separate domain logic from persistence, validation, and transport layers.
* **Open/Closed (OCP):** Software entities should be open for extension but closed for modification. Leverage polymorphism, interfaces, and strategy patterns instead of branching switch/if-else chains.
* **Liskov Substitution (LSP):** Subtypes must be completely substitutable for their base types without altering the correctness or expected invariants of the program.
* **Interface Segregation (ISP):** Client-specific interfaces are vastly superior to one monolithic general-purpose interface. Keep contracts lean and cohesive.
* **Dependency Inversion (DIP):** Depend on abstractions, not concretions. High-level modules must not depend on low-level modules; both should depend on abstractions (interfaces/protocols).

### 2. Clean Code & Readability
* **Intention-Revealing Names:** Use precise, domain-specific naming conventions. Avoid magic numbers or string literals; extract them into named constants or configuration enums.
* **Small, Focused Functions:** Keep functions short (ideally under 20-30 lines) with a single level of abstraction. Avoid deep nesting by using early returns and guard clauses.
* **Immutability by Default:** Prefer immutable data structures, readonly properties, and pure functions wherever possible to eliminate side effects and state bugs.
* **Fail Fast & Explicit Error Handling:** Validate preconditions immediately. Throw specific, domain-level exceptions rather than generic errors, and handle failures gracefully at system boundaries.

### 3. Design Pattern Selection Matrix

| Pattern Category | Pattern Name | Use Case |
| :--- | :--- | :--- |
| **Creational** | **Factory Method / Abstract Factory** | Encapsulating complex object creation logic without exposing instantiation details to the client. |
| **Creational** | **Builder** | Constructing complex domain objects with numerous optional configuration parameters cleanly. |
| **Structural** | **Adapter / Facade** | Wrapping legacy or third-party libraries to provide a clean, unified domain interface. |
| **Structural** | **Decorator** | Adding cross-cutting behavior (logging, caching, rate limiting) dynamically without modifying core logic. |
| **Behavioral** | **Strategy** | Swapping interchangeable algorithms or business rule variants at runtime based on context. |
| **Behavioral** | **Observer / Event Publisher** | Decoupling event emitters from event subscribers for asynchronous, event-driven architecture. |
| **Behavioral** | **State** | Managing complex state machine transitions cleanly without bloated conditional state checks. |

---

## Implementation Workflow

When generating or refactoring code under this skill:

1. **Analyze Domain Boundaries:** Identify the core business entities, invariants, and side effects.
2. **Define Contracts First:** Write clear interfaces or abstract types before implementing concrete details.
3. **Apply Patterns Judiciously:** Introduce patterns only where variability, extension points, or complexity genuinely justify them. Avoid over-engineering simple CRUD flows.
4. **Enforce Testability:** Ensure all dependencies can be easily mocked, stubbed, or isolated for unit and integration testing.
5. **Defensive Guards:** Implement strict input validation, null safety, and clean error propagation paths.
