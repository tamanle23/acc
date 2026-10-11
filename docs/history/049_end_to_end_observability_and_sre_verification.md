# History Record 049: End-to-End Observability & SRE Production Verification (Phase 14)

## Problem Statement
Distributed operations in modern multi-tenant environments (e.g., entity mutations initiated in Mobile/Console traversing API gateways, transactional outboxes, asynchronous worker polling, and edge CDN cache invalidations) often lack cohesive tracing context. This creates operational blind spots during incident triage and makes end-to-end latency profiling challenging.

## Solution Architecture
1. **W3C TraceContext Propagation (`traceparent`)**:
   - Implemented standard `00-{traceId}-{spanId}-01` generation and propagation in `apps/console` Axios client, complementing `@unipost/client` universal client.
   - Enforced extraction and fallback generation in Spring Modulith gateway filter (`ContextFilter.java`).
   - Propagated trace context through transactional outbox events (`UNIPOST_EVENT_OUTBOX`) via `OutboxEventPublisher`.
   - Forwarded `traceparent` via HTTP headers in `WebhookDeliveryService` to edge CDN invalidation in `tekgo-ui`.
2. **Standardized MDC Logging**:
   - Enforced canonical format `[trace_id] [tenant_id] [user_id] [workspace_id]` across backend logback configs (`logback.xml`, `logback-local.xml`).
   - Synced MDC variables in `ContextFilter`, `JwtAuthenticationTokenFilter`, and `PublishableKeyFilter`.
   - Injected MDC variables during background event processing in `OutboxPollingJob`.

## Changes Summary
- `apps/console/src/features/spring-auth/api-client.ts`: Added W3C `traceparent` injection in request interceptor.
- `apps/console/src/features/spring-auth/__tests__/api-client-context.test.ts`: Added test for traceparent generation.
- `apps/backend/unipost-core/src/main/java/com/unipost/core/io/ContextHeader.java`: Added `traceparent` and `traceId`.
- `apps/backend/unipost-fw/src/main/java/com/unipost/fw/tracking/ContextFilter.java`: W3C traceparent extraction, MDC population, and response header echo.
- `apps/backend/unipost-fw/src/main/java/com/unipost/fw/core/jwt/JwtAuthenticationTokenFilter.java`: Populated `tenant_id` and `user_id` MDC keys.
- `apps/backend/unipost-fw/src/main/java/com/unipost/fw/security/PublishableKeyFilter.java`: Populated `tenant_id` MDC key.
- `apps/backend/unipost-fw/src/main/resources/logback.xml` & worker `logback-local.xml`: Standardized log pattern.
- `apps/backend/unipost-fw/src/main/java/com/unipost/outbox/OutboxEventPublisher.java`: Injected `traceparent` into outbox payload metadata.
- `apps/backend/unipost-ms-worker/src/main/java/com/unipost/worker/outbox/OutboxPollingJob.java`: Handled MDC context per event and forwarded traceparent.
- `apps/backend/unipost-ms-worker/src/main/java/com/unipost/worker/service/WebhookDeliveryService.java`: Supported traceparent header delivery.
- `apps/tekgo-ui/app/api/revalidate/route.ts`: Echoed traceparent in response headers and JSON body.
- `apps/backend/unipost-fw/src/test/java/com/unipost/fw/tracking/DistributedTracingMdcTest.java`: Added tests for traceparent and MDC.

## Verification
- Maven test runs in `unipost-fw` and `unipost-ms-worker`: All tests green.
- Vitest run in `apps/console`: 30 files passed, 147 tests passed.
- Vitest run in `apps/mobile-ui`: 3 files passed, 13 tests passed.
- Vitest run in `@unipost/client` and `@unipost/sandbox`: All tests passed.
- Next.js 15 production build in `tekgo-ui`: Passed.
