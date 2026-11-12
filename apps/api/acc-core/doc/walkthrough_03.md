# Architecture Refactoring - Bug fixes

- Resolved the runtime issue with `SpringMediator` by manually scanning all `CommandHandler` and `QueryHandler` beans and resolving their target generic parameters using `ClassUtils.getUserClass(handler)` rather than directly interacting with `.getClass()` which would resolve the CGLIB proxy in a `@Transactional` bean context.
- Optimized the `SpringMediator` to cache handler resolutions into a `ConcurrentHashMap` during `@PostConstruct` to prevent O(N) lookup operations per dispatch execution.
