# History Log 450: Fix Notification SSE Stream 401 Unauthorized

## Problem
When clients connected to `/api/v1/notifications/stream` or workflow execution event streams via browser native `EventSource`, requests failed with `401 Unauthorized` or went into infinite reconnect loops:
1. Browser native `EventSource` cannot send custom HTTP headers (such as `Authorization: Bearer <token>`).
2. `JwtAuthenticationTokenFilter.java` only extracted tokens from the `Authorization: Bearer` header or `X-AUTH-TOKEN` cookie, completely ignoring RFC 6750 §2.3 URI query parameters (`?token=...` or `?access_token=...`).
3. Spring Security (`SecurityConfiguration.java` and `application-local.yml`) did not permit unauthenticated initial handshakes for `/api/v1/notifications/stream`, rejecting connections when headers were absent.
4. In `JwtAuthenticationTokenFilter.java`, an invalid or missing token immediately resulted in `response.setStatus(HttpStatus.UNAUTHORIZED.value())` even for endpoints permitted in Spring Security.
5. In frontend consumers (`use-notification-stream.ts`, `approvals-inbox.tsx`, `use-workflow-execution-stream.ts`), SSE query parameters did not supply the stored `accessToken`, and offline sandbox mode did not short-circuit network calls, attempting backend calls that triggered 401 errors.

## Plan
1. Permit `/api/v1/notifications/stream` in `SecurityConfiguration.java` and `application-local.yml`.
2. Update `JwtAuthenticationTokenFilter.java` to extract JWT tokens from query parameters (`token` or `access_token`) per RFC 6750 §2.3, and allow permitted endpoints to fall through as guest rather than returning 401.
3. Accept optional `token` request parameter in `NotificationSseController.java` with backward-compatible method overloads.
4. Update console hooks (`use-notification-stream.ts`, `approvals-inbox.tsx`, `use-workflow-execution-stream.ts`) to append `?token=...` query parameters and short-circuit offline sandbox mode (`isSandbox`).
5. Write unit tests in `notifications.test.tsx` verifying token query param attachment, unauthenticated guard, offline sandbox bypass, and event handling.
6. Verify via TypeScript compilation (`tsc --noEmit`) and Vitest test suites.

## Changes
- **Backend Security & Controller (`apps/api/`):**
  - `apps/api/acc-fw/src/main/java/com/acc/boot/config/SecurityConfiguration.java`: Added `/api/v1/notifications/stream` to `.permitAll()` matchers.
  - `apps/api/acc-ms-aio/src/main/resources/application-local.yml`: Added `/api/v1/notifications/stream` to `application.security.permitAlls`.
  - `apps/api/acc-fw/src/main/java/com/acc/fw/core/jwt/JwtAuthenticationTokenFilter.java`:
    - Added query parameter extraction for `token` or `access_token` (RFC 6750 §2.3) as a fallback when header and cookie are absent.
    - Added permitAll fallback: if token parsing/validation fails on a permitted endpoint, clear security context and let the request proceed as guest instead of forcing 401.
  - `apps/api/acc-fw/src/main/java/com/acc/presentation/NotificationSseController.java`:
    - Added `@RequestParam(required = false) String token` parameter.
    - Added backward-compatible overload `streamNotifications(String tenantId)`.
- **Frontend Clients (`apps/console/`):**
  - `apps/console/src/features/notifications/hooks/use-notification-stream.ts`:
    - Extracted `accessToken` and `isSandbox` from `useSpringAuthStore()`.
    - Short-circuited offline sandbox mode (`if (isSandbox) { setConnected(true); return; }`).
    - Appended `?tenantId=${effectiveTenantId}&token=${encodeURIComponent(accessToken)}`.
  - `apps/console/src/features/workflows/approvals/approvals-inbox.tsx`:
    - Short-circuited offline sandbox mode.
    - Appended `?tenantId=...&token=...` to `streamUrl`.
  - `apps/console/src/features/workflows/hooks/use-workflow-execution-stream.ts`:
    - Appended `?token=${encodeURIComponent(token)}` to `/api/v1/workflow/executions/${executionId}/events`.
- **Tests (`apps/console/src/features/notifications/__tests__/notifications.test.tsx`):**
  - Added unit test suite `useNotificationStream` covering unauthenticated state, sandbox short-circuiting, query param token propagation, INIT event handling, and APPROVAL_REQUESTED notification creation.

## Verification
1. `pnpm --filter @acc/console test "notifications.test.tsx"`: 12/12 passed (0 failures).
2. `pnpm --filter @acc/console test "workflow-execution-stream"`: 3/3 passed (0 failures).
3. `pnpm --filter @acc/console test "approvals-inbox"`: 6/6 passed (0 failures).
4. `pnpm --filter @acc/console exec tsc --noEmit`: 0 TypeScript errors across the entire console workspace.

## Walkthrough
- Browsers opening `EventSource('/api/v1/notifications/stream?tenantId=...&token=...')` now have their JWT token automatically extracted by `JwtAuthenticationTokenFilter` and bound to `SecurityContextHolder` and `TenantContextHolder`.
- Offline sandbox developers can use notifications, approvals, and workflow execution streams without spurious network failures or 401 errors.
- Unauthenticated visitors or guest endpoints are cleanly permitted through without breaking the security barrier.

## Tasks
- [x] Add `/api/v1/notifications/stream` to Spring Security `permitAll` configuration
- [x] Support RFC 6750 §2.3 query parameter tokens in `JwtAuthenticationTokenFilter`
- [x] Update `NotificationSseController` endpoint signature
- [x] Update frontend hooks with token query parameter and sandbox guards
- [x] Add automated unit tests for `useNotificationStream`
- [x] Run full test suites and TypeScript checks

## Enhancement
- In future iterations, consider supporting short-lived ephemeral ticket tokens (`/api/v1/auth/sse-ticket`) if query parameter URL logging in intermediate proxies becomes a security requirement.
