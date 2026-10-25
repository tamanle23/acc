# 042: Backend Public Ingestion Gateway & Publishable Key Protocol (Phase 7)

## Problem
In multi-tier monorepos, public reader portals (e.g., `tekgo-ui` Next.js frontend or public mobile readers) must consume published articles without administrator JWT credentials, while strictly preventing draft leakage and cross-tenant data exposure.

## Plan
1. Design scoped publishable key format `pk_live_{tenantId}_{token}` and `pk_test_{tenantId}_{token}`.
2. Build `PublishableKeyFilter` in `acc-fw` to intercept incoming public requests, validate key format, and set `TenantContextHolder` and `PublishableKeyAuthenticationToken` with `ROLE_PUBLIC_READER` and `METADATA_RECORD_READ`.
3. Build `PublicCmsGatewayController` to expose `/api/v1/public/tenants/{tenantId}/cms/records` and `/records/{recordId}` enforcing `status = 'PUBLISHED'` and soft-delete filtering under tenant RLS.
4. Update `SecurityConfiguration` to register the filter and permit `/api/v1/public/**`.
5. Verify with automated tests in `PublishableKeyFilterTest` and `PublicCmsGatewayControllerTest`.

## Changes
- `apps/backend/acc-fw/src/main/java/com/acc/fw/security/PublishableKeyAuthenticationToken.java`: Public reader authentication token.
- `apps/backend/acc-fw/src/main/java/com/acc/fw/security/PublishableKeyFilter.java`: Filter resolving tenant from publishable keys or path and applying public reader security context.
- `apps/backend/acc-fw/src/main/java/com/acc/presentation/PublicCmsGatewayController.java`: Controller for `/api/v1/public/tenants/{tenantId}/cms/records` enforcing `WHERE status = 'PUBLISHED'`.
- `apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/EntityTypeRepository.java`: Added system name lookup methods.
- `apps/backend/acc-fw/src/main/java/com/acc/boot/config/SecurityConfiguration.java`: Added `publishableKeyFilter()` bean and permitted public route.
- `apps/backend/acc-fw/src/test/java/com/acc/fw/security/PublishableKeyFilterTest.java`: Unit tests for key verification, bearer support, path fallback, and 401 handling.
- `apps/backend/acc-fw/src/test/java/com/acc/presentation/PublicCmsGatewayControllerTest.java`: Unit tests verifying published status filtering and 404 behavior for drafts.

## Verification
- `mvnw.cmd test -pl acc-fw -Dtest="PublishableKeyFilterTest,PublicCmsGatewayControllerTest"`: 8 tests passing.
- `pnpm --filter tekgo-ui build`: Next.js 15 SSG build passed with 71 pages generated.
- `pnpm --filter @acc/client test`: Passed.
- `pnpm --filter @acc/sandbox test`: Passed.

## Tasks
- [x] Create PublishableKeyAuthenticationToken & PublishableKeyFilter
- [x] Update SecurityConfiguration
- [x] Create PublicCmsGatewayController with strict status=PUBLISHED enforcement
- [x] Add system name lookup in EntityTypeRepository
- [x] Add automated test suite in acc-fw
- [x] Verify monorepo builds and tests

## Enhancement
Phase 8 will integrate `tekgo-ui` with `@acc/client` using publishable keys to consume live published articles in Next.js Server Components and SSG/ISR generation.
