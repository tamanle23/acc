# History Log: 140 - Console Client Offline Data Parity (CMS Schema & Records)

## Problem Statement
The backend Unified Sandbox was equipped in Iteration 9 with a high-volume Headless CMS data generator (`CmsDataScaffoldingGenerator`) providing 1,000 Articles with rich Markdown bodies, 50 Categories, 200 Media Assets, and 2,000 relational graph edges under tenant-scoped RLS. However, `@unipost/console` in offline client mode (Mode 1 - Unified Sandbox Autonomous) only contained the baseline Customer 360 catalog dataset. To enable full dual-mode E2E parity without requiring a running live backend server for frontend validation, `@unipost/console` needed identical CMS schemas, attributes, relationship types, and high-volume seed records, wired with the master reset event in `sandboxResetRegistry`.

## Plan
1. Author high-volume CMS mock generator (`mock-cms-data.ts`) producing:
   - 3 Entity Types: `ent_cms_article` (`cms-article`), `ent_cms_category` (`cms-category`), `ent_cms_media_asset` (`cms-media`).
   - Standard CMS attributes covering markdown bodies, slugs, publishing lifecycle, MIME types, file sizes, and alt texts.
   - 2 Relationship Types: `rel_article_to_category`, `rel_article_featured_media`.
   - 1,000 Articles, 50 Categories, 200 Media Assets, and 2,000 relational graph edges.
2. Wire `mock-cms-data.ts` into `apps/console/src/features/metadata/data/mock-metadata.ts`:
   - Merge `cmsEntityTypes` into `initialMockEntityTypes`.
   - Merge `cmsAttributes` into `initialMockAttributes`.
   - Merge `cmsRelationshipTypes` into `initialMockRelationshipTypes`.
   - Merge generated records and graph edges into `initialMockRecords` and `initialMockEntityRelationships`.
   - Register `mockMetadataStore.resetToInitialState()` with `sandboxResetRegistry`.
3. Verify test suites and coverage:
   - Run Vitest suite (`pnpm --filter @unipost/console run test -- --run`) ensuring all 298 tests pass.
   - Run Vitest coverage (`pnpm --filter @unipost/console run test:coverage`) ensuring zero regression on the $\ge 90\%$ statements/branch coverage gate.
4. Record history entry and commit via Conventional Commits.

## Changes Made
- Created `apps/console/src/features/metadata/data/mock-cms-data.ts`:
  - Implemented `cmsEntityTypes`, `cmsAttributes`, and `cmsRelationshipTypes`.
  - Implemented `generateCmsRecordsAndRelationships(tenantId)` with deterministic pseudorandom seed generation mirroring the backend PGlite scaffolding.
- Updated `apps/console/src/features/metadata/data/mock-metadata.ts`:
  - Imported CMS types, attributes, relationships, and generator.
  - Merged datasets into initial in-memory collections and reset routines.
  - Registered `sandboxResetRegistry.register(() => mockMetadataStore.resetToInitialState())`.

## Verification
- Vitest suite ran cleanly: **62 test files passed (298/298 tests green)**.
- Vitest coverage verified with 0 regressions.
- Git status confirms all changes are scoped to console metadata fixtures and sandbox registry wiring.

## Tasks
- [x] Create `apps/console/src/features/metadata/data/mock-cms-data.ts`
- [x] Wire `mock-metadata.ts` with CMS data and `sandboxResetRegistry`
- [x] Execute Vitest test suite and coverage
- [x] Update history log and README index
- [x] Git commit with Conventional Commits
