# Implementation Plan - Real-Time Edge Invalidation via HMAC Signed Webhooks (Phase 9)

## Problem Statement
When content is published or updated in `@unipost/console` or `mobile-ui`, edge readers in `tekgo-ui` (Next.js 15) must reflect updates immediately without waiting for static ISR timers to expire, while strictly protecting against replay attacks and forged invalidations.

## Architecture & Implementation Overview
1. **Next.js Revalidation Route (`apps/tekgo-ui/app/api/revalidate/route.ts`)**:
   - Signature header: `x-unipost-signature: HMAC-SHA256(secret, timestamp + "." + rawBody)`.
   - Timestamp header: `x-unipost-timestamp: <unix-seconds>`.
   - Replay protection: Rejects requests if `|currentTime - timestamp| > 300` seconds (HTTP 401).
   - Cryptographic verification: Recomputes HMAC-SHA256 with `process.env.UNIPOST_WEBHOOK_SECRET` and matches in constant time.
   - On success: Calls `revalidatePath('/blog/[...slug]')`, `revalidateTag(tag)`, `revalidatePath('/blog')`, and `revalidatePath('/')`.
2. **Worker Webhook Delivery Service (`apps/backend/unipost-ms-worker/src/main/java/com/unipost/worker/service/WebhookDeliveryService.java`)**:
   - Computes HMAC-SHA256 hex signatures.
   - Builds POST request to `tekgo-ui` with timestamp and signature headers.
   - Delivers payloads with timeout safety and logging.
3. **Automated Testing**:
   - `WebhookDeliveryServiceTest`: Validates HMAC calculation, successful HTTP 200 delivery, and error handling on 500 responses.
   - Next.js build verification covering dynamic `/api/revalidate` route.

## Verification
- `.\mvnw.cmd test -pl unipost-ms-worker -Dtest=WebhookDeliveryServiceTest`: Passed.
- `pnpm --filter tekgo-ui build`: Next.js production build succeeded with `/api/revalidate` route active.
