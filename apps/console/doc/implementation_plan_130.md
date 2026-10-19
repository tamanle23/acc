# Implementation Plan 130: High-Performance DOM Virtualization for EntityDataGrid via @tanstack/react-virtual

## 1. Problem Statement & Motivation
In enterprise and IoT operational contexts (such as `telemetry_wide_matrix` or high-throughput asset logs), entity datasets may load hundreds or thousands of rows (e.g., 100, 500, 10,000 items) across up to 120 dynamic attribute columns.
Without DOM virtualization, rendering 1,000+ rows with 120 columns generates $> 120,000$ active DOM elements, resulting in severe frame drops, UI thread freezing, and sluggish scrolling.

By integrating `@tanstack/react-virtual` (`useVirtualizer`), `EntityDataGrid` will only mount DOM elements visible in the active scroll viewport (+ overscan buffer of ~5-10 rows), while maintaining:
1. Exact total scroll container height via virtual padding (`paddingTop`, `paddingBottom`).
2. Symmetrical sticky frosted headers (`sticky top-0 z-10 backdrop-blur-md`).
3. Sticky right-hand actions column (`sticky right-0 z-10 backdrop-blur-xl`).
4. Support for composite expandable rows (`CompositeMasterDetailRow`) via dynamic row measurement.
5. Zero regressions with existing features: column views toggling (`DataTableViewOptions`), multi-sort, faceted search, search filtering, schema backfill alerts, and empty states.

## 2. Technical Design & Architecture
- **Dependency**: `@tanstack/react-virtual` ^3.13.x installed in `apps/console`.
- **Virtualizer Hook**:
  ```ts
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 45, // default estimated row height in px
    overscan: 8,
  });
  ```
- **Virtual Items Slicing**:
  - `virtualRows = rowVirtualizer.getVirtualItems()`
  - `totalSize = rowVirtualizer.getTotalSize()`
  - Calculate:
    - `paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0`
    - `paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0) : 0`
- **Dynamic Measurement**:
  - Attach `ref={rowVirtualizer.measureElement}` or `data-index={virtualRow.index}` to dynamically measure variable-height rows (especially when composite rows are expanded).
- **Graceful Rendering**:
  - When `paddingTop > 0`, render spacer `<tr><td style={{ height: paddingTop }} colSpan={columns.length} /></tr>`.
  - For each `virtualRow` in `virtualRows`, get `row = table.getRowModel().rows[virtualRow.index]`.
  - When `paddingBottom > 0`, render spacer `<tr><td style={{ height: paddingBottom }} colSpan={columns.length} /></tr>`.
- **Zero DOM Lag**:
  - Memory consumption drops from hundreds of megabytes to a constant tiny footprint regardless of row count.
  - Scroll FPS remains locked at 60 FPS.

## 3. Implementation Steps
1. Add `useVirtualizer` import from `@tanstack/react-virtual` in `entity-data-grid.tsx`.
2. Configure `rowVirtualizer` with `scrollContainerRef`, dynamic row measurement, and overscan buffer.
3. Update table `<tbody>` to render top spacer, virtual rows, and bottom spacer.
4. Verify dynamic measuring with composite sub-collection expansion.
5. Create comprehensive unit tests in `entity-data-grid-virtualization.test.tsx` verifying:
   - Only a bounded subset of rows are rendered in DOM when a large dataset is provided.
   - Total scroll size and padding spacers are calculated accurately.
   - Expanding composite row measures and adjusts virtual height properly.
6. Verify existing test suite `apps/console/src/features/metadata/components/data-explorer/__tests__/entity-data-grid.test.tsx` and monorepo check-types.
7. Document history in `docs/history/155_entity_data_grid_dom_virtualization.md` and walkthrough in `apps/console/doc/walkthrough_130.md`.
