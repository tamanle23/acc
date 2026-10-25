# Walkthrough 87: Unified Dynamic Layout Switching Engine for Domain Blueprint Catalog

## 1. Problem
In `@acc/console`, the **Domain Blueprint Catalog** modal was locked to a rigid two-column card grid (`grid-cols-1 md:grid-cols-2`). While aesthetically suited for consumer landing pages, for operational management:
- Cards consumed excessive vertical space, causing scrolling fatigue.
- Comparative auditing across models, edges, and categories was difficult.
- Inspecting a blueprint required opening a separate preview modal, creating stacked modal context fatigue.

## 2. Changes Made
We executed **Milestones 1–4** of [Implementation Plan 87](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/implementation_plan_87.md):

1. **Reusable Segmented Layout Switcher (`LayoutModeSwitcher`)**:
   - Created `apps/console/src/components/layout-switcher/layout-mode-switcher.tsx`.
   - Adheres to Liquid Glass styling (`backdrop-blur-md bg-white/40 border-white/25`).
   - Implements WCAG 2.2 AA accessibility (`role="radiogroup"`, roving `tabindex`, `ArrowLeft`/`ArrowRight` key traversal).
   - Supports 3 layouts: **Grid View** (`grid`), **Table View** (`table`), and **Split Inspector** (`split`).

2. **Dense Tabular Layout (`BlueprintTableView`)**:
   - Created `apps/console/src/features/metadata/components/blueprint-gallery/blueprint-table-view.tsx`.
   - Displays all blueprints in single-line rows with sortable columns (`Template & Name`, `Domain Category`, `Description`, `Models`, `Edges`, `Actions`).
   - Specular row hover highlights and quick inline action buttons (`Preview`, `Use Blueprint`).

3. **Master-Detail Split Layout (`BlueprintSplitView`)**:
   - Created `apps/console/src/features/metadata/components/blueprint-gallery/blueprint-split-view.tsx`.
   - **Left Master Rail (35%)**: Scrollable list of blueprints with active selection indicators.
   - **Right Detail Canvas (65%)**: Real-time embedded `BlueprintGraphCanvas` SVG topological relationship graph and included entity model badges with sub-100ms instant inspection—eliminating modal stacking.

4. **Integration & Persistence (`BlueprintGalleryDialog`)**:
   - Modified `blueprint-gallery-dialog.tsx` to include `LayoutModeSwitcher` in the toolbar.
   - Preserves user choice in `localStorage` under `console:layout:blueprint-catalog`.
   - Dynamically renders `grid`, `table`, or `split` view based on the active selection.

## 3. Verification
- TypeScript compilation check passed: `tsc --noEmit --project tsconfig.json` (0 errors).
- Vitest metadata test suite passed: `pnpm --filter @acc/console test src/features/metadata` (9 test files passed, 56 passed).
- Confirmed smooth switching between Grid, Table, and Split Inspector.
