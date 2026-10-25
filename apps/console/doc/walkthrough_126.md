# Walkthrough 126: Column View Toggles & Guaranteed Horizontal Overflow for EntityDataGrid

## 1. Overview
This update addresses the two requirements for high-density wide tables (such as `telemetry_wide_matrix` with 120 columns) in [`EntityDataGrid`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx):
1. **Column Views Toggle (`DataTableViewOptions`)**: Integrated the column visibility toggle menu into `EntityDataGrid`'s action toolbar with full TanStack `columnVisibility` state bindings so users can toggle any of the 120 columns on and off dynamically.
2. **Guaranteed Horizontal Scrolling & Full 120-Column Hydration**:
   - Resolved the query truncation where `useAttributeDefinitions(entityTypeId)` defaulted to only 50 columns. It now queries with `{ size: 500 }`.
   - Updated `metadataSandboxAdapter` to parse and forward `size` and `number` query parameters to `mockMetadataStore.getAttributeDefinitions`.
   - Updated `table` layout styling with `w-full min-w-max text-left border-collapse text-xs table-auto`, guaranteeing that a table with 120 columns expands beyond the viewport and triggers horizontal scrolling on any screen resolution.
   - Upgraded [`DataTableViewOptions`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/data-table/view-options.tsx) dropdown menu to be scrollable (`max-h-[360px] overflow-y-auto`) to comfortably browse through 100+ columns.

---

## 2. Key Changes Made

### UI & Table Layout
- `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`:
  - Added `columnVisibility` state: `const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})`.
  - Bound `state: { columnVisibility }` and `onColumnVisibilityChange: setColumnVisibility` in `useReactTable`.
  - Added `<DataTableViewOptions table={table} />` to the top toolbar alongside "Export JSON" and "New Record".
  - Configured `useAttributeDefinitions(entityTypeId, { size: 500 })` so all 120 columns are queried.
  - Added `min-w-max` and `table-auto` to the `<table>` element so wide columns do not shrink to fit the screen.
- `apps/console/src/components/data-table/view-options.tsx`:
  - Added `max-h-[360px] overflow-y-auto` and `w-[220px]` to `<DropdownMenuContent>` to smoothly handle 100+ column toggles.
  - Displayed button across all breakpoints (removed `hidden lg:flex`).

### Unified Sandbox Platform
- `apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts`:
  - Forwarded `size`, `number`, and `sort` query parameters from incoming HTTP requests to `mockMetadataStore.getAttributeDefinitions(typeId, { number: page, size, sort })`.
- `apps/console/src/features/metadata/api/http-metadata-service.ts`:
  - Set default attribute page size fallback to 500.

---

## 3. Verification Record

1. **Vitest Unit & Component Suite**:
   - `npx vitest run src/features/metadata/components/data-explorer/__tests__/entity-data-grid.test.tsx`: 4/4 passed.
   - `npx vitest run src/features/metadata/__tests__/wide-telemetry-entity.test.ts`: 3/3 passed.
2. **TypeScript Integrity**:
   - `npx tsc --noEmit --project tsconfig.json`: 0 errors.
