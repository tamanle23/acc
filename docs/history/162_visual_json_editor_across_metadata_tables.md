# 162. Visual JSON Editor Across Metadata-Driven Tables

**Date:** 2026-10-20  
**Status:** Completed  
**Scope:** `@acc/console`  

## Problem
In Dynamic Metadata-Driven Tables (`EntityDataGrid`, `DynamicFieldRenderer`, `RecordEditorDialog`, and `MasterDetailRowInspector`), attributes of type `JSON` / `json_editor` were rendered and edited as raw, unformatted `<Textarea rows={4}>` strings or truncated `<code>{JSON.stringify(val)}</code>` text. This caused frequent syntax errors from missing quotes/brackets, prevented visual inspection of deep nested hierarchies, and cluttered table grid rows.

## Plan
1. Create a zero-bloat, lightweight `VisualJsonEditor` component suite with 3 modes: Tree, Form, and Code.
2. Implement recursive `JsonTreeNode` with collapsible nodes, inline type conversion, key renaming, and element mutation.
3. Build `JsonCellPopover` for interactive `{ N keys }` / `[ N items ]` cell inspection in `EntityDataGrid`.
4. Integrate into `DynamicFieldRenderer`, `EntityDataGrid`, and `MasterDetailRowInspector`.
5. Verify with automated Vitest suites and TypeScript type checking.

## Changes
- `apps/console/src/components/ui/json-editor/json-tree-node.tsx`: Recursive tree node with type dropdowns, key rename, and value inputs.
- `apps/console/src/components/ui/json-editor/visual-json-editor.tsx`: Mode switcher, formatting, minifying, templates, and syntax linting.
- `apps/console/src/components/ui/json-editor/json-cell-popover.tsx`: Click-to-inspect popover for table cells with key search.
- `apps/console/src/components/ui/json-editor/index.ts`: Module exports.
- `apps/console/src/components/ui/json-editor/__tests__/visual-json-editor.test.tsx`: Vitest coverage.
- `apps/console/src/features/metadata/components/dynamic-fields/dynamic-field-renderer.tsx`: Upgraded `json_editor` case to `VisualJsonEditor`.
- `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`: Upgraded table cells to `JsonCellPopover`.
- `apps/console/src/features/metadata/components/data-explorer/master-detail-row-inspector.tsx`: Upgraded JSON display to `VisualJsonEditor`.

## Verification
- `pnpm --filter @acc/console test:run src/components/ui/json-editor/__tests__/visual-json-editor.test.tsx` -> 4/4 passing.
- `pnpm --filter @acc/console test:run src/features/metadata/components/dynamic-fields/__tests__/dynamic-field-renderer.test.tsx` -> 7/7 passing.
- `pnpm --filter @acc/console test:run src/features/metadata/components/data-explorer/__tests__/phase1-ergonomics.test.tsx` -> 6/6 passing.
- `pnpm --filter @acc/console exec tsc --noEmit` -> 0 errors.
