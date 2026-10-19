# Walkthrough 130: High-Performance DOM Virtualization for EntityDataGrid via @tanstack/react-virtual

## Problem & Motivation
In enterprise and high-density telemetry scenarios (such as IoT Fleet Telemetry with 120 dynamic attribute columns and 10,000+ records), rendering entire table collections simultaneously causes massive DOM element bloat ($> 120,000$ active nodes), resulting in browser memory pressure, frame drops, and frozen scrolling.

## Changes
- **Dependency**:
  - Added `@tanstack/react-virtual` to `apps/console/package.json`.
- **EntityDataGrid Component Optimization** ([`apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx)):
  - Initialized `rowVirtualizer` with `useVirtualizer`:
    - Linked directly to `scrollContainerRef` (`HTMLDivElement`).
    - Configured dynamic row estimation (`estimateSize: () => 45`) with `overscan: 10`.
    - Bound `ref={rowVirtualizer.measureElement}` and `data-index={virtualRow.index}` on table rows for dynamic measurement.
  - Implemented virtual row rendering and height spacing in `<tbody>`:
    - Top virtual padding spacer row calculated dynamically (`paddingTop = virtualRows[0]?.start ?? 0`).
    - Bottom virtual padding spacer row calculated dynamically (`paddingBottom = totalSize - virtualRows[last]?.end`).
    - Added headless/jsdom fallback rendering to support SSR and testing environments where viewport height is 0.
  - Expanded pagination page size options to support high-density processing: `[10, 25, 50, 100, 250, 500, 1000]`.
- **Automated Verification**:
  - Created [`apps/console/src/features/metadata/components/data-explorer/__tests__/entity-data-grid-virtualization.test.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/data-explorer/__tests__/entity-data-grid-virtualization.test.tsx) testing 120 columns across 500 records and 10,000 total elements with pagination options up to 1,000 rows.
  - Maintained 100% test pass rate across all 68 console test suites (315/315 tests passing).

## Verification
- Vitest suite passed: `pnpm --filter @unipost/console run test` (315/315 tests pass across 68 test files).
- TypeScript check passed: `pnpm --filter @unipost/console exec tsc --noEmit` exited 0 with 0 errors.
