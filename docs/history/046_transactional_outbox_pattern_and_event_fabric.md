# 046. Transactional Outbox Pattern & Event Fabric (Phase 11)

## Problem
Direct asynchronous calls or webhooks embedded within user-facing API mutations introduce dual-write race conditions and network timeouts. A transactional outbox pattern guarantees atomic state transitions and eventual consistency across edge consumers (such as `tekgo-ui` ISR cache revalidators).

## Plan
1. Create Liquibase changeset `changelog-000.000.00009.xml` to define the `UNIPOST_EVENT_OUTBOX` table with partial polling index and PostgreSQL RLS policies, registered in `changelog-master.xml`.
2. Implement `OutboxEvent` entity and `OutboxEventRepository` with pessimistic `FOR UPDATE SKIP LOCKED` query in `unipost-fw`.
3. Implement `OutboxEventPublisher` enforcing mandatory transactions and hook it into `MetadataService` record mutations.
4. Implement `OutboxPollingJob` in `unipost-ms-worker` with periodic polling, edge webhook dispatching via `WebhookDeliveryService`, exponential backoff, and DLQ handling.
5. Verify tests and build across the monorepo.

## Changes
- **Liquibase Migrations**:
  - Added [`apps/backend/unipost-db/src/main/resources/db/unipost/changelog-000.000.00009.xml`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-db/src/main/resources/db/unipost/changelog-000.000.00009.xml).
  - Updated [`apps/backend/unipost-db/src/main/resources/db/unipost/changelog-master.xml`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-db/src/main/resources/db/unipost/changelog-master.xml).
- **Core Entity & Service (`unipost-fw`)**:
  - Created [`OutboxEvent.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/domain/outbox/OutboxEvent.java).
  - Created [`OutboxEventRepository.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/repository/jpa/OutboxEventRepository.java).
  - Created [`OutboxEventPublisher.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/outbox/OutboxEventPublisher.java).
  - Wired into [`MetadataService.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/service/MetadataService.java) for `createEntityRecord`, `updateEntityRecord`, and `deleteEntityRecord`.
- **Worker Job (`unipost-ms-worker`)**:
  - Created [`OutboxPollingJob.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-ms-worker/src/main/java/com/unipost/worker/outbox/OutboxPollingJob.java).
- **Tests & Artifacts**:
  - Created [`OutboxEventPublisherTest.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/test/java/com/unipost/outbox/OutboxEventPublisherTest.java).
  - Created [`OutboxPollingJobTest.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-ms-worker/src/test/java/com/unipost/worker/outbox/OutboxPollingJobTest.java).
  - Generated `implementation_plan_26.md` and `walkthrough_26.md` in `apps/backend/doc/`.

## Verification
- `OutboxEventPublisherTest`: 2/2 passed.
- `OutboxPollingJobTest`: 4/4 passed.
- `WebhookDeliveryServiceTest`: 3/3 passed.
- `MetadataServiceTest`: 33/33 passed.
- `tekgo-ui` production build: Passed.
