# 493. Fix FsObject Repository Primary Bean Ambiguity and MyBatis MapperScan Registration

## Problem Statement
During backend dev/sandbox startup (`pnpm --filter @acc/api dev:sandbox`), Spring ApplicationContext failed with `NoUniqueBeanDefinitionException` / `BeanCreationException`:
```
Parameter 1 of constructor in com.acc.fs.application.service.UploadFileApplicationService required a single bean, but 2 were found:
  - jpaFsObjectRepositoryAdapter: defined in file [JpaFsObjectRepositoryAdapter.class]
  - myBatisFsObjectRepositoryAdapter: defined in file [MyBatisFsObjectRepositoryAdapter.class]
```
During the Hexagonal Architecture and DDD migration (Iteration 87), the new `MyBatisFsObjectRepositoryAdapter` was added to co-exist with the legacy `JpaFsObjectRepositoryAdapter` without an explicit `@Primary` qualifier, leading to constructor injection conflict in `UploadFileApplicationService`. In addition, the package `com.acc.fs.infrastructure.adapters.outbound.persistence.mybatis` was missing from `@MapperScan` in `MasterDatabaseConfiguration`, preventing the mapper proxy from being autowired.

## Plan & Execution
1. Mark `MyBatisFsObjectRepositoryAdapter` as `@Primary` so that callers injecting `FsObjectRepositoryPort` default to the new production MyBatis adapter.
2. Register `"com.acc.fs.infrastructure.adapters.outbound.persistence.mybatis"` in the `@MapperScan.basePackages` list in `MasterDatabaseConfiguration.java` to ensure the MyBatis mapper proxy is properly scanned and registered in the Spring context.
3. Verify test compilation and PostgreSQL contract test `FsObjectRepositoryMyBatisTest`.

## Changes
- `apps/api/acc-ms-fs/src/main/java/com/acc/fs/infrastructure/adapters/outbound/persistence/MyBatisFsObjectRepositoryAdapter.java`:
  - Added `@Primary` annotation to designate `MyBatisFsObjectRepositoryAdapter` as the primary bean for `FsObjectRepositoryPort`.
- `apps/api/acc-fw/src/main/java/com/acc/boot/config/MasterDatabaseConfiguration.java`:
  - Added `"com.acc.fs.infrastructure.adapters.outbound.persistence.mybatis"` to `@MapperScan.basePackages`.

## Verification
- `FsObjectRepositoryMyBatisTest`: Verified PostgreSQL contract tests pass with full CRUD and parent-child tree mapping.
- Clean application context bean resolution for `UploadFileApplicationService`.

## Walkthrough
- Spring container now resolves `MyBatisFsObjectRepositoryAdapter` unambiguously when autowiring `FsObjectRepositoryPort`.
- Legacy `JpaFsObjectRepositoryAdapter` remains available for backward-compatibility if explicitly qualified, while all use cases default to the hexagonal MyBatis implementation.

## Tasks
- [x] Add `@Primary` to `MyBatisFsObjectRepositoryAdapter`
- [x] Add FS MyBatis mapper package to `MasterDatabaseConfiguration` `@MapperScan`
- [x] Run PostgreSQL contract verification

## Enhancement
- Completely decommission `JpaFsObjectRepositoryAdapter` once all legacy JPA dependencies are pruned in future clean-up phases.
