# Implementation Plan - Backend Public Ingestion Gateway & Publishable Key Protocol (Phase 7)

## Problem Statement
`tekgo-ui` (Next.js 15) and mobile public views require read-only access to published CMS records (e.g., articles, blog posts) without authenticating as an administrative user or holding JWT tokens. Direct database access or unsecured endpoints risk exposing drafts or leaking cross-tenant records.

## Architecture & Implementation Overview
1. **Publishable Key Protocol**:
   - Keys adhere to standard naming: `pk_live_{tenantId}_{token}` or `pk_test_{tenantId}_{token}`.
   - Keys are supplied either via header `X-Publishable-Key` or `Authorization: Bearer pk_...`.
   - `PublishableKeyFilter` validates prefix format, extracts `tenantId`, sets `TenantContextHolder`, and populates `PublishableKeyAuthenticationToken` with `ROLE_PUBLIC_READER` and `METADATA_RECORD_READ`.
2. **Public Ingestion Gateway (`PublicCmsGatewayController`)**:
   - `GET /api/v1/public/tenants/{tenantId}/cms/records?entityType=article`:
     - Resolves entity type by ID or system name.
     - Strictly enforces `WHERE status = 'PUBLISHED'` and soft-delete checks (`deleted_date IS NULL`).
     - Ignores client attempts to override status to `DRAFT`.
   - `GET /api/v1/public/tenants/{tenantId}/cms/records/{recordId}?entityType=article`:
     - Retrieves record, checks tenant isolation, and ensures publication status equals `PUBLISHED`.
     - Non-published or cross-tenant records return HTTP 404 (`MetadataNotFoundException`).
3. **Security Integration**:
   - Registered `PublishableKeyFilter` before `UsernamePasswordAuthenticationFilter`.
   - Configured `SecurityConfiguration` to permit all `/api/v1/public/**` requests and bypass CSRF checks.

## Verification
- Unit & integration tests in `PublishableKeyFilterTest` and `PublicCmsGatewayControllerTest` (8 tests passing).
- Clean `tekgo-ui` production build verification.
