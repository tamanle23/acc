# Walkthrough - Real-Time Edge Invalidation via HMAC Signed Webhooks (Phase 9)

## Summary of Changes
Implemented instant edge cache invalidation for `tekgo-ui` using HMAC-SHA256 signed webhooks sent from the backend worker with replay attack protection.

### 1. Edge Revalidation API Endpoint
- Created [`apps/tekgo-ui/app/api/revalidate/route.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/tekgo-ui/app/api/revalidate/route.ts):
  - Enforces `x-unipost-signature` and `x-unipost-timestamp` validation.
  - Rejects replay requests older than 300 seconds.
  - Verifies `HMAC-SHA256(secret, timestamp + "." + rawBody)`.
  - Triggers Next.js on-demand revalidation: `revalidatePath('/blog/' + slug)`, `revalidateTag(tag)`, `revalidatePath('/blog')`, `revalidatePath('/')`.

### 2. Backend Webhook Delivery Service
- Created [`apps/backend/unipost-ms-worker/src/main/java/com/unipost/worker/service/WebhookDeliveryService.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-ms-worker/src/main/java/com/unipost/worker/service/WebhookDeliveryService.java):
  - Implemented `calculateHmac` generating standard SHA-256 hex strings.
  - Built `triggerEdgeRevalidation(slug, tag)` dispatching requests with `x-unipost-signature` and `x-unipost-timestamp` headers.
- Created [`apps/backend/unipost-ms-worker/src/test/java/com/unipost/worker/service/WebhookDeliveryServiceTest.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-ms-worker/src/test/java/com/unipost/worker/service/WebhookDeliveryServiceTest.java):
  - Validated HMAC generation, HTTP 200 success handling, and failure status handling.

## Verification Results
- `.\mvnw.cmd test -pl unipost-ms-worker -Dtest=WebhookDeliveryServiceTest`: 3/3 tests passed.
- `pnpm --filter tekgo-ui build`: Next.js 15 production build succeeded with 95 static and dynamic pages (`/api/revalidate` active).
