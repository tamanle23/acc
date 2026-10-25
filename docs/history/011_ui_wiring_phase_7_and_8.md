# 011: UI Wiring for Phase 7 (Noisy Neighbor Defense & Quotas) and Phase 8 (GDPR & Data Portability)

## 1. Problem Statement
The backend architecture implemented comprehensive tenant quota caps (50 entity types, 100 attributes per type), ReDoS regex protection, HTTP 429 rate limiting with `Retry-After`, streaming ZIP export (`GET /api/v1/metadata/tenants/{id}/export`), and asynchronous GDPR Article 17 hard-purge (`POST /api/v1/metadata/tenants/{id}/purge`). However, the `@acc/console` frontend lacked:
- Visual quota utilization feedback and pre-emptive creation blocking before backend rejection.
- Client-side static ReDoS pattern detection in schema attribute regex validation.
- Interception of HTTP 429 errors to surface retry-after durations to users.
- A user interface for requesting ZIP data exports and triggering GDPR Article 17 hard-purges with Certificate of Erasure receipts.

## 2. Implementation Plan & Changes
1. **HTTP 429 Interceptor**:
   - Updated `apps/console/src/lib/handle-server-error.ts` to inspect HTTP 429 and `retry-after` header.
   - Updated `apps/console/src/main.tsx` React Query `QueryCache` to gracefully notify rate-limited requests.
2. **Quota Indicators & Client Guardrails**:
   - Updated `apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx`: rendered dynamic `X / 50 Models` badge; disabled "+ New" button when cap is hit.
   - Updated `apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx`: rendered `Y / 100 Fields` badge; disabled "Add Field" when cap is hit.
   - Updated `apps/console/src/features/metadata/components/schema-builder/attribute-dialog.tsx`: added pre-flight ReDoS check; blocked saving dangerous patterns.
3. **GDPR & Data Portability UI**:
   - Created `apps/console/src/features/settings/data-privacy/data-privacy-panel.tsx` with ZIP export trigger and 5-stage purge modal.
   - Created `apps/console/src/routes/_authenticated/settings/data-privacy.tsx` and updated `apps/console/src/features/settings/index.tsx` navigation.
   - Updated `apps/console/ROUTE.md`.

## 3. Verification
- `pnpm --filter @acc/console exec tsc --noEmit` passed with 0 errors.
- `pnpm --filter @acc/console test` passed (41 tests across 6 suites).

## 4. Key Artifacts
- Plan: `apps/console/doc/implementation_plan_61.md`
- Walkthrough: `apps/console/doc/walkthrough_61.md`
