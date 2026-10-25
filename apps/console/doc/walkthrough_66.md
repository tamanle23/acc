# Walkthrough 66: Phase 4 payOS VietQR Integration & Dynamic Feature Entitlements Engine

## 1. Executive Summary
This document records the complete implementation of **Phase 4 of the Domain Blueprints Full-Stack Ecosystem**:
- **Backend FinOps & Capability Gating**:
  - Liquibase migration adding `UNIPOST_TENANT_BILLING` and `UNIPOST_TENANT_FEATURES` with PostgreSQL Row-Level Security (RLS) policies and partial uniqueness indexes.
  - JPA entity mappings: `TenantBilling` and `TenantFeature`.
  - JPA repositories: `TenantBillingRepository` and `TenantFeatureRepository`.
  - Spring Modulith Aspect `@RequireFeature` and `FeatureEntitlementAspect` enforcing dynamic token permissions with `FeatureNotEntitledException` (HTTP 403).
  - `PayOsBillingService` managing payment link generation (dynamic VietQR Napas247, order codes) and cryptographic HMAC-SHA256 webhook processing.
  - `TenantBillingController` exposing `/api/v1/billing/summary`, `/api/v1/billing/checkout`, and public `/api/v1/billing/payos/webhook`.
- **Frontend Capability Guards & Checkout UI**:
  - `use-billing.ts` TanStack Query hooks (`useTenantBilling`, `useCreatePaymentLink`, `useSimulatePaymentWebhook`).
  - `<FeatureGate />` component wrapping advanced capabilities with a Liquid Glass frosted scrim, upgrade teaser banner, and instant unlock flow.
  - `PayOsQrModal` rendering dynamic VietQR code, order info, and 0s instant webhook simulation.
  - Unified Sandbox Platform handler `billingSandboxHandler` registered in `sandboxRegistry`.

---

## 2. Changes Made Across Modules

### A. Backend (`@acc/backend`)
1. **Liquibase Migration (`apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00006.xml`)**:
   - `UNIPOST_TENANT_BILLING`: columns `tenant_id`, `payos_customer_id`, `current_order_code`, `plan_tier`, `billing_cadence`, `status`, `amount_paid`, `expires_at`, `created_date`, `last_updated_date`.
   - `UNIPOST_TENANT_FEATURES`: columns `id`, `tenant_id`, `feature_key`, `is_enabled`, `expires_at`, `created_date`, `last_updated_date`.
   - Row-Level Security policies `tenant_isolation_billing` and `tenant_isolation_features` matching `app.current_tenant_id`.
   - Partial unique index on `(tenant_id, feature_key)`.
2. **Domain & Repositories (`acc-fw`)**:
   - `TenantBilling.java` and `TenantFeature.java`.
   - `TenantBillingRepository.java` and `TenantFeatureRepository.java`.
3. **Dynamic Entitlements Engine (`acc-fw`)**:
   - `@RequireFeature` annotation.
   - `FeatureNotEntitledException.java`.
   - `TenantEntitlementService.java` & `DefaultTenantEntitlementService.java` with L1 cache fabric and tier mappings (`BASIC`, `PRO`, `PRO_MAX`).
   - `FeatureEntitlementAspect.java` intercepting protected methods.
4. **payOS Client & Controllers (`acc-fw`)**:
   - `PayOsBillingService.java` with HMAC-SHA256 signature verification and VietQR payload generation.
   - `TenantBillingController.java` with Spring Security configuration.
5. **Unit Tests (`acc-fw`)**:
   - `PayOsBillingAndEntitlementsTest.java` verifying default entitlements, Pro/Pro Max unlocks, VietQR link generation, valid HMAC webhook activation, and forged webhook signature rejection.

### B. Frontend (`@acc/console`)
1. **API Hooks (`src/features/metadata/api/use-billing.ts`)**:
   - `useTenantBilling()`: queries `/api/v1/billing/summary`.
   - `useCreatePaymentLink()`: posts to `/api/v1/billing/checkout`.
   - `useSimulatePaymentWebhook()`: posts to `/api/v1/billing/payos/webhook`.
2. **Components (`src/features/metadata/components/billing/`)**:
   - `PayOsQrModal`: High-elevation Liquid Glass modal rendering dynamic VietQR, bank transfer info, order code copy, and instant simulation.
   - `FeatureGate`: In-app feature guard rendering a blurred frosted scrim over locked tabs/views with an upgrade CTA.
3. **UI Integration**:
   - Wrapped `SchemaBuilder` tab (`FEATURE_SCHEMA_STUDIO`) and `RelationshipTypesManager` tab (`FEATURE_PATTERN_C_GRAPH`) in `MetadataFeature`.
   - Connected `PayOsQrModal` to `LandingPage` and `OnboardingFunnelModal`.
4. **Sandbox & Tests**:
   - Created `billingSandboxHandler` in `src/core/sandbox/handlers/billing-sandbox-handler.ts` and registered in `sandboxRegistry`.
   - Added unit test `feature-gate.test.tsx` verifying transparent pass-through for entitled tenants and frosted teaser scrim for unentitled tenants.

---

## 3. Verification & Quality Assurance
- **Backend Test Suite:** `mvnw.cmd test -pl acc-fw -Dtest=PayOsBillingAndEntitlementsTest` passed 5/5 tests.
- **Backend Build:** `mvnw.cmd test-compile -DskipTests` passed on all 10 reactor modules.
- **Frontend Typecheck:** `pnpm --filter @acc/console exec tsc --noEmit` passed with 0 errors.
- **Frontend Test Suite:** `pnpm --filter @acc/console test` passed all 16 test files (83 tests).
