# History Log 453: Unified Backend Envelope Error Extraction and Non-Success Rejection

## Problem
In the console UI, server-side failures returned by the Spring Boot backend (`ResponseWrapper`) were either falsely treated as successes or surfaced with generic messages like `"Request failed with status code 400"` or `"Something went wrong!"`:
1. **HTTP 200 False Successes**:
   The Spring Boot backend standardizes responses on `ResponseWrapper<ContextHeader, B>` with statuses `SUCCESS`, `FAIL`, and `ERROR`. Under certain controllers or exception scenarios, `ResponseEntityBuilder.fail(errors)` or `ResponseEntityBuilder.error(errors)` returned an HTTP 200 OK status code. Because Axios resolves any 2xx response, React Query and mutation hooks entered `onSuccess` instead of `onError`, corrupting local caches with `null` bodies and displaying false success toasts.
2. **Missing Backend Validation Message Extraction**:
   Spring Boot exception handlers (`GlobalExceptionHandler.java`) structure validation and business errors as:
   ```json
   {
     "status": "FAIL",
     "headers": {},
     "body": null,
     "errors": [
       { "code": "VALIDATION_FAILED", "message": "Email is already taken" }
     ]
   }
   ```
   Both `getErrorMessage` (`apps/console/src/core/utils/error-extractor.ts`) and `handleServerError` (`apps/console/src/lib/handle-server-error.ts`) inspected only `data.message` and `data.error`, completely overlooking the `data.errors` array. As a result, critical field validation errors were hidden from users.

## Plan
1. **Detect and Reject Non-Success Envelopes in `springApiClient`**:
   - In `apps/console/src/features/spring-auth/api-client.ts`, add a response interceptor check for Spring Boot `ResponseWrapper` payloads having `status === 'FAIL' || status === 'ERROR'`.
   - Reject the promise with an `AxiosError` holding the extracted backend error message and code so downstream mutation/query callers trigger `onError`.
   - Enrich `error.message` on rejected 4xx/5xx Axios errors when `error.response?.data` contains backend envelope errors.
2. **Standardize `error-extractor.ts`**:
   - Implement `isBackendEnvelopeFailure(data)` to reliably distinguish envelope errors from domain models with status fields.
   - Implement `extractEnvelopeErrorMessage(data)` to extract and join messages from `data.errors`, falling back to `message`, RFC 7807 `detail`, Spring `error`, and RFC 7807 `title`.
   - Update `getErrorMessage(err, fallbackMessage)` to use `extractEnvelopeErrorMessage`.
3. **Unify `handleServerError.ts`**:
   - Delegate error message extraction in `handleServerError` directly to `getErrorMessage`, while preserving 429 rate limit countdowns and 204 content not found toasts.
4. **Update Profile Form**:
   - In `apps/console/src/features/settings/profile/profile-form.tsx`, use `getErrorMessage(err, 'Failed to update profile')` in the catch block.
5. **Testing & Verification**:
   - Add unit tests for `error-extractor.ts` covering all envelope permutations and fallbacks.
   - Add unit tests for `springApiClient` envelope handling verifying rejection of HTTP 200 failure envelopes and enrichment of HTTP 400 errors.
   - Add unit tests for `handleServerError.ts`.

## Changes
- **Core Utility (`apps/console/src/core/utils/error-extractor.ts`):**
  - Added `BackendErrorItem` interface and extended `ApiErrorResponse` with `errors`, `detail`, `title`, `body`, and `headers`.
  - Added `isBackendEnvelopeFailure(data)` checking for `FAIL` or `ERROR` alongside envelope keys (`errors`, `body`, `headers`).
  - Added `extractEnvelopeErrorMessage(data)` for array unpacking, item fallback, and Problem Details support.
  - Enhanced `getErrorMessage` to process Axios errors, raw payload objects, standard Errors, and strings.
- **API Client (`apps/console/src/features/spring-auth/api-client.ts`):**
  - Updated response interceptor to detect and reject non-success envelopes via `Promise.reject(new AxiosError(...))`.
  - Enriched `error.message` on 4xx/5xx responses with extracted backend messages.
- **Error Handler (`apps/console/src/lib/handle-server-error.ts`):**
  - Delegated message extraction to `getErrorMessage` for unified toast reporting.
- **Form Component (`apps/console/src/features/settings/profile/profile-form.tsx`):**
  - Integrated `getErrorMessage` in `onSubmit` catch handler.
- **Automated Tests:**
  - Created `apps/console/src/core/utils/__tests__/error-extractor.test.ts` (21 unit tests).
  - Created `apps/console/src/features/spring-auth/__tests__/api-client-envelope.test.ts` (4 integration tests).
  - Created `apps/console/src/lib/__tests__/handle-server-error.test.ts` (4 unit tests).

## Verification
- `pnpm --filter @acc/console test error-extractor`: 21/21 passed.
- `pnpm --filter @acc/console test api-client-envelope`: 4/4 passed.
- `pnpm --filter @acc/console test handle-server-error`: 4/4 passed.
- `pnpm --filter @acc/console test profile-form`: 7/7 passed.
- `pnpm --filter @acc/console test use-user-profile`: 3/3 passed.
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.

## Walkthrough
When the backend responds with a failure:
1. If the backend returns HTTP 200 with `{ status: "FAIL", errors: [{ message: "Email already taken" }] }`, `springApiClient` intercepts the response, detects `isBackendEnvelopeFailure`, extracts `"Email already taken"`, and rejects with `AxiosError`.
2. React Query marks the mutation as failed, preventing cache corruption and false-positive success toasts.
3. Global mutation `onError` or component `catch` routes the error through `handleServerError` or `getErrorMessage`.
4. A Sonner toast displays the exact message: `"Email already taken"`.
