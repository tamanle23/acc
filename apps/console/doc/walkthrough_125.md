# Walkthrough 125: High-Density Table Ergonomics & 120-Column Sandbox Telemetry Matrix

## 1. Overview
To facilitate direct UI/UX verification and testing of high-density wide table layouts (100+ columns) in `@acc/console`, this work introduces:
- **120-Column Sandbox Entity Model (`telemetry-wide-matrix`)**: Created an IoT edge sensory telemetry matrix featuring 120 strongly-typed attribute definitions (10 device identifiers, 25 thermal sensor cores, 25 electrical power rails, 25 radio frequency channels, 25 vibration frequency nodes, and 10 diagnostic status codes) and 60 realistic seeded records.
- **Dynamic Horizontal Overflow Cues & Keyboard Region in `EntityDataGrid`**: Upgraded `EntityDataGrid` to match `@/components/data-table`'s horizontal scroll region ergonomics (`role="region"`, `aria-label`, `tabIndex={0}`, thin scrollbar, and dynamic left/right gradient shadow cues driven by `ResizeObserver`).
- **Sandbox Catalog Integration**: Registered the 120-column model in `mock-metadata.ts` with updated page size defaults (up to 500 attributes per entity type) and integrated with `sandboxResetRegistry`.
- **Automated Verification**: Added unit test suite `wide-telemetry-entity.test.ts` to validate schema generation, attribute types, record attribute hydration, and mock store retrieval.

---

## 2. Key Changes Made

### Mock Telemetry Entity & Sandbox
- `apps/console/src/features/metadata/data/mock-wide-telemetry.ts`:
  - Defined `telemetryWideEntityType` (`IoT Fleet Telemetry (120 Columns)`).
  - Implemented `generateWideAttributes()` to generate 120 strongly typed attribute definitions (`STRING`, `DECIMAL`).
  - Implemented `generateWideRecords(60)` to generate realistic formatted readings across all 120 metrics.
- `apps/console/src/features/metadata/data/mock-metadata.ts`:
  - Imported and wired `telemetryWideEntityType`, `generateWideAttributes()`, and `generateWideRecords(60)` into `initialMockEntityTypes`, `initialMockAttributes`, and `initialMockRecords`.
  - Updated `getAttributeDefinitions` default pagination limit from 50 to 500 attributes to support querying wide catalog models.
- `apps/console/src/features/metadata/__tests__/wide-telemetry-entity.test.ts`:
  - Created 3 test cases asserting 120 attributes, record hydration across all sensor domains, and resolution via `mockMetadataStore`.

### Data Grid UI & Accessibility
- `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`:
  - Added `scrollContainerRef`, `canScrollLeft`, `canScrollRight`, and `checkScroll` callback.
  - Attached `scroll` event listener and `ResizeObserver` on the scrollable container.
  - Added dynamic left (`pointer-events-none absolute inset-y-0 start-0 z-30`) and right (`pointer-events-none absolute inset-y-0 end-0 z-30`) gradient shadow cues.
  - Marked scroll container with `role="region"`, `aria-label="Metadata entity data grid scrollable region"`, and `tabIndex={0}` for keyboard ergonomics.

---

## 3. Verification Record

1. **Vitest Unit & Component Suite**:
   - `npx vitest run src/features/metadata/__tests__/wide-telemetry-entity.test.ts`: 3/3 tests passing.
   - `npx vitest run src/features/metadata/components/data-explorer/__tests__/entity-data-grid.test.tsx`: 4/4 tests passing.
   - `pnpm --filter @acc/console test`: 66 test files passed, 312/312 tests passing.
2. **TypeScript Integrity**:
   - `npx tsc --noEmit --project tsconfig.json`: 0 errors.
