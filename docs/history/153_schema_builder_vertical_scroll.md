# 153: SchemaBuilder Vertical Scrolling & Sticky Header Ergonomics

## Problem Statement
In `@unipost/console`'s Schema Architect Studio (`/metadata`), models with high attribute density (such as the 120-attribute `telemetry_wide_matrix` or enterprise ERP tables) caused display issues:
1. The columns list did not scroll in an independent, bounded vertical region.
2. The Schema Header & Action Bar ("Add Field", search filter, "Draft-07 JSON", and Visual Studio toggles) scrolled out of view when scrolling down through fields.
3. The scroll thumb was invisible until hovered directly over the narrow scroll track.

## Plan
1. Refactor `apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx` into a flex-column layout with `shrink-0` header and independent `flex-1 min-h-0 overflow-y-auto scrollbar-thin` scroll container for the attributes list.
2. Add `.group/grid` hover illumination to make the scroll thumb glow when hovering anywhere in the Schema Builder.
3. Enhance accessibility with `tabIndex={0}`, `role="region"`, and `aria-label="Schema attributes list"`.
4. Verify using Vitest suite and TypeScript check.

## Changes
- Modified `apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx`:
  - Added `group/grid flex flex-col gap-4 w-full min-w-0 flex-1 min-h-0` on root element.
  - Added `shrink-0` to Schema Header & Action Bar.
  - Wrapped attributes list in `tabIndex={0} role="region" aria-label="Schema attributes list" className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1.5 space-y-3 focus:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded-xl"`.
  - Wrapped `VisualSchemaStudio` in `flex-1 min-h-0 w-full`.
- Created `apps/console/doc/walkthrough_128.md`.

## Verification
- `pnpm --filter @unipost/console exec vitest run src/features/metadata/components/schema-builder/__tests__/`: 6/6 tests passing.
- `pnpm --filter @unipost/console exec vitest run src/features/metadata/`: 135/135 tests passing.
- `pnpm --filter @unipost/console exec tsc --noEmit`: 0 errors.
