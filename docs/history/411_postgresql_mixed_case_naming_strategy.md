# 411 - PostgreSQL Physical Naming Strategy for Mixed-Case Liquibase Columns and Table Identifier Resolution

## Problem
1. During startup / pre-warming, executing SQL on `UNIPOST_ENTITY_TYPES` failed with:
   `ERROR: column et1_0.createdby_uid does not exist. Hint: Perhaps you meant to reference the column "et1_0.createdBy_uid".`
   Liquibase created mixed-case columns (`createdBy_uid`, `createdDate`, `deletedDate`, `lastUpdatedBy_uid`) with double-quoted case sensitivity in PostgreSQL, but standard Hibernate physical naming emitted unquoted lowercase identifiers (`createdby_uid`).
2. When introducing an initial naming strategy to quote mixed-case identifiers, table names such as `UNIPOST_IDENTITY_user` (formed by combining `Constants.TABLE_PREFIX` `"UNIPOST_IDENTITY_"` with lowercase `"user"`) were also quoted as `"UNIPOST_IDENTITY_user"`. In PostgreSQL, Liquibase created tables using unquoted DDL (`CREATE TABLE ${table_prefix}USER`), which PostgreSQL folded to lowercase `unipost_identity_user`. Quoting the table name forced exact-case matching, resulting in:
   `ERROR: relation "UNIPOST_IDENTITY_user" does not exist`.

## Plan
1. Implement `MixedCaseQuotingPhysicalNamingStrategy` extending Hibernate's `PhysicalNamingStrategyStandardImpl`:
   - Keep column names quoted if they contain mixed uppercase and lowercase letters (`createdBy_uid`, `lastUpdatedBy_uid`, etc.).
   - Explicitly leave table names unquoted so PostgreSQL folds them naturally and resolves relations created via unquoted DDL case-insensitively.
2. Configure `spring.jpa.hibernate.naming.physical-strategy` in `apps/backend/acc-ms-aio/src/main/resources/application.yml`.
3. Provide unit test suite `MixedCaseQuotingPhysicalNamingStrategyTest` in `acc-fw`.

## Changes
- `apps/backend/acc-fw/src/main/java/com/acc/fw/jpa/MixedCaseQuotingPhysicalNamingStrategy.java`:
  Custom physical naming strategy preserving mixed-case column quoting while ensuring table names remain unquoted unless pre-quoted in mapping.
- `apps/backend/acc-fw/src/test/java/com/acc/fw/jpa/MixedCaseQuotingPhysicalNamingStrategyTest.java`:
  Unit tests asserting mixed-case column quoting and verifying unquoted behavior for both all-caps (`UNIPOST_ENTITY_TYPES`) and mixed-case (`UNIPOST_IDENTITY_user`) table identifiers.
- `apps/backend/acc-ms-aio/src/main/resources/application.yml`:
  Wired `com.acc.fw.jpa.MixedCaseQuotingPhysicalNamingStrategy` under `spring.jpa.hibernate.naming.physical-strategy`.

## Verification
- Unit test execution:
  `node apps/backend/mvnw.cjs -pl acc-fw -Dtest=MixedCaseQuotingPhysicalNamingStrategyTest test` (2/2 tests pass).

## Walkthrough & Tasks
- Companion document: Registered in history record `411_postgresql_mixed_case_naming_strategy.md`.
