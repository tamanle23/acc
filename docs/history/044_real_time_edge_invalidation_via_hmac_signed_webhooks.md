# 044: Real-Time Edge Invalidation via HMAC Signed Webhooks (Phase 9)

## Problem
In static/ISR architectures, readers on `tekgo-ui` must wait for timer-based revalidation (e.g. 60 seconds) to observe changes made in `@acc/console` or `mobile-ui`. To achieve instant publication visibility, an authenticated webhook invalidation mechanism with replay protection is required.

## Plan
1. Create `WebhookDeliveryService` in `acc-ms-worker` generating HMAC-SHA256 signatures over timestamp and payload: `HMAC-SHA256(secret, timestamp + "." + body)`.
2. Implement edge cache invalidation endpoint `POST /api/revalidate` in `tekgo-ui` using Next.js 15 App Router.
3. Validate signature and reject requests where `|currentTime - timestamp| > 300` seconds.
4. Call `revalidatePath` and `revalidateTag` to purge edge cache on demand.
5. Verify via unit tests in `WebhookDeliveryServiceTest` and Next.js build.

## Changes
- `apps/backend/acc-ms-worker/src/main/java/com/acc/worker/service/WebhookDeliveryService.java`: HMAC-SHA256 webhook delivery service.
- `apps/backend/acc-ms-worker/src/test/java/com/acc/worker/service/WebhookDeliveryServiceTest.java`: Unit tests verifying HMAC calculation and HTTP dispatch.
- `apps/tekgo-ui/app/api/revalidate/route.ts`: On-demand edge cache invalidation route with timestamp replay prevention and HMAC validation.

## Verification
- `.\mvnw.cmd test -pl acc-ms-worker -Dtest=WebhookDeliveryServiceTest`: 3/3 tests passed.
- `pnpm --filter tekgo-ui build`: Next.js 15.5.12 build passed with 95 pages generated (including dynamic route `/api/revalidate`).
- `pnpm --filter @acc/client test`: Passed.
- `pnpm --filter @acc/sandbox test`: Passed.

## Tasks
- [x] Create WebhookDeliveryService in acc-ms-worker
- [x] Add automated unit tests for WebhookDeliveryService
- [x] Create /api/revalidate route in tekgo-ui
- [x] Verify Next.js production build

## Enhancement
Phase 10 will implement backend Optimistic Concurrency Control (OCC) and 3-way auto-merging in `acc-fw` to prevent concurrent field collisions across mobile and web editors.
