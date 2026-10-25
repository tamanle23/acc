# Implementation Plan 26: Transactional Outbox Pattern & Event Fabric (Phase 11)

## Problem Statement
Microservices and external edge consumers (such as `tekgo-ui` edge cache invalidators) need reliable, atomic notifications of entity changes without dual-write inconsistency risks or hard transactional rollbacks caused by network latency or temporary third-party failures.

## Architectural Design
1. **Liquibase Migration (`UNIPOST_EVENT_OUTBOX`)**:
   - Table `UNIPOST_EVENT_OUTBOX` defined in `changelog-000.000.00009.xml` using Liquibase standard XML.
   - Includes partial indexes (`idx_outbox_pending_polling`, `idx_outbox_aggregate`) and PostgreSQL Row-Level Security policies.
2. **Transactional Event Publishing**:
   - `OutboxEvent` JPA entity mapping and `OutboxEventRepository` with pessimistic concurrency (`SKIP LOCKED`).
   - `OutboxEventPublisher` in `acc-fw` providing mandatory transaction semantics (`@Transactional(propagation = Propagation.MANDATORY)`).
   - Hooked into `MetadataService` record mutations (`createEntityRecord`, `updateEntityRecord`, `deleteEntityRecord`).
3. **Outbox Polling Worker Job**:
   - `OutboxPollingJob` in `acc-ms-worker` running periodically.
   - Reads pending events in batches with `findPendingEventsForProcessing(batchSize)`.
   - Dispatches edge cache invalidation webhooks to `WebhookDeliveryService` for article publications and mutations.
   - Manages state machine: `PENDING` -> `PUBLISHED` or exponential backoff (`2^retryCount` seconds) -> `DEAD_LETTER` once `retryCount >= maxRetries`.

## Verification Plan
1. Run `OutboxEventPublisherTest` in `acc-fw`.
2. Run `OutboxPollingJobTest` in `acc-ms-worker`.
3. Verify `MetadataServiceTest` with outbox publishing compatibility.
4. Verify full build integrity across backend and edge consumers.
