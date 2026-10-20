# 164. Visual JSON Editor Dashed Alignment Lines & Hierarchical Level Alignment

**Date:** 2026-10-20  
**Status:** Completed  
**Scope:** `@unipost/console`  

## Problem
In `VisualJsonEditor`, while nested structures could be navigated and edited in both Tree and Form modes:
1. Deep nested levels lacked visual dashed guide lines (vertical trees and horizontal connector ticks) connecting parent container nodes to child properties, making deep object and array hierarchies harder to scan visually.
2. Form view rows lacked fixed column metrics, causing property inputs and type selectors to jag horizontally based on key name lengths at varying indentation levels.

## Plan
1. **TreeView (`JsonTreeNode`)**:
   - Add vertical dashed alignment border on children wrapper: `ml-4 pl-3 relative border-l border-dashed border-border/70 dark:border-border/60`.
   - Add horizontal dashed connector tick from parent guide line to child row: `<span className="absolute -left-3 top-1/2 -translate-y-1/2 w-3 border-t border-dashed border-border/70 pointer-events-none" />`.
   - Ensure all key, type badge, and action items have proper `shrink-0` to guarantee precise alignment geometry across deep nesting levels.
2. **Form View (`JsonFormRow`)**:
   - Add vertical dashed alignment border on nested children container: `ml-4 pl-3.5 relative border-l border-dashed border-border/70 dark:border-border/60`.
   - Add horizontal connector tick: `<span className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-3.5 border-t border-dashed border-border/70 pointer-events-none" />`.
   - Enforce fixed key column width (`w-40 shrink-0`) and fixed type badge selector width (`w-20 shrink-0`) so all value inputs begin at an aligned horizontal baseline.
3. **Verification**:
   - Run typecheck and unit tests to ensure zero regressions.

## Changes
- `apps/console/src/components/ui/json-editor/json-tree-node.tsx`: Added dashed guide lines, horizontal ticks, and `shrink-0` alignment constraints.
- `apps/console/src/components/ui/json-editor/json-form-row.tsx`: Added dashed guide lines, connector ticks, and fixed column width grid alignment across nested levels.

## Verification
- `pnpm --filter @unipost/console test:run src/components/ui/json-editor/__tests__/visual-json-editor.test.tsx` -> 5/5 passing.
- `pnpm --filter @unipost/console test:run src/features/metadata/components/dynamic-fields/__tests__/dynamic-field-renderer.test.tsx src/features/metadata/components/data-explorer/__tests__/phase1-ergonomics.test.tsx` -> 13/13 passing.
- `pnpm --filter @unipost/console exec tsc --noEmit` -> 0 errors.
