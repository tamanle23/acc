# Walkthrough 58 - Mobile Viewport Overflow Scroll & Bento Box Responsive Preservation

## Overview

Successfully resolved the mobile viewport vertical scrolling freeze in `@acc/console` by executing **Approach C** across two distinct phases. This ensures that the desktop Bento Box layout remains fully pinned and functional with independent internal scroll containers on `lg:` screens, while unlocking fluid, ergonomic scrolling on mobile devices.

---

## Changes Implemented

### Phase 1: Core Layout Primitives

1. **[`AuthenticatedLayout`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/authenticated-layout.tsx)**:
   - Scoped `has-data-[layout=fixed]:h-svh` and `peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]` to `lg:has-data-[layout=fixed]:...`.
   - On screens `< lg`, `SidebarInset` now grows naturally (`min-h-svh`) without clamping the entire viewport to 100svh.

2. **[`Main`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/main.tsx)**:
   - Updated `fixed` layout styles from `overflow-hidden` to `flex grow flex-col max-lg:min-h-0 max-lg:overflow-y-auto lg:overflow-hidden`.
   - On mobile, `<main>` permits smooth vertical scrolling, whereas on desktop it continues to pin the outer container for multi-pane Bento workspaces.

---

### Phase 2: Metadata Feature & Bento Components Adaptation

1. **[`MetadataFeature`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/metadata-feature.tsx)**:
   - Scoped `overflow-hidden` on `Main` to `lg:overflow-hidden`.
   - Updated outer flex containers from `min-h-0` to `max-lg:min-h-fit lg:min-h-0` so child cards do not collapse their content when stacked vertically.

2. **[`EntityTypeSidebar`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx)**:
   - Added `isMobileExpanded` state (defaulting to collapsed when a model is already active).
   - Added a mobile collapse/expand chevron toggle in the header (`lg:hidden`).
   - Wrapped the filter input, list, and pagination inside `max-lg:hidden` when collapsed on mobile.
   - When a user selects a model on mobile, it automatically collapses the rail to present the active workspace immediately.
   - On desktop (`lg:`), the sidebar remains permanently expanded as an authoritative left rail.

3. **[`EntityDataGrid`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx)**:
   - Added `max-lg:min-h-[420px] lg:min-h-0` to the table card container to preserve a resilient height for horizontal and vertical row scrolling on mobile devices.

4. **[`Settings`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/settings/index.tsx)**:
   - Relaxed `overflow-hidden` and `overflow-y-hidden` on the settings layout cards to `max-lg:overflow-visible lg:overflow-hidden` and `max-lg:overflow-visible lg:overflow-y-hidden`.

---

## Verification Results

### Automated Verification
* **TypeScript Compilation**: `pnpm --filter @acc/console exec tsc -b` passed with 0 errors.
* **Vitest Unit & Integration Tests**: `pnpm --filter @acc/console test` passed all 34 tests across 4 test suites.
* **ESLint Validation**: Verified all modified files with `eslint` without errors.
* **Production Build**: `pnpm --filter @acc/console build:web` built successfully in 679ms.

### Visual & Viewport Behavior
* **Desktop Viewport (`≥ 1024px`)**:
  - `SidebarInset` clamps to 100svh.
  - Multi-pane Bento workspace functions with frozen headers and independent internal pane scrolling.
  - Left entity models rail is always visible and interactive.
* **Mobile Viewport (`< 1024px`)**:
  - Page scrolls smoothly vertically through header, banner, and workspace.
  - Entity models rail can be collapsed/expanded via the mobile header toggle.
  - Tables scroll horizontally without distorting the layout.
