# 084: Unified Dynamic Layout Switching Engine for Domain Blueprint Catalog

## Problem
The Domain Blueprint Catalog modal was hardcoded to a 2-column card grid. For enterprise operational managers and engineers, cards created vertical scrolling fatigue, prevented high-density comparative scanning, and forced opening a separate preview modal to inspect models.

## Plan
Implement Milestones 1–4 from `apps/console/doc/implementation_plan_87.md`:
1. Build reusable `LayoutModeSwitcher` component with Liquid Glass styling and WCAG 2.2 AA ARIA semantics.
2. Build `BlueprintTableView` for dense single-line rows with sortable headers.
3. Build `BlueprintSplitView` for master-detail split inspection with embedded live topological SVG graph canvas.
4. Integrate into `BlueprintGalleryDialog` with `localStorage` layout persistence.

## Changes
- Created [`apps/console/src/components/layout-switcher/layout-mode-switcher.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout-switcher/layout-mode-switcher.tsx).
- Created [`apps/console/src/components/layout-switcher/index.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout-switcher/index.ts).
- Created [`apps/console/src/features/metadata/components/blueprint-gallery/blueprint-table-view.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-table-view.tsx).
- Created [`apps/console/src/features/metadata/components/blueprint-gallery/blueprint-split-view.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-split-view.tsx).
- Updated [`apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery-dialog.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery-dialog.tsx).
- Updated [`apps/console/src/features/metadata/components/blueprint-gallery/index.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/blueprint-gallery/index.ts).
- Updated [`apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery.test.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/blueprint-gallery/blueprint-gallery.test.tsx).
- Created [`apps/console/doc/walkthrough_87.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/walkthrough_87.md).

## Verification
- `tsc --noEmit --project tsconfig.json`: 0 errors.
- `pnpm --filter @acc/console test src/features/metadata`: 9 test files passed, 56 tests passed.
