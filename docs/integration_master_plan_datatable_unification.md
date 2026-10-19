# Integration Master Plan: Unified DataTable Architecture, Overflow UX & Monorepo Migration

## Goal Description
Unify the UI/UX style, layout, and scrolling behavior of all data tables across `@unipost/console` using `/workflow-executions` as the canonical reference layout. Standardize toolbar controls, faceted filters, search, bulk action slots, and pagination while drastically upgrading the shared `DataTable` primitive to handle large datasets with high row/column density cleanly and intuitively.

> [!NOTE]
> Complex hierarchical domain grids with nested entity-attribute models and master-detail relationship builders (specifically `entity-data-grid.tsx` and `composite-master-detail-row.tsx`) maintain their specialized canvas architecture, but benefit from the underlying table styling and accessibility refinements.

---

## User Review Required

> [!IMPORTANT]
> The shared `DataTable` primitive in `@/components/data-table/data-table.tsx` will receive 4 core scrolling and ergonomics upgrades:
> 1. **Sticky Frosted Header**: Table header row floats with `sticky top-0 z-20 backdrop-blur-xl` over rows during vertical scrolling.
> 2. **Horizontal Overflow Indicators**: Dynamic left/right linear gradient shadow masks that activate when columns extend beyond the viewport container, visually cueing users that horizontal content exists.
> 3. **Sticky Row Actions Column (Optional/Class-Driven)**: Pinned right-hand actions column (`sticky end-0 z-10 backdrop-blur-md bg-card/80`) so context actions are always accessible without scrolling back and forth.
> 4. **Custom Styled Scrollbars & Mobile Margin Offsets**: Subtly tinted thin scrollbars (`scrollbar-thin scrollbar-thumb-white/20`) that match Liquid Glass themes and prevent toolbar collision on mobile viewports.

---

## Target Migration Scope

| Screen / Feature | Current Implementation | Migration Action |
| :--- | :--- | :--- |
| **Workflow Executions** (`/workflow-executions`) | TanStack `useReactTable` + `DataTable` + `DataTableToolbar` | **Canonical Reference**. Add sticky header, horizontal scroll indicators, and sticky actions. |
| **Users** (`/users`) | TanStack `useReactTable` + `DataTable` + `DataTableToolbar` | Update to unified toolbar slot actions and horizontal overflow indicators. |
| **Dead-Letter Queue (DLQ)** (`/system/dlq`) | TanStack `useReactTable` + `DataTable` + `DataTableToolbar` | Align toolbar action slots (Replay, Inspect) and sticky header. |
| **System Fleet Tenants** (`/system/tenants`) | Bespoke 455-line raw `<table>` with manual search input & select filters | **Migrate to TanStack React Table + `DataTable` + `DataTableToolbar`**. Wire filters, search, and action slots. |
| **Billing History** (`/settings/billing`) | Bespoke raw `<table>` without sorting or pagination | **Migrate to `DataTable` + `DataTablePagination`**. Add receipt download action column. |
| **Workspaces** (`/settings/workspaces`) | Card list | Maintain card grid, ensure consistency with toolbar standards. |
| **Workflow Catalog** (`/workflows`) | TanStack `useReactTable` + `DataTable` | Align with unified toolbar slots and sticky actions. |

---

## Architecture & Visual Flow

```mermaid
flowchart TD
    subgraph Shared DataTable Suite
        DT[DataTable Component] --> SH[Sticky Frosted Header: sticky top-0 backdrop-blur-xl]
        DT --> OI[Overflow Indicators: Dynamic Left/Right Shadow Gradients]
        DT --> SC[Sticky Actions Column: sticky end-0]
        DT --> CS[Thin Themed Scrollbars]
    end

    subgraph Standardized Toolbar Suite
        TB[DataTableToolbar] --> SB[Search Input: debounced 300ms]
        TB --> FF[Faceted Filter Dropdowns]
        TB --> VO[DataTableViewOptions: Column Toggle]
        TB --> AS[Action Slots: e.g. Create Tenant, Invite User, Batch Replay]
    end

    subgraph Screen Implementations
        WE[/workflow-executions - Reference]
        UT[/users]
        DLQ[/system/dlq]
        FT[/system/tenants - Migrated]
        BH[/settings/billing - Migrated]
    end

    SH & OI & SC --> WE & UT & DLQ & FT & BH
    TB --> WE & UT & DLQ & FT & BH
```

---

## Proposed Changes

### Component 1: Core DataTable Primitive Enhancements (`@/components/data-table`)

