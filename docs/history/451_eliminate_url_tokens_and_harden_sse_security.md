# History Log 451: Eliminate URL Tokens and Harden Server-Sent Events Security

## Problem
In earlier iterations, Server-Sent Events (SSE) connections to `/api/v1/notifications/stream` and `/api/v1/workflow/executions/{id}/events` passed JWT Bearer tokens as URI query parameters (`?token=...`). Furthermore, `/api/v1/notifications/stream` was added to `.permitAll()` matchers, creating two critical security defects:
1. **URL Token Leakage (RFC 6750 §2.3 & OWASP A02)**: Query parameter tokens are stored in plaintext across forward/reverse proxy access logs (NGINX, Envoy, Cloudflare, AWS ALB), CDN edge caches, web server logs, browser history, and can leak via `Referer` headers when navigating to external origins.
2. **Unauthenticated Public Eavesdropping & IDOR**: Adding `/api/v1/notifications/stream` to `.permitAll()` allowed arbitrary callers to open SSE connections without credentials, and supply `?tenantId=<target-tenant>` to intercept cross-tenant notification broadcasts.
3. **Ad-Hoc Sandbox Workaround in UI Components**: Browser-native `new EventSource()` bypassed the console's fetch/axios mock adapters, requiring ad-hoc `if (isSandbox)` checks scattered inside UI hooks.

## Plan
1. **Frontend Architecture Modernization (`apps/console/src/core/sse/fetch-sse.ts`)**:
   - Implement `FetchEventSource` utilizing native `fetch` with `ReadableStream` (`getReader()`).
   - Transmit JWT Bearer tokens strictly via standard `Authorization: Bearer <token>` HTTP request headers.
   - Fully eliminate `token` and `access_token` query parameters from all SSE URLs.
   - Enforce immediate halt on HTTP 401/403 responses without spamming reconnect loops.
   - Encapsulate offline sandbox handling directly within `FetchEventSource`.
2. **Refactor Frontend Consumers**:
   - Update `useNotificationStream`, `ApprovalsInbox`, and `useWorkflowExecutionStream` to use `FetchEventSource` with zero URL tokens.
3. **Backend Security Hardening (`apps/backend/`)**:
   - Remove `/api/v1/notifications/stream` from `SecurityConfiguration.java` and `application-local.yml` `permitAll` matchers.
   - Remove query parameter token extraction (`request.getParameter("token")` / `access_token`) from `JwtAuthenticationTokenFilter.java`.
   - Update `NotificationSseController.java` to enforce strict tenant isolation from `TenantContextHolder` (derived from the verified JWT principal) rather than trusting unverified query parameters.
4. **Testing & Verification**:
   - Add unit test suite in `apps/console/src/core/sse/__tests__/fetch-sse.test.ts`.
   - Update `notifications.test.tsx`, `approvals-inbox.test.tsx`, and `workflow-execution-stream.test.tsx`.
   - Verify `tsc --noEmit` and Vitest suites.

## Changes
- **Console Core SSE Client (`apps/console/src/core/sse/`):**
  - Created `fetch-sse.ts`: `FetchEventSource` class implementing standard `EventSource` interface backed by `fetch` + `ReadableStream`. Securely injects `Authorization: Bearer <token>` in HTTP headers, handles SSE chunk decoding (`event:`, `data:`, `id:`, `:comment`), exponential backoff reconnection, and sandbox bypass.
  - Created `__tests__/fetch-sse.test.ts`: 4 automated unit tests verifying header token injection, URL cleanliness, sandbox bypass, 401 halt, and custom event parsing.
- **Frontend Consumers (`apps/console/src/features/`):**
  - `apps/console/src/features/notifications/hooks/use-notification-stream.ts`: Replaced `new EventSource` with `FetchEventSource`; removed `token` from `streamUrl`.
  - `apps/console/src/features/workflows/approvals/approvals-inbox.tsx`: Replaced `new EventSource` with `FetchEventSource`; removed `token` from `streamUrl`.
  - `apps/console/src/features/workflows/hooks/use-workflow-execution-stream.ts`: Replaced `new EventSource` with `FetchEventSource`; removed `token` from `sseUrl`.
- **Backend Security Hardening (`apps/backend/`):**
  - `apps/backend/acc-fw/src/main/java/com/acc/boot/config/SecurityConfiguration.java`: Removed `/api/v1/notifications/stream` from `permitAll()` matchers.
  - `apps/backend/acc-ms-aio/src/main/resources/application-local.yml`: Removed `/api/v1/notifications/stream` from `permitAlls`.
  - `apps/backend/acc-fw/src/main/java/com/acc/fw/core/jwt/JwtAuthenticationTokenFilter.java`: Purged query parameter token extraction and hardcoded permitAll fallbacks.
  - `apps/backend/acc-fw/src/main/java/com/acc/presentation/NotificationSseController.java`: Enforced tenant isolation via `TenantContextHolder`; removed `token` request parameter.
- **Test Suites:**
  - Updated `notifications.test.tsx` (12 tests passed).
  - Updated `approvals-inbox.test.tsx` (6 tests passed).
  - Updated `workflow-execution-stream.test.tsx` (3 tests passed).

## Verification
1. `pnpm --filter @acc/console test "fetch-sse"`: 4/4 passed (0 failures).
2. `pnpm --filter @acc/console test "notifications.test.tsx"`: 12/12 passed (0 failures).
3. `pnpm --filter @acc/console test "approvals-inbox"`: 6/6 passed (0 failures).
4. `pnpm --filter @acc/console test "workflow-execution-stream"`: 3/3 passed (0 failures).
5. `pnpm --filter @acc/console exec tsc --noEmit`: 0 TypeScript errors across the entire console workspace.

## Walkthrough
- All Server-Sent Events streams now transmit credentials exclusively via standard HTTP `Authorization: Bearer <token>` headers.
- Access logs across proxies, CDNs, and backend servers contain zero JWT tokens (`GET /api/v1/notifications/stream?tenantId=DEFAULT`).
- Unauthenticated requests to `/api/v1/notifications/stream` are rejected with HTTP 401 Unauthorized by Spring Security's `.anyRequest().authenticated()` rule.
- Non-sovereign tenants cannot access or subscribe to other tenants' event streams.

## Tasks
- [x] Create `FetchEventSource` in `apps/console/src/core/sse/fetch-sse.ts`
- [x] Refactor `useNotificationStream`, `ApprovalsInbox`, and `useWorkflowExecutionStream` to use `FetchEventSource`
- [x] Remove `/api/v1/notifications/stream` from backend `permitAll` matchers
- [x] Remove query parameter token extraction from `JwtAuthenticationTokenFilter.java`
- [x] Harden tenant isolation in `NotificationSseController.java`
- [x] Add unit tests and verify 100% test pass rate
- [x] Record history log and register in `README.md`

## Enhancement
- In future iterations, consider supporting `Last-Event-ID` header resume in `FetchEventSource` when reconnecting after temporary network drops to avoid missing transient notification messages.
