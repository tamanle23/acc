# Walkthrough 26: Transactional Outbox Pattern & Event Fabric (Phase 11)

## Summary of Changes
Implemented Phase 11 transactional outbox pattern to guarantee event consistency and asynchronous event delivery across microservices and edge clients using Liquibase migrations.

1. **Database Schema & Liquibase Migrations**:
   - Added [`changelog-000.000.00009.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00009.xml) defining `UNIPOST_EVENT_OUTBOX` with columns `event_id`, `aggregate_type`, `aggregate_id`, `tenant_id`, `event_type`, `payload`, `status`, `retry_count`, `max_retries`, `last_error`, `next_retry_at`, and `processed_at`.
   - Included index optimizations (`idx_outbox_pending_polling`, `idx_outbox_aggregate`) and PostgreSQL Row-Level Security policies.
   - Registered changeset in [`changelog-master.xml`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-db/src/main/resources/db/acc/changelog-master.xml).

2. **Entity & Repository Invariants**:
   - Implemented [`OutboxEvent`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/domain/outbox/OutboxEvent.java) extending `BaseModel`.
   - Implemented [`OutboxEventRepository`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/OutboxEventRepository.java) with `findPendingEventsForProcessing(@Param("limit") int limit)` executing native SQL with `FOR UPDATE SKIP LOCKED`.

3. **Transactional Event Publishing**:
   - Implemented [`OutboxEventPublisher`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/outbox/OutboxEventPublisher.java) enforcing mandatory transactions (`@Transactional(propagation = Propagation.MANDATORY)`).
   - Hooked publishing into [`MetadataService`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java) for `createEntityRecord`, `updateEntityRecord`, and `deleteEntityRecord`.

4. **Worker Polling & Edge Delivery Job**:
   - Implemented [`OutboxPollingJob`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-worker/src/main/java/com/acc/worker/outbox/OutboxPollingJob.java).
   - Periodically queries `findPendingEventsForProcessing`, triggers HMAC signed edge revalidation on `WebhookDeliveryService` for article changes, and tracks state with exponential backoff (`2^retryCount`) and Dead Letter Queue (`DEAD_LETTER`).

## Verification Results
- **Unit Tests**:
  - `OutboxEventPublisherTest`: Passed (2/2 tests).
  - `OutboxPollingJobTest`: Passed (4/4 tests: Success, Exponential Backoff, Dead-Letter, Skip future threshold).
  - `WebhookDeliveryServiceTest`: Passed (3/3 tests).
  - `MetadataServiceTest`: Passed (33/33 tests).
- **Client Build**:
  - `tekgo-ui` build succeeded with Next.js 15.