#### [MODIFY] [`apps/console/src/components/data-table/data-table.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/components/data-table/data-table.tsx)
- Add scroll state detection (`hasScrollLeft`, `hasScrollRight`) via `useRef` and `onScroll` handler on the container.
- Render dynamic specular edge shadow indicators on the left and right edges of the table viewport:
  - Left indicator: `bg-gradient-to-r from-black/15 to-transparent` (or white in light mode).
  - Right indicator: `bg-gradient-to-l from-black/15 to-transparent`.
- Wrap `TableHeader` in `sticky top-0 z-20 bg-card/85 backdrop-blur-xl shadow-xs`.
- Add prop `stickyActions?: boolean` or support `column.columnDef.meta?.sticky === 'right'` for pinning the actions column.
- Integrate WCAG AA compliant keyboard arrow scrolling accessibility cues.

#### [MODIFY] [`apps/console/src/components/data-table/toolbar.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/components/data-table/toolbar.tsx)
- Add `actions?: React.ReactNode` slot to `DataTableToolbarProps`.
- Align search input, faceted filter popovers, view options toggle, and custom action buttons (e.g. `Create Tenant`, `Invite User`, `Refresh`) with consistent flex spacing (`flex flex-wrap items-center justify-between gap-2`).

#### [MODIFY] [`apps/console/src/components/ui/table.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/components/ui/table.tsx)
- Ensure base table classes support seamless sticky positioning without clipping artifacts (`relative overflow-x-auto scrollbar-thin`).

---

### Component 2: Screen Migrations to Unified DataTable

#### [MODIFY] [`apps/console/src/features/system/tenants/fleet-tenants-table.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/system/tenants/fleet-tenants-table.tsx)
- Extract column definitions into a dedicated `fleet-tenants-columns.tsx`.
- Refactor the component to use `useReactTable` with `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, and `getPaginationRowModel`.
- Replace bespoke raw table markup with `<DataTableToolbar>`, `<DataTable>`, and `<DataTablePagination>`.
- Pass primary actions (`Create Tenant`, `Refresh`) directly into the standardized toolbar `actions` slot.

#### [MODIFY] [`apps/console/src/features/settings/billing/billing-history-table.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/settings/billing/billing-history-table.tsx)
- Implement `billing-history-columns.tsx` using `@tanstack/react-table`.
- Wrap transactions with `useReactTable` and render via `<DataTable table={table} />` and `<DataTablePagination table={table} />`.
- Clean up table padding and align with Liquid Glass surface tokens.

#### [MODIFY] [`apps/console/src/features/workflow-executions/components/workflow-executions-table.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/workflow-executions/components/workflow-executions-table.tsx)
- Verify sticky header and horizontal overflow indicator behavior on large execution catalogs.
- Pin the right-side actions column (`data-table-row-actions`) with `sticky end-0 z-10`.

#### [MODIFY] [`apps/console/src/features/dlq/components/dlq-table.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/dlq/components/dlq-table.tsx) & [`apps/console/src/features/users/components/users-table.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/users/components/users-table.tsx)
- Align with the upgraded `DataTable` overflow indicators and sticky headers.

---

## Verification Plan

### Automated Tests
1. **Console Unit & Component Tests**:
   - `pnpm --filter @unipost/console test` (must verify all 298+ unit/component tests pass, including `fleet-tenants-table`, `billing-history-table`, `dlq-table`, and `users-table`).
2. **Playwright Mode 1 E2E**:
   - `pnpm test:e2e` (all 15/15 tests passing, including Golden Flow 2 multi-tenant explorer and Golden Flow 3 billing invariants).
3. **Playwright Mode 2 Live E2E**:
   - `pnpm test:e2e:live` (all 15/15 tests passing against live Spring Boot backend).

### Manual Verification
1. **Overflow Indicators**:
   - Open `/workflow-executions` and resize viewport down to mobile/tablet width or expand columns.
   - Verify dynamic shadow gradients appear on the left/right edges when horizontal scrolling is available.
   - Scroll horizontally and observe shadows fade in/out dynamically as scroll bounds are reached.
2. **Sticky Header & Actions**:
   - Scroll vertically down 50+ records and confirm the header row stays pinned at the top with frosted glass blur.
   - Confirm right-side action menu (`MoreVertical` or button trigger) stays pinned at the edge of the visible table.
3. **Screen Consistency**:
   - Navigate between `/workflow-executions`, `/system/tenants`, `/users`, `/system/dlq`, and `/settings/billing`.
   - Verify visual parity in typography, padding, search placement, faceted filter badges, and pagination controls.
