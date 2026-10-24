# 201. Multi-Gateway Provider-Agnostic Billing Migration & Cleanup

## Problem Statement
Following the release of persistence specification v1.2.0, the physical database schema and Java domain entities for billing were still locked into payOS-specific column names:
1. `UNIPOST_TENANT_BILLING` had `payos_customer_id VARCHAR(255)` and `current_order_code BIGINT`, creating a tight coupling to a single payment gateway.
2. `TenantBilling.java` lacked generic provider columns (`payment_provider`, `provider_customer_ref`, `current_order_ref`, `currency`, `billing_metadata`).
3. An obsolete import of `com.unipost.user.model.UserProfile` lingered in `GlobalBindingInitializer.java` in `unipost-ms-aio`.

## Proposed Plan
1. Create incremental Liquibase migration `changelog-000.000.00015.xml` adding:
   - `payment_provider VARCHAR(50) DEFAULT 'PAYOS'`
   - `provider_customer_ref VARCHAR(255)`
   - `current_order_ref VARCHAR(255)`
   - `currency VARCHAR(10) DEFAULT 'VND'`
   - `billing_metadata JSONB DEFAULT '{}'`
   - Backfill existing rows and add indexes on `(payment_provider, current_order_ref)` and `(payment_provider, provider_customer_ref)`.
2. Link `changelog-000.000.00015.xml` into `db/unipost/changelog-master.xml`.
3. Update `TenantBilling.java` JPA entity with the generic fields while retaining the legacy getters/setters for non-breaking backward compatibility.
4. Update `TenantBillingRepository.java` with provider-agnostic finders.
5. Update `PayOsBillingService.java` and `DefaultTenantEntitlementService.java` to populate and resolve via generic provider columns.
6. Remove the dead `UserProfile` import in `GlobalBindingInitializer.java`.
7. Execute test suites to verify zero regressions.

## Key Changes
- **Liquibase Schema Migration**:
  - Added `apps/backend/unipost-db/src/main/resources/db/unipost/changelog-000.000.00015.xml`.
  - Updated `apps/backend/unipost-db/src/main/resources/db/unipost/changelog-master.xml`.
- **Domain Persistence Layer**:
  - Modified `TenantBilling.java` with `@Column(name = "payment_provider")`, `@Column(name = "provider_customer_ref")`, `@Column(name = "current_order_ref")`, `@Column(name = "currency")`, and `@Column(name = "billing_metadata", columnDefinition = "jsonb")`.
  - Added finders `findByPaymentProviderAndCurrentOrderRef` and `findByPaymentProviderAndProviderCustomerRef` in `TenantBillingRepository.java`.
- **Services**:
  - `PayOsBillingService.java`: Sets `paymentProvider = "PAYOS"`, `currency = "VND"`, `currentOrderRef = String.valueOf(orderCode)` alongside legacy columns.
  - `DefaultTenantEntitlementService.java`: Falls back to `findByPaymentProviderAndCurrentOrderRef` on subscription activation.
- **Hygiene & Cleanup**:
  - Removed obsolete `com.unipost.user.model.UserProfile` import in `GlobalBindingInitializer.java`.

## Verification
- Backend compilation: `mvnw.cmd test-compile -q` executed cleanly (Exit Code 0).
- Unit and integration tests: `PayOsBillingAndEntitlementsTest`, `RecordMutationPipelineTest`, `SchemaValidationServiceTest`, `CompositeRecordServiceTest`, `MetadataServiceTest` verified green (Exit Code 0).
- Console type checking: `pnpm --filter @unipost/console exec tsc --noEmit` verified clean (Exit Code 0).
