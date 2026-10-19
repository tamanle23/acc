# 138. High-Volume CMS Data Scaffolding & Monorepo Root Sandbox Scripts

## Problem
1. **Developer Experience & Tooling**: Running the full-stack unified sandbox required navigating between app directories or memorizing long command flags rather than invoking simple root-level scripts (`pnpm dev:sandbox`, `pnpm test:e2e:live`).
2. **High-Volume Data Testing**: Developers and performance benchmark suites required a realistic, high-volume metadata-driven CMS dataset with thousands of articles, categories, media assets, and relational graph links to test heavy pagination, complex JSONB query pushdown, and dynamic filters under PostgreSQL Row-Level Security (RLS).
3. **WCAG AA Guard**: Playwright journey 01 revealed a missing accessible name on the Sovereign Tenants fleet table row action button (`<Button variant="ghost" size="icon">`).

## Plan
1. **Root Script Shortcuts**: Update root `package.json` with `dev:sandbox`, `dev:backend:sandbox`, `dev:console:sandbox`, `test:backend:sandbox`, `test:e2e`, and `test:e2e:live`.
2. **Backend CMS Scaffolding Generator**:
   - Add `SeedProperties` in `SandboxProperties.java` (`articlesCount=1000`, `categoriesCount=50`, `mediaAssetsCount=200`, `tenantId=tenant-acme`).
   - Implement `CmsDataScaffoldingGenerator` with high-performance chunked JDBC batch insertion (`INSERT INTO UNIPOST_ENTITIES ...`) and relational graph edge linking (`INSERT INTO UNIPOST_ENTITY_RELATIONSHIPS ...`).
   - Integrate `bp_cms_publishing_v1` alongside `bp_crm_billing_v1` in `SandboxDataPreWarmer`.
3. **Accessibility Fix**: Add accessible label `aria-label={`Actions for tenant ${tenant.name}`}` in `fleet-tenants-table.tsx`.
4. **Verification**: Run unit/integration tests for sandbox (`test:sandbox`), Modularity tests (`test:modulith`), and full Playwright E2E suite (`test:e2e`).

## Changes
- **`package.json`**: Added root shortcuts for sandbox dev and E2E testing.
- **`apps/backend/unipost-sandbox/.../SandboxProperties.java`**: Added nested `SeedProperties`.
- **`apps/backend/unipost-sandbox/.../CmsDataScaffoldingGenerator.java`**: Created high-performance JDBC batch insert generator for 1,000+ Articles, 50 Categories, 200 Media Assets, and graph relationships.
- **`apps/backend/unipost-sandbox/.../SandboxDataPreWarmer.java`**: Added dual-blueprint provisioning (`bp_crm_billing_v1` + `bp_cms_publishing_v1`) and CMS record scaffolding trigger.
- **`apps/backend/unipost-sandbox/.../CmsDataScaffoldingGeneratorTest.java`**: Unit test asserting batch inserts and RLS session setting.
- **`apps/backend/unipost-sandbox/.../SandboxDataPreWarmerTest.java`**: Updated mock expectations for dual blueprints and CMS generator.
- **`apps/console/.../fleet-tenants-table.tsx`**: Added `aria-label` to table row action button.

## Verification
- `pnpm --filter @unipost/backend test:sandbox`: 33/33 tests passing (0 failures, 0 errors).
- `pnpm --filter @unipost/backend test:modulith`: All 9 reactor modules built successfully, ModularityTests passed.
- `pnpm --filter @unipost/console test:e2e`: All 15 Golden E2E browser journeys passing (100% WCAG 2.2 AA compliant).

## Tasks
- [x] Configure root package.json sandbox scripts
- [x] Implement high-performance CMS data scaffolding generator
- [x] Wire dual-blueprint provisioning in SandboxDataPreWarmer
- [x] Fix accessibility violation in fleet-tenants-table.tsx
- [x] Verify backend sandbox and modularity tests
- [x] Verify Playwright E2E test suite
- [x] Create history log and commit
