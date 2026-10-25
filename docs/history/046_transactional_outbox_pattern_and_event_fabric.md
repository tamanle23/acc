# 046. Transactional Outbox Pattern & Event Fabric (Phase 11)

## Problem
Direct asynchronous calls or webhooks embedded within user-facing API mutations introduce dual-write race conditions and network timeouts. A transactional outbox pattern guarantees atomic state transitions and eventual consistency across edge consumers (such as `tekgo-ui` ISR cache revalidators).

## Plan
1. Create Liquibase changeset `changelog-000.000.00009.xml` to define the `UNIPOST_EVENT_OUTBOX` table with partial polling index and PostgreSQL RLS policies, registered in `changelog-master.xml`.
2. Implement `OutboxEvent` entity and `OutboxEventRepository` with pessimistic `FOR UPDATE SKIP LOCKED` query in `acc-fw`.
3. Implement `OutboxEventPublisher` enforcing mandatory transactions and hook it into `MetadataService` record mutations.
4. Implement `OutboxPollingJob` in `acc-ms-worker` with periodic polling, edge webhook dispatching via `WebhookDeliveryService`, exponential backoff, and DLQ handling.
5. Verify tests and build across the monorepo.

## Changes
- **Liquibase Migrations**:
  - Added [`apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00009.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00009.xml).
  - Updated [`apps/backend/acc-db/src/main/resources/db/acc/changelog-master.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/acc/changelog-master.xml).
- **Core Entity & Service (`acc-fw`)**:
  - Created [`OutboxEvent.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/outbox/OutboxEvent.java).
  - Created [`OutboxEventRepository.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/OutboxEventRepository.java).
  - Created [`OutboxEventPublisher.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/outbox/OutboxEventPublisher.java).
  - Wired into [`MetadataService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java) for `createEntityRecord`, `updateEntityRecord`, and `deleteEntityRecord`.
- **Worker Job (`acc-ms-worker`)**:
  - Created [`OutboxPollingJob.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-worker/src/main/java/com/acc/worker/outbox/OutboxPollingJob.java).
- **Tests & Artifacts**:
  - Created [`OutboxEventPublisherTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/test/java/com/acc/outbox/OutboxEventPublisherTest.java).
  - Created [`OutboxPollingJobTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-worker/src/test/java/com/acc/worker/outbox/OutboxPollingJobTest.java).
  - Generated `implementation_plan_26.md` and `walkthrough_26.md` in `apps/backend/doc/`.

## Verification
- `OutboxEventPublisherTest`: 2/2 passed.
- `OutboxPollingJobTest`: 4/4 passed.
- `WebhookDeliveryServiceTest`: 3/3 passed.
- `MetadataServiceTest`: 33/33 passed.
- `tekgo-ui` production build: Passed.
