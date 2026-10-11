# Walkthrough 27: Declarative State Machines & Operational Workflows (Phase 12)

## Summary of Changes
Implemented Phase 12 declarative state machines and operational workflows following [`docs/brainstorming/track_2_declarative_state_machines_design.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/brainstorming/track_2_declarative_state_machines_design.md):

1. **Liquibase Migration (`UNIPOST_ENTITY_TYPES.lifecycle_config`)**:
   - Added [`changelog-000.000.00010.xml`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-db/src/main/resources/db/unipost/changelog-000.000.00010.xml) adding `lifecycle_config` JSONB column.
   - Included in [`changelog-master.xml`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-db/src/main/resources/db/unipost/changelog-master.xml).

2. **Domain Models & DTOs**:
   - Created [`LifecycleConfig`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/domain/metadata/LifecycleConfig.java) and [`TransitionConfig`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/domain/metadata/TransitionConfig.java).
   - Created [`EntityStateChangedEvent`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/domain/metadata/EntityStateChangedEvent.java).
   - Extended [`EntityType`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/domain/metadata/EntityType.java) with `lifecycleConfig` JSONB mapping.
   - Updated [`EntityTypeResponse`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/presentation/dto/metadata/EntityTypeResponse.java) and [`MetadataDtoMapper`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/presentation/dto/metadata/MetadataDtoMapper.java).

3. **5-Gate Sequential Validation Engine**:
   - Implemented [`GuardEvaluatorStrategy`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/service/workflow/GuardEvaluatorStrategy.java) and [`SpelGuardEvaluator`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/service/workflow/SpelGuardEvaluator.java).
   - Implemented [`EntityLifecycleService`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/service/workflow/EntityLifecycleService.java) executing the 5 validation gates (Tenant check, Transition graph check, Allowed roles check, Required attributes check, and Dynamic guard SpEL check).
   - Implemented [`WorkflowAuditEventListener`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/service/workflow/WorkflowAuditEventListener.java) for asynchronous audit logging.

4. **Service & Controller Endpoints**:
   - Updated [`MetadataService`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/service/MetadataService.java) to initialize state on creation and support `transitionRecordState`.
   - Added REST endpoint in [`MetadataController`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/presentation/MetadataController.java):
     `POST /api/v1/metadata/entity-types/{id}/records/{recordId}/transition?action={action}`.

## Verification Results
- **Automated Tests**:
  - `EntityLifecycleServiceTest`: 7/7 tests passed covering all 5 gates.
  - `MetadataServiceTest`: 34/34 tests passed.
  - `MetadataControllerTest`: 26/26 tests passed.
  - `OutboxEventPublisherTest`: 2/2 tests passed.
  - `OutboxPollingJobTest`: 4/4 tests passed.
  - `WebhookDeliveryServiceTest`: 3/3 tests passed.
- **Client Build**:
  - `tekgo-ui` build succeeded with Next.js 15.
