# 001: Mobile Viewport Overflow Scroll & Bento Box Responsive Preservation

## Problem
In `@acc/console`, when screens use the fixed layout mode (introduced for multi-pane Bento Box layouts like Metadata Management), small screens (mobile viewports) were completely frozen from vertical scrolling. Because `SidebarInset` clamped the container to `h-svh` and `Main` applied `overflow-hidden` unconditionally, vertically stacked elements on small screens exceeded the viewport and became permanently clipped.

## Plan
Implement Approach C across two phases:
1. Phase 1: Make layout primitives (`AuthenticatedLayout` and `Main`) responsive to desktop viewports (`lg:`), unlocking vertical scrolling on mobile while preserving `h-svh` and `overflow-hidden` on desktop.
2. Phase 2: Adapt Metadata Feature and Bento components (`MetadataFeature`, `EntityTypeSidebar`, `EntityDataGrid`, `Settings`) to adjust container flex constraints on mobile and add mobile collapse ergonomics to `EntityTypeSidebar`.

## Changes
- `apps/console/src/components/layout/authenticated-layout.tsx`: Scoped `has-data-[layout=fixed]:h-svh` to `lg:has-data-[layout=fixed]:h-svh`.
- `apps/console/src/components/layout/main.tsx`: Updated `fixed` layout to `max-lg:min-h-0 max-lg:overflow-y-auto lg:overflow-hidden`.
- `apps/console/src/features/metadata/components/metadata-feature.tsx`: Scoped `overflow-hidden` on `Main` to `lg:overflow-hidden` and relaxed outer flex `min-h-0` on mobile.
- `apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx`: Added `isMobileExpanded` state with a mobile toggle button in the header; auto-collapses on model selection on small screens.
- `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`: Added `max-lg:min-h-[420px] lg:min-h-0` to the table card container.
- `apps/console/src/features/settings/index.tsx`: Relaxed `overflow-hidden` and `overflow-y-hidden` on settings cards to `max-lg:overflow-visible lg:overflow-hidden`.
- Artifacts created: `apps/console/doc/implementation_plan_58.md` and `apps/console/doc/walkthrough_58.md`.

## Verification
- TypeScript compilation: `pnpm --filter @acc/console exec tsc -b` passed with 0 errors.
- Vitest unit tests: 34 passed across 4 test suites.
- Production build: `pnpm --filter @acc/console build:web` succeeded in 679ms.
- ESLint: Verified all modified files with 0 errors.

## Walkthrough
See `apps/console/doc/walkthrough_58.md` for complete details.

## Tasks
- [x] Phase 1: Core Layout Primitives Responsive Fixing
- [x] Phase 2: Metadata Feature Bento Adaptation & Settings Mobile Scrolling
- [x] Verification & Documentation

## Enhancement
Future enhancements could consider a swipeable tab bar or bottom sheet navigation for entity model switching on extra-small mobile devices.
