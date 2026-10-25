# Walkthrough 13: Implement Liquibase Context Profiling for Mock Data

## Changes Made
1. **[changelog-master.xml](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/identity/changelog-master.xml)**:
   - Added `context="dev, test, local, mock"` attribute to the `<include file="db/identity/changelog-mock_data.xml" />` tag.

2. **[changelog-mock_data.xml](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/identity/changelog-mock_data.xml)**:
   - Added `context="dev, test, local, mock"` attribute to the main `<changeSet>` tag.

3. **[application.yml](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/application.yml)**:
   - Configured `spring.liquibase.contexts: ${LIQUIBASE_CONTEXTS:dev,test,local}` so Spring Boot defaults to dev/test/local contexts locally.
   - In Production (`LIQUIBASE_CONTEXTS=prod`), Liquibase skips `changelog-mock_data.xml` completely.
