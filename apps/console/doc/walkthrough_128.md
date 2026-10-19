# Walkthrough 128: SchemaBuilder Dedicated Vertical Scrolling & Sticky Header Ergonomics

## Problem & Motivation
In `@unipost/console`'s Schema Architect Studio (`/metadata`), when viewing entity types with dozens or hundreds of attribute definitions (such as `telemetry_wide_matrix` with 120 attributes), the columns list did not scroll independently. Instead:
1. The entire container scroll shifted the top Schema Header, Search bar, and "Add Field" action button out of view.
2. The attributes list had no dedicated scroll container, bounded viewport, or WCAG keyboard region semantics.
3. The custom Liquid Glass scrollbar thumb remained muted unless hovered directly over its 8px track.

## Solution & Architecture
1. **Dedicated Viewport Layout**:
   - Refactored `SchemaBuilder`'s root element to a strict flex-column layout:
     ```tsx
     <div className="group/grid flex flex-col gap-4 w-full min-w-0 flex-1 min-h-0">
     ```
   - Pinned the **Schema Header & Action Bar** with `shrink-0` so it permanently stays docked at the top.
2. **Dedicated Attributes List Scroll Container**:
   - Wrapped the attributes list in an independent scroll container:
     ```tsx
     <div
       tabIndex={0}
       role="region"
       aria-label="Schema attributes list"
       className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1.5 space-y-3 focus:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded-xl"
     >
     ```
   - Equipped with `.scrollbar-thin` and responsive padding `pr-1.5` so scrollbars never overlay attribute cards.
3. **WCAG 2.2 AA & Parent Hover Ergonomics**:
   - Integrated `.group/grid` on the root container so that hovering anywhere across the SchemaBuilder area instantly illuminates the scrollbar thumb.
   - Added accessible keyboard focus (`tabIndex={0}`, `role="region"`, `aria-label="Schema attributes list"`) allowing keyboard users to scroll with PageUp/PageDown and arrow keys.
4. **Studio Mode Viewport Preservation**:
   - Provided `flex-1 min-h-0 w-full` wrapper around `VisualSchemaStudio` so DAG Canvas retains full interactive height.

## Verification
- Unit test suite passed: `vitest run src/features/metadata/components/schema-builder/__tests__/schema-builder.test.tsx` (6/6 tests passing).
- Full metadata test suite passed: `vitest run src/features/metadata/` (135/135 tests passing across 25 test files).
- TypeScript compile validation passed: `tsc --noEmit` exited 0 with no errors.
