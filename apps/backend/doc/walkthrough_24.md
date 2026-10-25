# Walkthrough - Real-Time Edge Invalidation via HMAC Signed Webhooks (Phase 9)

## Summary of Changes
Implemented instant edge cache invalidation for `tekgo-ui` using HMAC-SHA256 signed webhooks sent from the backend worker with replay attack protection.

### 1. Edge Revalidation API Endpoint
- Created [`apps/tekgo-ui/app/api/revalidate/route.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/tekgo-ui/app/api/revalidate/route.ts):
  - Enforces `x-acc-signature` and `x-acc-timestamp` validation.
  - Rejects replay requests older than 300 seconds.
  - Verifies `HMAC-SHA256(secret, timestamp + "." + rawBody)`.
  - Triggers Next.js on-demand revalidation: `revalidatePath('/blog/' + slug)`, `revalidateTag(tag)`, `revalidatePath('/blog')`, `revalidatePath('/')`.

### 2. Backend Webhook Delivery Service
- Created [`apps/backend/acc-ms-worker/src/main/java/com/acc/worker/service/WebhookDeliveryService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-worker/src/main/java/com/acc/worker/service/WebhookDeliveryService.java):
  - Implemented `calculateHmac` generating standard SHA-256 hex strings.
  - Built `triggerEdgeRevalidation(slug, tag)` dispatching requests with `x-acc-signature` and `x-acc-timestamp` headers.
- Created [`apps/backend/acc-ms-worker/src/test/java/com/acc/worker/service/WebhookDeliveryServiceTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-worker/src/test/java/com/acc/worker/service/WebhookDeliveryServiceTest.java):
  - Validated HMAC generation, HTTP 200 success handling, and failure status handling.

## Verification Results
- `.\mvnw.cmd test -pl acc-ms-worker -Dtest=WebhookDeliveryServiceTest`: 3/3 tests passed.
- `pnpm --filter tekgo-ui build`: Next.js 15 production build succeeded with 95 static and dynamic pages (`/api/revalidate` active).
