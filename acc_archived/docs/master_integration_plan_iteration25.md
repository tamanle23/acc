# Master Integration Plan - Iteration 25: Professional Visual VideoIR JSON Editor & Debugger

## Summary
Modernize `VisualIRJsonDebuggerModal.tsx` from a simple raw monospace textarea with a read-only tree into a high-performance, professional, two-way interactive **Visual JSON Editor & Live Debugger** following `/frontend-app-architect`, `/ui-ux-design-system`, and `/typescript-node-architect`.

---

## 1. Problem Statement & UX Gaps
Currently in `VisualIRJsonDebuggerModal.tsx`:
1. **Raw Textarea Only**: Editing is done in an unstyled HTML `<textarea>` with zero syntax highlighting, making complex nested JSON (1,000+ lines of VideoIR) tedious and error-prone to read.
2. **Read-Only AST Tree**: The `AST Tree Navigator` only renders static labels and counts; users cannot edit primitive values, toggle booleans, modify sequence metadata, or add/delete entries directly in the visual tree.
3. **Tab Disconnection**: Users must switch between "Raw Editor" and "Tree Navigator" tabs without seeing visual structures and code side-by-side or being able to visually isolate problematic nodes.
4. **Lack of In-Place Visual Controls**: Primitive values like numbers, colors, booleans, and enum types (e.g. `type: "video" | "audio"`, `fit: "contain" | "cover"`) lack interactive form controls (toggles, sliders, color chips, dropdown selects).
5. **No Visual Node Actions**: Users cannot add modifiers, duplicate sequences, or delete nodes directly within the tree view.

---

## 2. Target Modular Architecture
Decompose the debugger component into modular, single-responsibility files under `apps/studio/src/components/debugger/`:

```
apps/studio/src/components/debugger/
├── VisualIRJsonDebuggerModal.tsx        # Main Dialog Container & Orchestrator (Keeps public API & exports)
├── visual-editor/
│   ├── VisualJsonTreeEditor.tsx         # Interactive Recursive Tree Editor with full in-place editing
│   ├── VisualJsonTreeNode.tsx           # Individual expandable node with breadcrumb, type badge & actions
│   ├── VisualJsonFieldEditor.tsx        # In-place typed editors (Text, Number, Boolean toggle, Enum select)
│   ├── VisualJsonNodeContextMenu.tsx    # Context menu / action pill (Copy path, Insert child, Delete, Duplicate)
│   └── VisualJsonPathBreadcrumb.tsx     # Interactive breadcrumb navigation (e.g., tracks > 0 > sequences > 2)
├── code-editor/
│   ├── ShikiCodeViewer.tsx              # Shiki syntax-highlighted editor with line numbers & error gutter marks
│   └── CodeEditorToolbar.tsx            # Format, Minify, Copy, Reset, Diff toggle, Search/Replace
├── diagnostics/
│   ├── DiagnosticTelemetryCard.tsx      # Schema, DAG anchors, Modifier coverage, and Quick-fix suggestions
│   └── QuickFixActionPanel.tsx          # 1-click automatic repairs (remove dangling anchors, register placeholders)
└── types.ts                             # Shared interfaces & JSON path pointer utilities
```

### Key Capabilities
1. **Dual-View Modes**:
   - **Visual Split Mode (Default)**: Visual Interactive Tree on the left (55%) with direct visual editing, and live Synchronized Code Editor on the right (45%).
   - **Visual Tree Only Mode**: Fullscreen clean UI for non-coder visual editing with form controls.
   - **Code Editor Only Mode**: Fullscreen code editor with line numbers, gutter error indicators, and live schema validation.
   - **Diagnostics & DAG Health Mode**: Deep relational DAG topology, anchor mapping, and schema issue inspector.

