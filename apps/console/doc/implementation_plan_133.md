# Implementation Plan: Visual JSON Editor Across Metadata-Driven Tables

## Goal Description
In Dynamic Metadata-Driven Tables (`EntityDataGrid`, `DynamicFieldRenderer`, `RecordEditorDialog`, and `MasterDetailRowInspector`), attributes typed as `JSON` / `json_editor` are currently presented and edited as raw, unformatted `<Textarea rows={4}>` strings or truncated `<code>{JSON.stringify(val)}</code>` text. This causes major developer and business user friction:
1. Syntax errors from accidental missing quotes, trailing commas, or unbalanced braces fail silently or crash validation.
2. Nested objects and deep arrays cannot be navigated, folded, or modified intuitively without expert JSON knowledge.
3. In table grid cells, large JSON documents either truncate unhelpfully (`max-w-[120px]`) or expand uncontrollably, with no quick visual preview or inline tree inspection.
4. Developers and admins cannot easily inject common structured templates (e.g. Geolocation `{lat, lng}`, Address `{street, city, zip}`, Key-Value pairs, or Array of Objects).

This implementation provides a unified, production-grade **Visual JSON Editor & Cell Inspector** component suite across the entire metadata system with zero runtime bloat, Liquid Glass aesthetic adherence, full WCAG 2.2 AA accessibility, and 3 interchangeable modes:
- **Tree Mode**: Visual interactive collapsible node tree with inline type badges (`string`, `number`, `boolean`, `array`, `object`), drag/add/remove keys, and inline editing.
- **Form / Key-Value Mode**: High-level structured field builder for non-technical users to edit object attributes without touching JSON brackets.
- **Code / Raw Mode**: Formatted syntax-highlighted editor with instant JSON syntax validation, beautify/minify formatting shortcuts, and error squiggly indicators.
- **Cell Hover / Click-to-Inspect**: Interactive popover/drawer trigger on JSON table cells in `EntityDataGrid`.

---

## User Review Required

> [!IMPORTANT]
> **Key Architecture & Design Decisions:**
> 1. **Zero Heavy External Dependencies**: To avoid multi-megabyte bundle increases (e.g. heavy Monaco web workers), we implement the visual editor using lightweight React primitives, Lucide icons, and Tailwind v4 Liquid Glass styling, with a robust native parser, formatter, and path-traversal engine.
> 2. **Bidirectional Synchronization**: Any modification made in Tree Mode, Form Mode, or Raw Code Mode updates the single underlying JSON AST and notifies `onChange(parsedObject)`.
> 3. **Non-Destructive String Fallback**: If the user is actively typing invalid JSON in Code Mode, the editor preserves the draft text without corrupting the record state until valid or explicitly committed.
> 4. **Table Grid Cell Experience**: In `EntityDataGrid`, JSON cells render a styled interactive badge (e.g. `{ } 4 keys` or `[ ] 12 items`) that opens a slide-over/popover quick visual inspector on click instead of plain truncated string code.

---

## Open Questions

> [!NOTE]
> 1. **Default Mode for `DynamicFieldRenderer`**: Should the JSON editor default to **Tree Mode** (best for nested structures) or **Form/Key-Value Mode** (best for flat configs)?
> 2. **Size Threshold for Inline vs Dialog**: For compact forms (like quick record edit), should large JSON documents automatically suggest expanding into a full modal view?

---

## Proposed Changes

```mermaid
flowchart TD
    subgraph Visual JSON Editor Architecture
        VJE[VisualJsonEditor Component]
        Modes[Mode Switcher: Tree | Form | Code]
        AST[Bidirectional JSON AST Engine]
        VJE --> Modes
        Modes --> TreeView[Tree Mode: Collapsible Nodes, Type Badges, Add/Remove]
        Modes --> FormView[Form Mode: Key-Value Table, Typed Inputs]
        Modes --> CodeView[Code Mode: Syntax Formatting, Linting & Beautify]
        TreeView --> AST
        FormView --> AST
        CodeView --> AST
    end

    subgraph Consumer Integration
        DFR[DynamicFieldRenderer: json_editor]
        RED[RecordEditorDialog Form]
        EDG[EntityDataGrid Cell: JsonCellPopover]
        MDI[MasterDetailRowInspector: History & Field Diff]
        AST --> DFR
        AST --> RED
        AST --> EDG
        AST --> MDI
    end
```

