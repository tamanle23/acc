# 155. High-Performance DOM Virtualization for EntityDataGrid via @tanstack/react-virtual

**Date:** 2026-10-19  
**Status:** Completed  
**Author:** Principal Full-Stack Engineer  

---

## 1. Problem & Context
When operating on massive datasets (such as IoT telemetry matrices or enterprise asset records with 120 dynamic attribute columns and up to 10,000+ records), unvirtualized DOM tables mount thousands of table rows and tens of thousands of table cells at once. This leads to high memory overhead, frame drops, and severe scrolling latency.

## 2. Plan & Objectives
1. Integrate `@tanstack/react-virtual` into `@acc/console`.
2. Connect `useVirtualizer` with `EntityDataGrid`'s existing `scrollContainerRef`.
3. Support dynamic row height measurement with `rowVirtualizer.measureElement` (enabling seamless compatibility with expandable composite master-detail rows).
4. Implement dynamic virtual padding spacers (`paddingTop`, `paddingBottom`) in `<tbody>`.
5. Support expanded page size options up to 1,000 rows per page.
6. Provide graceful fallback for headless jsdom/SSR environments.
7. Verify with automated tests and typechecks with zero regressions.

## 3. Key Changes
- **Dependency**: Added `@tanstack/react-virtual` to `apps/console/package.json`.
- **Component**: Refactored `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`:
  - Bound `rowVirtualizer = useVirtualizer(...)` to `scrollContainerRef`.
  - Configured `estimateSize: () => 45`, `overscan: 10`, and attached `ref={rowVirtualizer.measureElement}`.
  - Sliced and rendered only items within the active viewport window + overscan buffer.
  - Extended page size selector with `250`, `500`, and `1000` rows per page.
- **Testing**: Added `apps/console/src/features/metadata/components/data-explorer/__tests__/entity-data-grid-virtualization.test.tsx` simulating 120 columns across 500 rows and 10,000 total records.

## 4. Verification & Results
- **Vitest**: `pnpm --filter @acc/console run test` passed with 68/68 test files (315/315 tests passing).
- **TypeScript**: `pnpm --filter @acc/console exec tsc --noEmit` passed with 0 errors.

## 5. Walkthrough & Documentation
- Implementation Plan: `apps/console/doc/implementation_plan_130.md`
- Walkthrough Artifact: `apps/console/doc/walkthrough_130.md`
