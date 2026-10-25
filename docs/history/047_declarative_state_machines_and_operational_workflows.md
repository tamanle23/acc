# 047. Declarative State Machines & Operational Workflows (Phase 12)

## Problem
Enterprise entities (e.g. orders, compliance cases, incident tickets) have dynamic business lifecycles. Without a declarative Finite State Machine (FSM), state transitions rely on fragmented procedural logic that lacks unified authorization, mandatory supporting attribute verification, and dynamic guard evaluations.

## Plan
1. Add Liquibase changeset `changelog-000.000.00010.xml` introducing `lifecycle_config` JSONB column to `UNIPOST_ENTITY_TYPES`.
2. Define domain models (`LifecycleConfig`, `TransitionConfig`, `EntityStateChangedEvent`) and update `EntityType` mapping and DTOs.
3. Implement `GuardEvaluatorStrategy` and `SpelGuardEvaluator`.
4. Implement `EntityLifecycleService` executing the 5-Gate validation engine (Tenant, Graph, Role, Required Attributes, SpEL Guards).
5. Integrate with `MetadataService` and expose `POST /entity-types/{id}/records/{recordId}/transition` in `MetadataController`.
6. Add `WorkflowAuditEventListener` for asynchronous domain event handling.
7. Run automated test suites and verify edge consumer builds.

## Changes
- **Database Migrations**:
  - [`changelog-000.000.00010.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00010.xml).
  - [`changelog-master.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/acc/changelog-master.xml).
- **Core Models & Workflow (`acc-fw`)**:
  - [`LifecycleConfig.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/LifecycleConfig.java).
  - [`TransitionConfig.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/TransitionConfig.java).
  - [`EntityStateChangedEvent.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/EntityStateChangedEvent.java).
  - [`EntityType.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/metadata/EntityType.java).
  - [`EntityTypeResponse.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/EntityTypeResponse.java).
  - [`MetadataDtoMapper.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/MetadataDtoMapper.java).
  - [`GuardEvaluatorStrategy.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/workflow/GuardEvaluatorStrategy.java).
  - [`SpelGuardEvaluator.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/workflow/SpelGuardEvaluator.java).
  - [`EntityLifecycleService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/workflow/EntityLifecycleService.java).
  - [`WorkflowAuditEventListener.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/workflow/WorkflowAuditEventListener.java).
  - [`MetadataService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java).
  - [`MetadataController.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/presentation/MetadataController.java).
- **Tests**:
  - [`EntityLifecycleServiceTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/test/java/com/acc/service/workflow/EntityLifecycleServiceTest.java).
  - Updated `MetadataServiceTest.java` and `MetadataControllerTest.java`.

## Verification
- `EntityLifecycleServiceTest`: 7/7 passed.
- `MetadataServiceTest`: 34/34 passed.
- `MetadataControllerTest`: 26/26 passed.
- `OutboxEventPublisherTest`: 2/2 passed.
- `OutboxPollingJobTest`: 4/4 passed.
- `WebhookDeliveryServiceTest`: 3/3 passed.
- `tekgo-ui` build: Passed.
