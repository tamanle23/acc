# 151: Column View Toggles & Guaranteed Horizontal Overflow for EntityDataGrid

## Problem
In the Metadata Data Explorer view for wide entities (such as `telemetry_wide_matrix` with 120 columns):
1. There was no column Views toggle menu (as present in standard `DataTable`), preventing users from toggling columns on/off.
2. The grid was not horizontally scrolling because `useAttributeDefinitions` was capped at 50 attributes by default and the table element was missing `min-w-max`, allowing cells to compress to the viewport width.

## Plan
1. Add `columnVisibility` state and `onColumnVisibilityChange` to `useReactTable` in `entity-data-grid.tsx`.
2. Integrate `<DataTableViewOptions table={table} />` into the `EntityDataGrid` action toolbar.
3. Make `DataTableViewOptions` dropdown content scrollable (`max-h-[360px] overflow-y-auto`) so 100+ columns can be navigated comfortably.
4. Pass `{ size: 500 }` to `useAttributeDefinitions` and update `metadataSandboxAdapter` to forward `size` to `mockMetadataStore`.
5. Add `min-w-max` and `table-auto` to the table element to guarantee horizontal scroll container overflow across all resolutions.
6. Verify with unit tests and typecheck.

## Changes
- `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`:
  - Added `columnVisibility` state and integrated with TanStack Table.
  - Inserted `<DataTableViewOptions table={table} />` into the action toolbar.
  - Configured `useAttributeDefinitions(entityTypeId, { size: 500 })`.
  - Added `min-w-max` and `table-auto` to the table element.
- `apps/console/src/components/data-table/view-options.tsx`:
  - Added `max-h-[360px] overflow-y-auto` and `w-[220px]` to `<DropdownMenuContent>`.
  - Removed `hidden lg:flex` so column controls are accessible on all screens.
- `apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts`:
  - Forwarded `size` and `number` query parameters to `mockMetadataStore.getAttributeDefinitions`.
- `apps/console/src/features/metadata/api/http-metadata-service.ts`:
  - Set default attribute page size fallback to 500.

## Verification
- `npx vitest run src/features/metadata/components/data-explorer/__tests__/entity-data-grid.test.tsx`: 4/4 passing.
- `npx vitest run src/features/metadata/__tests__/wide-telemetry-entity.test.ts`: 3/3 passing.
- `npx tsc --noEmit --project tsconfig.json`: 0 errors.

## Walkthrough
Detailed walkthrough documented in `apps/console/doc/walkthrough_126.md`.
