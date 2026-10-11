# Implementation Plan - Phase 14: End-to-End Observability & SRE Production Verification

Implement full-stack distributed tracing with standard W3C `traceparent` propagation across Mobile $\to$ Console $\to$ Gateway $\to$ Modulith $\to$ Outbox $\to$ Tekgo, and standardizes MDC logging.

## Proposed Changes

### 1. Frontend & Client SDK Tracing Propagation
- **`apps/console/src/features/spring-auth/api-client.ts`**:
  - Integrate `generateTraceparent` from `@unipost/client` into Axios request interceptor.
  - Automatically attach `traceparent: 00-{traceId}-{spanId}-01` to all outgoing HTTP requests.

### 2. Backend MDC & Distributed Tracing Ingestion
- **`apps/backend/unipost-core/src/main/java/com/unipost/core/io/ContextHeader.java`**:
  - Add `traceparent` and `traceId` attributes.
- **`apps/backend/unipost-fw/src/main/java/com/unipost/fw/tracking/ContextFilter.java`**:
  - Parse incoming W3C `traceparent` header (`00-{traceId}-{spanId}-{flags}`) or generate standard W3C header if absent.
  - Populate standardized MDC keys: `[trace_id] [tenant_id] [user_id] [workspace_id]`.
  - Echo `traceparent` back in response headers for full-stack correlation.
- **`apps/backend/unipost-fw/src/main/java/com/unipost/fw/core/jwt/JwtAuthenticationTokenFilter.java`**:
  - Mirror MDC keys `tenant_id` alongside `tenantId` and `user_id` alongside `userId`.
- **`apps/backend/unipost-fw/src/main/java/com/unipost/fw/security/PublishableKeyFilter.java`**:
  - Populate both `tenant_id` and `tenantId` in MDC.
- **Logback Encoders**:
  - Update `logback.xml` and `logback-local.xml` patterns to display `[%X{trace_id:-}] [%X{tenant_id:-}] [%X{user_id:-}] [%X{workspace_id:-}]`.

### 3. Outbox Event & Edge Webhook Tracing Propagation
- **`apps/backend/unipost-fw/src/main/java/com/unipost/outbox/OutboxEventPublisher.java`**:
  - Capture active `trace_id` from MDC and propagate W3C `traceparent` into outbox event payload metadata.
- **`apps/backend/unipost-ms-worker/src/main/java/com/unipost/worker/outbox/OutboxPollingJob.java`**:
  - Extract `trace_id` and `tenant_id` from event payload into MDC during polling execution.
  - Pass `traceparent` downstream to `WebhookDeliveryService`.
- **`apps/backend/unipost-ms-worker/src/main/java/com/unipost/worker/service/WebhookDeliveryService.java`**:
  - Support overloaded `triggerEdgeRevalidation` accepting `traceparent` and forward it as an HTTP header to Next.js.
- **`apps/tekgo-ui/app/api/revalidate/route.ts`**:
  - Extract incoming `traceparent` header and echo it back in the JSON response and response header.

### 4. Automated Verification & Testing
- Add `DistributedTracingMdcTest.java` in `unipost-fw`.
- Update `api-client-context.test.ts` in `apps/console`.
- Verify `OutboxPollingJobTest.java` in `unipost-ms-worker`.
- Verify Next.js 15 build in `tekgo-ui`.
