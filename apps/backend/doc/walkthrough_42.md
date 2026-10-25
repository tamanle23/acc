# Walkthrough 42: Backend Unified Sandbox Platform (Phase 2 - Boundary Simulators & Drop-ins)

## Overview
Phase 2 of Iteration 8 connects the **Backend Unified Sandbox Platform** to production service boundaries via transparent, non-invasive design patterns (AOP interceptors, `@Primary` drop-in service beans) without modifying any production business logic in `acc-fw`, `acc-ms-fs`, or `acc-ms-worker`.

---

## Key Implementations & Design Patterns

1. **PayOS VietQR Auto-Confirm Interceptor Aspect**:
   - [`PayOsCheckoutInterceptorAspect.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/aspect/PayOsCheckoutInterceptorAspect.java):
     - Uses AspectJ `@AfterReturning` pointcut targeting `PayOsBillingService.createPaymentLink(..)`.
     - Automatically registers generated orders in `PayOsSimulator` and triggers the scheduled or instant payment webhook with authentic HMAC-SHA256 signature to `/api/v1/billing/payos/webhook`.
     - Completely decoupled; zero edits to `PayOsBillingService`.

2. **In-Memory Storage Connector Drop-in (`StorageConnector`)**:
   - [`InMemoryStorageConnector.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/simulators/InMemoryStorageConnector.java):
     - Implements `com.acc.fs.connector.StorageConnector` with `@Primary` and `@ConditionalOnProperty(name="application.sandbox.enabled", havingValue="true")`.
     - Stores uploaded files directly in `InMemoryStorageSimulator` (memory map) with MD5 checksum calculation and streaming retrieval.
     - Automatically picked up by `StorageServiceFactory` in `acc-ms-fs` when sandbox is enabled, eliminating MinIO/S3 dependencies.

3. **Mock Webhook Delivery Drop-in (`WebhookDeliveryService`)**:
   - [`MockWebhookDeliveryService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/simulators/MockWebhookDeliveryService.java):
     - Extends `com.acc.worker.service.WebhookDeliveryService` with `@Primary` and `@ConditionalOnProperty(name="application.sandbox.enabled", havingValue="true")`.
     - Intercepts edge invalidation calls from `OutboxPollingJob`, records payloads in `MockWebhookDispatcher`, and returns HTTP 200, enabling outbox events to be marked as `DELIVERED` without external HTTP listeners.

---

## Verification Results

### 1. New Unit Tests in `acc-sandbox`
```powershell
mvn test -f apps/backend/acc-sandbox/pom.xml -q
```
- `BackendSandboxRegistryTest`: 3 passed.
- `PayOsSimulatorTest`: 3 passed.
- `InMemoryStorageSimulatorTest`: 2 passed.
- `InMemoryStorageConnectorTest`: 1 passed.
- `MockWebhookDispatcherTest`: 3 passed.
- `MockWebhookDeliveryServiceTest`: 1 passed.
- `SandboxDecouplingIntegrationTest`: 3 passed.
- **Total: 16 passed, 0 failures**.

### 2. Multi-Module Backend Regression Check
```powershell
mvn test -f apps/backend/pom.xml -q
```
- Full suite (300+ tests across `acc-fw`, `acc-ms-identity`, `acc-ms-fs`, `acc-ms-worker`, `acc-ms-aio`, `acc-sandbox`) passed with zero regressions.
- JaCoCo 90% hard gate satisfied.

### 3. Playwright E2E Billing Verification (Flow 08)
```powershell
pnpm --filter @acc/console exec playwright test e2e/08-finops-vietqr-billing.spec.ts
```
- Verified plan pricing selector, VietQR payment dialog, and simulated payment confirmation.
- 1 passed (5.4s), 0 accessibility violations.
