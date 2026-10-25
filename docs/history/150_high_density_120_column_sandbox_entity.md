# 150: High-Density Table Ergonomics & 120-Column Sandbox Telemetry Matrix

## Problem
In Workstream 3, standard tables were migrated to the unified `DataTable` layout with sticky headers and scroll indicators. To evaluate and verify wide-table performance, horizontal scroll indicators, keyboard navigation, and column layout on screens with massive column counts (100+ columns), the Unified Sandbox required a realistic, high-density entity model that exercises wide table rendering in the UI.

## Plan
1. Create `mock-wide-telemetry.ts` defining `IoT Fleet Telemetry (120 Columns)` with 120 strongly typed attribute definitions and 60 realistic records.
2. Wire the new model and records into `mock-metadata.ts` and ensure default attribute pagination allows fetching all 120 attributes.
3. Bring `EntityDataGrid` into alignment with `@/components/data-table`'s horizontal scroll cues (`role="region"`, `tabIndex={0}`, dynamic left/right gradient shadow cues, and `ResizeObserver`).
4. Validate with automated tests (`wide-telemetry-entity.test.ts`), full Vitest suite (312 tests), and TypeScript typechecks.

## Changes
- `apps/console/src/features/metadata/data/mock-wide-telemetry.ts`:
  - Defined `telemetryWideEntityType` (`telemetry_wide_matrix`).
  - Added `generateWideAttributes()` creating 120 attributes (identifiers, thermal cores, electrical rails, RF signals, vibration frequencies, diagnostic codes).
  - Added `generateWideRecords(60)` populating mock values across all 120 columns.
- `apps/console/src/features/metadata/data/mock-metadata.ts`:
  - Registered `telemetryWideEntityType`, `generateWideAttributes()`, and `generateWideRecords(60)`.
  - Increased `getAttributeDefinitions` default pagination limit to 500.
- `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`:
  - Added horizontal scroll cue observer and dynamic left/right gradient shadows with WCAG `role="region"` and `tabIndex={0}`.
- `apps/console/src/features/metadata/__tests__/wide-telemetry-entity.test.ts`:
  - Added unit test asserting 120 attributes, record hydration, and mock store retrieval.

## Verification
- `npx vitest run src/features/metadata/__tests__/wide-telemetry-entity.test.ts`: 3/3 tests passing.
- `pnpm --filter @acc/console test`: 66 test files passed, 312/312 tests passing.
- `npx tsc --noEmit --project tsconfig.json`: 0 errors.

## Walkthrough
Detailed walkthrough documented in `apps/console/doc/walkthrough_125.md`.
