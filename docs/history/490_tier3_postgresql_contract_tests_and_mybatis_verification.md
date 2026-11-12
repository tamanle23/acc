# 490. Tier 3 PostgreSQL Contract Tests & MyBatis Repositories Verification

## Problem Statement
In accordance with `hexagonal_architecture_and_ddd_migration_plan.md` (Tier 3 Contract Tests), hexagonal domain repositories and MyBatis persistence adapters required real SQL contract verification against live PostgreSQL (with Testcontainers dual-mode discovery) to prevent drift in JSONB serialization, SQL syntax, parameter mapping, and constructor reflection across:
1. `acc-fw`: Identity `UserAggregate` and `UserMapper.xml` mapping to real PostgreSQL `unipost_identity_user`.
2. `workflow-engine`: `TaskDefinitionAggregate` and `TaskDefinitionMapper.xml` mapping to `workflow_task_definitions` with JSONB schema type handling and version hard-fork logic.
3. `acc-ms-fs`: `FsObjectAggregate` and `FsObjectMapper.xml` mapping to `unipost_fs_object` and `unipost_fs_objectrelation` with soft-deletion and hierarchical parent lookups.

## Plan & Execution
1. **acc-fw User Repository**:
   - Resolved table mismatch in `UserMapper.xml` from legacy `unipost_user` to real `unipost_identity_user`.
   - Added boxed constructor `(UserId, String, String, String, String, UserStatus, Set, Long, Long)` to `UserAggregate` for reflection compatibility with MyBatis constructor mappings.
   - Verified `UserRepositoryMyBatisTest.java` against PostgreSQL.
2. **workflow-engine Task Definition Repository**:
   - Added boxed constructor to `TaskDefinitionAggregate` and standard JavaBean accessors (`get*`) alongside record-style accessors.
   - Configured `TaskDefIdTypeHandler`, `TaskStatusTypeHandler`, and `MapJsonbTypeHandler`.
   - Implemented `TaskDefRepositoryMyBatisTest.java` verifying `save`, `findById`, `findLatestByName`, `findByNameAndVersion`, `listVersions`, and `deprecateActiveVersionsExcept`.
3. **acc-ms-fs File System Object Repository**:
   - Created `FsObjectMyBatisMapper.java` and `FileIdTypeHandler.java`.
   - Created `FsObjectMapper.xml` with constructor mapping, JSONB/timestamp conversions, hierarchical parent-child joins, and soft delete.
   - Created `MyBatisFsObjectRepositoryAdapter.java` implementing `FsObjectRepositoryPort`.
   - Implemented `FsObjectRepositoryMyBatisTest.java` verifying file creation, directory handling, parent-child tree queries, and soft deletion.

## Changes
- `apps/api/acc-fw/src/main/java/com/acc/identity/domain/user/model/UserAggregate.java`: Overloaded boxed constructor.
- `apps/api/acc-fw/src/main/resources/mapper/UserMapper.xml`: Target `unipost_identity_user` table.
- `apps/api/acc-fw/src/test/java/com/acc/identity/infra/user/repository/mybatis/UserRepositoryMyBatisTest.java`: PostgreSQL contract test.
- `apps/api/workflow-engine/pom.xml`: Test dependencies for Testcontainers.
- `apps/api/workflow-engine/src/main/java/com/acc/workflow/domain/taskdef/model/TaskDefinitionAggregate.java`: Overloaded boxed constructor and JavaBean getters.
- `apps/api/workflow-engine/src/test/java/com/acc/workflow/infrastructure/adapters/outbound/persistence/mybatis/TaskDefRepositoryMyBatisTest.java`: PostgreSQL contract test.
- `apps/api/acc-ms-fs/pom.xml`: Test dependencies for Testcontainers.
- `apps/api/acc-ms-fs/src/main/java/com/acc/fs/domain/model/FsObjectAggregate.java`: Overloaded boxed constructor and JavaBean getters.
- `apps/api/acc-ms-fs/src/main/java/com/acc/fs/infrastructure/adapters/outbound/persistence/mybatis/FileIdTypeHandler.java`: MyBatis type handler for `FileId`.
- `apps/api/acc-ms-fs/src/main/java/com/acc/fs/infrastructure/adapters/outbound/persistence/mybatis/FsObjectMyBatisMapper.java`: MyBatis mapper interface.
- `apps/api/acc-ms-fs/src/main/resources/mapper/FsObjectMapper.xml`: MyBatis SQL mappings for `unipost_fs_object`.
- `apps/api/acc-ms-fs/src/main/java/com/acc/fs/infrastructure/adapters/outbound/persistence/MyBatisFsObjectRepositoryAdapter.java`: Production outbound adapter implementing `FsObjectRepositoryPort`.
- `apps/api/acc-ms-fs/src/test/java/com/acc/fs/infrastructure/adapters/outbound/persistence/mybatis/FsObjectRepositoryMyBatisTest.java`: PostgreSQL contract test.

## Verification
1. **Tier 3 Master Contract Tests**:
   `mvn test -pl :acc-fw,:workflow-engine,:acc-ms-fs -Dtest=*MyBatisTest -q` -> 100% pass, exit code 0.
2. **Tier 2 ArchUnit Rules**:
   `mvn test -pl :acc-core -Dtest=HexagonalArchitectureEnforcementTest -q` -> 100% pass, exit code 0.
3. **Tier 1 Pure Domain Aggregates**:
   `mvn test -Dtest=*AggregateTest -q` -> 100% pass, exit code 0.

## Walkthrough
- Executed real database migrations and SQL statements against PostgreSQL 16.
- Type handlers correctly handled JSONB strings, Postgres `PGobject` payloads, and epoch milliseconds to/from timestamps.
- Zero in-memory test doubles or synthetic bypasses were used for repository verification.