---

### Component Architecture & Implementation

#### [NEW] `apps/console/src/components/ui/json-editor/visual-json-editor.tsx`
- The core multi-mode visual editor component.
- Supports props: `value: unknown`, `onChange: (val: unknown) => void`, `readOnly?: boolean`, `defaultMode?: 'tree' | 'form' | 'code'`, `height?: string | number`, `templates?: Array<{ name: string; schema: object }>`.
- Includes toolbar with:
  - Mode Switcher Segmented Buttons (`Tree`, `Form`, `Code`).
  - Format / Beautify button (`Prettify`).
  - Minify button.
  - Template Injection selector (Empty Object, Empty Array, Key-Value Pairs, Geo Coordinates, Keyed Metadata).
  - Copy to Clipboard with toast feedback.
  - Real-time syntax validator status indicator (`Valid JSON` in emerald, `Syntax Error: line X` in ruby).

#### [NEW] `apps/console/src/components/ui/json-editor/json-tree-node.tsx`
- Recursive collapsible node renderer:
  - Expand/collapse chevron with depth indentation.
  - Key name editing and automatic path resolution (`data.items[2].price`).
  - Type-aware inline value inputs (Boolean toggle, Number spinner, String input, Null indicator).
  - Contextual actions: Add Child Key, Add Array Item, Change Type, Delete Key.

#### [NEW] `apps/console/src/components/ui/json-editor/json-cell-popover.tsx`
- Compact table cell badge for `EntityDataGrid`:
  - Renders compact summary: `{ } N keys` or `[ ] N items` with subtle Liquid Glass pill badge.
  - On click, opens a popover or mini-dialog displaying the formatted Tree or Raw JSON with search/filter inside the document keys and copy button.

#### [MODIFY] `apps/console/src/features/metadata/components/dynamic-fields/dynamic-field-renderer.tsx`
- Replace lines 406-430 (`case 'json_editor'`) plain `<Textarea>` with `<VisualJsonEditor>`.
- Wire options for pre-configured templates if specified in `attribute.options`.

#### [MODIFY] `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`
- In dynamic column cell renderer (lines 760-766), replace `<code>{JSON.stringify(val)}</code>` with `<JsonCellPopover value={val} attributeName={attr.name} />`.

#### [MODIFY] `apps/console/src/features/metadata/components/data-explorer/master-detail-row-inspector.tsx`
- In field inspector values (lines 213-217), embed collapsible visual JSON preview with search/filter for JSON-typed attributes.

---

## Verification Plan

### Automated Tests
```bash
# 1. Unit tests for VisualJsonEditor and JsonTreeNode
pnpm --filter @unipost/console test:run src/components/ui/json-editor/__tests__/visual-json-editor.test.tsx

# 2. DynamicFieldRenderer and EntityDataGrid integration tests
pnpm --filter @unipost/console test:run src/features/metadata/components/dynamic-fields/__tests__/dynamic-field-renderer.test.tsx
pnpm --filter @unipost/console test:run src/features/metadata/components/data-explorer/__tests__/phase1-ergonomics.test.tsx

# 3. TypeScript validation
pnpm --filter @unipost/console exec tsc --noEmit

# 4. ESLint compliance
pnpm --filter @unipost/console lint
```

### Manual Verification
1. **Dynamic Form Editing**: Open Record Editor Dialog for an entity with a JSON field (e.g. `Telemetry Data` or `Options`), toggle between Tree, Form, and Code modes, add an attribute, and save.
2. **Cell Popover Inspection**: Open `EntityDataGrid`, click a JSON cell badge, navigate the nested tree in the popover, search for a key, and copy.
3. **Syntax Guarding**: Type invalid JSON in Code mode, verify error banner appears without corrupting parent state, fix syntax, and verify status turns green.
4. **Master-Detail Inspector**: Press `Enter` on a row in `EntityDataGrid` and verify JSON attributes render with interactive tree view and copy buttons.
