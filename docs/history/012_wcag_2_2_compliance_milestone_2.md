# 012: WCAG 2.2 AA Compliance - Milestone 2 (Navigation, Landmarks & Bypass Blocks)

## Date: 2026-10-09

## Description
Executed **Milestone 2** of the WCAG 2.2 AA compliance initiative across `@acc/console`. This milestone focuses on wiring the skip link bypass block, standardizing ARIA landmark regions, and enforcing strict heading hierarchy.

## Changes Implemented

1. **Bypass Blocks & Skip Link Wiring (SC 2.4.1):**
   - Updated `<Main>` in `apps/console/src/components/layout/main.tsx` with default `id="content"`, `tabIndex={-1}`, and `outline-none`.
   - Connected `<SkipToMain>` (`href="#content"`) so keyboard focus bypasses repeated top/sidebar navigation structures directly into `<main>`.

2. **Standardized ARIA Landmark Regions (SC 1.3.1):**
   - Added explicit `role="banner"` to `<Header>` in `apps/console/src/components/layout/header.tsx`.
   - Added `aria-label="Main Navigation"` to `<Sidebar>` in `apps/console/src/components/layout/app-sidebar.tsx`.
   - Added `aria-label="Entity Models Rail"` to `<aside>` in `apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx`.
   - Added `aria-label="Faceted Search Filters"` to `<aside>` in `apps/console/src/features/metadata/components/data-explorer/faceted-search-sidebar.tsx`.
   - Added `aria-label="Settings Menu"` to `<aside>` in `apps/console/src/features/settings/index.tsx`.

3. **Heading Hierarchy Normalization (SC 1.3.1):**
   - Upgraded page titles in `MetadataFeature`, `Tasks`, and `Users` from `<h2>` to `<h1>`.
   - Standardized secondary section headers in `EntityTypeSidebar`, `SchemaBuilder`, and `RelationshipTypesManager` to `<h2>` and empty states to `<h3>`.

## Verification
- `pnpm --filter @acc/console exec tsc -b`: 0 errors
- `pnpm --filter @acc/console test`: Passed (12/12 test files, 73/73 tests)
- `pnpm --filter @acc/console build:web`: Success

## Next Steps for Milestone 3
- Data Explorer Table Accessibility in `EntityDataGrid`: `scope="col"`, `aria-sort`, descriptive `aria-label`s on icon buttons.
- Accessible Reordering in `SchemaBuilder`: Single-pointer/keyboard reordering alternatives ("Move Up" / "Move Down" buttons) to satisfy SC 2.5.7 (Dragging Movements).
- Accessible Authentication: Ensure password and OTP fields support paste events and standard autocomplete hints (SC 3.3.8).
