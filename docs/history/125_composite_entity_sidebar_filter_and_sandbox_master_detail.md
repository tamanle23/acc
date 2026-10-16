# 125: Composite Entity Sidebar Filter & Sandbox Master-Detail View

## Problem
In `@unipost/console`'s `/metadata` screen during local development:
1. The **Console UI Master-Detail Expandable View** was difficult to locate because composite entities (such as `Customer 360 View`) resided on secondary pages in the entity sidebar rail.
2. Clicking on a composite entity kept the user in the `'schema'` builder view, where master-detail expandable rows do not exist.
3. In `mock-metadata.ts`, mock records for child entities lacked foreign keys (`account_id`), and explicit attribute definitions were missing for composite models, causing records to fail rendering in the grid.
4. There was no direct mechanism or toggle in the entities sidebar rail to filter composite entities exclusively.

## Plan
1. **Unified Sandbox Parity**:
   - Update `initialMockEntityTypes` to ensure `customer-360-composite` has complete root and child specifications (Pattern B & Pattern C).
   - Add explicit attribute definitions in `initialMockAttributes` and dynamic fallback synthesis in `getAttributeDefinitions`.
   - Seed foreign keys (`account_id`) on child records and establish relationship graph connections in `initialMockEntityRelationships`.
   - Support `isComposite` filtering in `/entity-types` route handler.
2. **Sidebar Rail Filter**:
   - Add a high-affordance `Switch` ("Composite Entities") with count badge to `EntityTypeSidebar`.
   - Filter entity list when active, display `COMPOSITE` badges on list items, and auto-select the first composite entity.
3. **Master-Detail Auto-Presentation**:
   - In `MetadataFeature`, switch `activeTab` to `'data'` whenever a composite entity is selected.
   - In `EntityDataGrid`, auto-expand the first row when viewing composite entities so the user immediately sees `CompositeMasterDetailRow`.
4. **Verification**:
   - Add unit tests for `EntityTypeSidebar` and verify existing `CompositeMasterDetailRow` test suites.

## Changes
- `apps/console/src/features/metadata/data/mock-metadata.ts`: Enriched composite specs, dynamic attribute generation, foreign key seeds, and relationship records.
- `apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts`: Forwarded `isComposite` query parameter.
- `apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx`: Added `compositeOnly` toggle state, badge, and auto-select behavior.
- `apps/console/src/features/metadata/components/metadata-feature.tsx`: Added auto tab switch to `'data'` for composite models and header badge.
- `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`: Added auto-expansion effect for `records[0]` on composite entity selection.
- `apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.test.tsx`: Created unit test suite for sidebar composite filtering.
- `apps/console/ROUTE.md`: Updated Section 3.8 screen blueprint.
- `apps/console/doc/walkthrough_113.md`: Created reactive fix walkthrough.

## Verification
- Executed Vitest:
  - `apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.test.tsx` (3 passed)
  - `apps/console/src/features/metadata/components/data-explorer/composite-master-detail-row.test.tsx` (4 passed)
- Executed TypeScript check:
  - `pnpm --filter @unipost/console exec tsc --noEmit` exited code 0.

## Tasks
- [x] Enrich composite entity sandbox mock data and relational links
- [x] Add Composite Entity toggle switch to sidebar rail
- [x] Auto-navigate to Data tab and auto-expand first row for composite entities
- [x] Add unit tests and verify against Vitest and TypeScript

## Enhancement
- Future enhancement: Support saving composite filter preference into `localStorage` or URL query params for persistence across page reloads.
