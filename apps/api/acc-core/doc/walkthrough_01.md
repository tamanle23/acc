# Architecture Refactoring - Core Setup

- Implemented `SpringMediator` to resolve CQRS dispatch using `ResolvableType`.
- Defined base interfaces: `Command`, `CommandHandler`, `Query`, `QueryHandler`.