2. **Interactive Visual Tree Node Features**:
   - **Direct In-Place Editing**:
     - *Booleans*: Clickable switch/toggle badge (`true` / `false`).
     - *Numbers*: Numeric stepper / editable pill (e.g. `offsetFrames: 10`, `scale: 1.0`).
     - *Strings*: In-place inline editable text with auto-commit on blur or Enter.
     - *Enums*: Dropdown select for known VideoIR enums (`fit`, `type`, `mode`, etc.).
   - **Node Operations**:
     - ➕ Add Property / Add Array Item.
     - 📋 Copy JSON Path (e.g. `tracks[0].sequences[1].time`).
     - 🗑️ Delete Node with confirmation.
     - 📑 Duplicate Node.
   - **Rich Semantic Badges**:
     - Sequence badges (`#seq-xxx`, archetype colors, duration).
     - Track badges (video, audio, text, overlay).
     - Modifier badges (`fx/bloom`, `motion/gsap`, etc.).

3. **High-Performance JSON Pointer Mutator**:
   - Immutable mutations via RFC 6901 JSON pointer or path array `mutateJsonAtPath(obj, path, newValue)`.
   - Maintains full synchronization between visual edits and raw JSON buffer.
   - Instant re-analysis with `analyzeVideoIRJson` so syntax and schema states are continually validated in real time.

4. **Integration & Undo/Redo Safety**:
   - Applying to studio uses `IRStateManager.getInstance().applyJSONEdit(rawJson)`, retaining full undo/redo history through `ReplaceDocumentCommand`.
   - `analyzeVideoIRJson(rawJson)` pure analyzer function is preserved with 100% backward compatibility for existing test suites.

---

## 3. Implementation Steps

### Step 1: Core Types & Path Mutation Engine (`types.ts` & `jsonPathUtils.ts`)
- Implement `getJsonValueAtPath(root, path)` and `setJsonValueAtPath(root, path, value)`.
- Implement `deleteJsonValueAtPath(root, path)`.
- Implement `insertJsonArrayItem(root, path, item)`.
- Write unit tests ensuring immutable and clean operations without prototype pollution.

### Step 2: In-Place Visual Editors (`VisualJsonFieldEditor.tsx`)
- Specialized micro-controls for:
  - String editing (quick click-to-edit with blur commit).
  - Number inputs with step buttons.
  - Boolean pill toggle (Emerald true / Slate false).
  - Color previews for hex codes (`#ff00ff`).
  - Known VideoIR enum selectors.

### Step 3: Interactive Tree View (`VisualJsonTreeEditor.tsx` & `VisualJsonTreeNode.tsx`)
- Expand / collapse all buttons.
- Search and filter with highlighting and auto-expansion of matching branches.
- Breadcrumb tracking when clicking/focusing any node.
- Action menus for inserting/deleting elements.

### Step 4: Shiki / Code Editor Enhancement (`code-editor/`)
- Syntax highlighted code preview using the existing `apps/studio/src/lib/highlighter.tsx` Shiki engine.
- Line numbers with red/amber error badges next to offending line numbers.
- Format (Prettify) and Minify buttons.

### Step 5: Modal Assembly & Layout Polish (`VisualIRJsonDebuggerModal.tsx`)
- Modern glassmorphism dialog styling consistent with Studio Theme tokens.
- Layout switcher: `Split View` | `Visual Tree` | `Raw Code` | `Diagnostics`.
- Quick-fix button for fixing common schema issues (e.g. stripping unknown keys or repairing broken start anchor times).

### Step 6: Verification & Test Suite
- Run `bun test autogenerated-tests/studio_json_debugger_roundtrip.test.ts`.
- Add new test cases in `autogenerated-tests/studio_visual_json_editor.test.ts` verifying path mutations, visual node updates, and round-trip JSON serialization.
- Run `bun run --cwd apps/studio build` to ensure clean TypeScript and Vite compilation.

---

## 4. Verification Plan

### Automated Tests
```bash
bun test autogenerated-tests/studio_json_debugger_roundtrip.test.ts autogenerated-tests/studio_visual_json_editor.test.ts
bun run --cwd apps/studio build
```

### Manual Verification Flow
1. Open Studio via `bun run --cwd apps/studio dev`.
2. Click **Debugger** button in Titlebar (or press `Ctrl+Shift+J`).
3. Verify the new dual-pane Visual Editor opens.
4. Expand a sequence in the Visual Tree, double click a title/duration value, change it, and verify the raw JSON pane updates in real time.
5. Toggle a boolean or select an enum value in the tree; verify the raw JSON updates.
6. Click **Apply to Studio**; verify timeline updates and press `Ctrl+Z` to verify undo.
