# Walkthrough - Visual JSON Editor Across Metadata-Driven Tables

**Task:** Implement a multi-mode visual editor for JSON/JSONB attributes across Dynamic Metadata-Driven Tables in `@acc/console`.

---

## 1. Summary of Changes

### Visual JSON Editor Component Suite (`apps/console/src/components/ui/json-editor/`)
- **`JsonTreeNode` (`json-tree-node.tsx`)**:
  - Recursive collapsible node hierarchy with indentation and expand/collapse controls.
  - Interactive type badges (`string`, `number`, `boolean`, `object`, `array`, `null`) with icon indicators and quick dropdown type conversion.
  - Double-click inline key renaming with validation.
  - Inline value editing: text input for strings, numeric input for numbers, toggles for booleans, and null badges.
  - Contextual row actions: Add Child Key / Array Item, Delete element.
- **`VisualJsonEditor` (`visual-json-editor.tsx`)**:
  - 3 synchronized interactive modes:
    - **Tree Mode**: Structural tree inspection and interactive element manipulation.
    - **Form Mode**: High-level structured key-value property view.
    - **Code Mode**: Syntax-highlighted formatted text editor with instant JSON syntax validation.
  - Prettify (format) and Minify utility actions.
  - Template injection menu: Empty Object, Empty Array, Key-Value Metadata, Geo Location, Contact Profile.
  - Copy JSON to clipboard with feedback.
  - Non-destructive draft handling: Syntax errors during code typing preserve state without corrupting parsed AST.
- **`JsonCellPopover` (`json-cell-popover.tsx`)**:
  - Interactive table grid badge rendering summary `{ N keys }` or `[ N items ]`.
  - On click, displays an interactive Liquid Glass popover containing the embedded `VisualJsonEditor` with key search and copy functionality.

### Integration Across Metadata-Driven Tables
- **`DynamicFieldRenderer` (`dynamic-field-renderer.tsx`)**:
  - Upgraded `case 'json_editor'` to render `<VisualJsonEditor>` instead of plain multi-line `<Textarea>`.
- **`EntityDataGrid` (`entity-data-grid.tsx`)**:
  - Upgraded table cells with `typeof val === 'object'` or `uiComponent === 'json_editor'` to render `<JsonCellPopover>`.
- **`MasterDetailRowInspector` (`master-detail-row-inspector.tsx`)**:
  - Upgraded field details to render collapsible `<VisualJsonEditor>` in read-only tree mode.

---

## 2. Verification Results

| Suite | Status | Details |
| :--- | :--- | :--- |
| `visual-json-editor.test.tsx` | **PASS** | 4/4 unit tests passing (tree rendering, code mode, syntax error badge, cell popover) |
| `dynamic-field-renderer.test.tsx` | **PASS** | 7/7 unit tests passing |
| `phase1-ergonomics.test.tsx` | **PASS** | 6/6 unit tests passing |
| `tsc --noEmit` | **PASS** | 0 TypeScript errors |

---

## 3. Screenshots / UI Manifest
- **Tree Mode**: Collapsible node tree with type badges and add/delete actions.
- **Form Mode**: Key-value property inspector for flat configurations.
- **Code Mode**: Formatted textarea with real-time green/red validity status badge.
- **Table Cell**: `{ N keys }` pill badge that opens popover inspector on click.
