# Walkthrough - Backend Public Ingestion Gateway & Publishable Key Protocol (Phase 7)

## Summary of Changes
Implemented a secure public gateway allowing headless readers (such as `tekgo-ui` Next.js SSG/ISR readers) to fetch published CMS content safely under tenant isolation.

### 1. Publishable Key Authentication & Filter
- Added [`PublishableKeyAuthenticationToken.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/fw/security/PublishableKeyAuthenticationToken.java) representing authenticated public reader credentials with `ROLE_PUBLIC_READER` and `METADATA_RECORD_READ`.
- Added [`PublishableKeyFilter.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/fw/security/PublishableKeyFilter.java) to inspect `X-Publishable-Key` or `Authorization: Bearer pk_...` matching `pk_(live|test)_{tenantId}_{token}`. If valid, configures `TenantContextHolder` and MDC logging. If not present on `/api/v1/public/tenants/{tenantId}/...`, extracts tenant from path directly. Rejects malformed keys with HTTP 401.

### 2. Public CMS Gateway Endpoints
- Added [`PublicCmsGatewayController.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/presentation/PublicCmsGatewayController.java):
  - `GET /api/v1/public/tenants/{tenantId}/cms/records?entityType=article`: Lists published records filtered by `status = 'PUBLISHED'` and deleted date is null.
  - `GET /api/v1/public/tenants/{tenantId}/cms/records/{recordId}?entityType=article`: Returns published record; returns 404 if draft or wrong tenant.
- Extended [`EntityTypeRepository.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/repository/jpa/EntityTypeRepository.java) with `findByTenantIdAndSystemNameAndDeletedDateIsNull` and `findBySystemNameAndDeletedDateIsNull`.

### 3. Security Configuration
- Updated [`SecurityConfiguration.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/boot/config/SecurityConfiguration.java) to add `PublishableKeyFilter` before `UsernamePasswordAuthenticationFilter`, permitting `/api/v1/public/**`.

## Verification Results
- `mvnw.cmd test -pl unipost-fw -Dtest="PublishableKeyFilterTest,PublicCmsGatewayControllerTest"`: 8/8 tests passed.
- `pnpm --filter tekgo-ui build`: Next.js 15 SSG build passed with 71 static pages generated.
