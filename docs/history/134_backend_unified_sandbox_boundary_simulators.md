# 134. Backend Unified Sandbox Platform: Transparent Boundary Simulators & Drop-ins (Iteration 8 Phase 2)

## Problem
In Phase 2 of Iteration 8, the boundary simulators implemented in `acc-sandbox` (PayOS VietQR, InMemory S3, and Mock Webhooks) needed to be wired transparently into production services without altering production code in `acc-fw`, `acc-ms-fs`, or `acc-ms-worker`, ensuring strict decoupling and zero regressions.

## Plan
1. Implement `PayOsCheckoutInterceptorAspect` using AspectJ `@AfterReturning` on `PayOsBillingService.createPaymentLink` to automatically register orders in `PayOsSimulator` and trigger payment webhooks with authentic HMAC-SHA256 signatures.
2. Implement `InMemoryStorageConnector` implementing `StorageConnector` as a `@Primary` bean for `acc-ms-fs`.
3. Implement `MockWebhookDeliveryService` extending `WebhookDeliveryService` as a `@Primary` bean for `acc-ms-worker`.
4. Import the new drop-ins conditionally into `SandboxAutoConfiguration`.
5. Write unit tests for all drop-in implementations and verify the full backend test suite.
6. Verify E2E Flow 08 via Playwright.

## Changes
- **Module `apps/backend/acc-sandbox`**:
  - `pom.xml`: Added provided dependencies on `acc-ms-fs` and `acc-ms-worker`.
  - `PayOsCheckoutInterceptorAspect.java`: Intercepts `createPaymentLink` and delegates to `PayOsSimulator`.
  - `InMemoryStorageConnector.java`: `@Primary` drop-in bean implementing `StorageConnector`.
  - `MockWebhookDeliveryService.java`: `@Primary` drop-in bean extending `WebhookDeliveryService`.
  - `SandboxAutoConfiguration.java`: Updated `@Import` annotations.
- **Tests**:
  - `InMemoryStorageConnectorTest.java`: Verified file storing, loading as resource, and deletion in memory.
  - `MockWebhookDeliveryServiceTest.java`: Verified edge revalidation interception and dispatcher payload capture.

## Verification
- `mvn test -f apps/backend/acc-sandbox/pom.xml -q`: 16 tests passed.
- `mvn test -f apps/backend/pom.xml -q`: Full multi-module suite passed with 0 regressions, preserving JaCoCo 90% hard gate.
- `pnpm --filter @acc/console exec playwright test e2e/08-finops-vietqr-billing.spec.ts`: Passed (1/1).

## Walkthrough
Refer to `apps/backend/doc/walkthrough_42.md` for complete design pattern details.

## Tasks
- [x] Implement PayOS AOP checkout interceptor aspect
- [x] Implement drop-in InMemoryStorageConnector bean
- [x] Implement drop-in MockWebhookDeliveryService bean
- [x] Register new drop-in beans in SandboxAutoConfiguration
- [x] Write unit tests and verify full multi-module backend test suite
- [x] Verify Playwright E2E Flow 08 passes cleanly
- [x] Document walkthrough and history record
