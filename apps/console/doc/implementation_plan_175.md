# Console Implementation Plan - Iteration 175
# Custom Task Studio Palette Deduplication, Quick Insert, and Dynamic Schema Inspector

## 1. Executive Summary
This companion implementation plan details the Console UI changes for Iteration 79 (Master Plan `docs/iterations/master_implementation_plan_iteration_79.md`). It ensures that Visual DAG Studio fully leverages first-class Task Definitions by:
1. Deduplicating built-ins from custom tasks in `DagPalette`.
2. Making custom task definitions discoverable and insertable via `DagQuickInsertPopover`.
3. Dynamically generating schema-driven form controls in `DagPropertyInspector` with variable interpolation autocomplete.
4. Adding contract parameter completeness validation to `DagSemanticLinter`.

---

## 2. Technical Details & Component Signatures

### 2.1 Studio Palette Deduplication
- **File**: `apps/console/src/features/workflows/components/studio/palette/dag-palette.tsx`
- **Change**: In `catalogItems`, filter out items where `td.isBuiltIn === true` or `td.name === 'SIMPLE'`. This prevents the 23 built-in platform nodes from appearing twice in the Studio palette.

### 2.2 Quick Insert Popover Integration
- **File**: `apps/console/src/features/workflows/components/studio/canvas/dag-quick-insert-popover.tsx`
- **Change**:
  - Consume `useTaskDefinitions()` to fetch published task definitions.
  - Convert custom task definitions (`!td.isBuiltIn`) into searchable `PaletteItem` objects.
  - Support category filtering (`'catalog'`) and search matching on label and description.
  - On node insertion, pass `{ taskType: 'SIMPLE', taskDefName: td.name, taskDefVersion: td.version, inputSchema: td.inputSchema, outputSchema: td.outputSchema }`.

### 2.3 Dynamic Schema Property Inspector
- **File**: `apps/console/src/features/workflows/components/studio/inspectors/dag-property-inspector.tsx`
- **Change**:
  - Display Task Definition banner (`taskDefName`, pinned version `v{taskDefVersion}`).
  - When `latestTaskDefVersion > taskDefVersion`, render upgrade trigger opening `TaskVersionDiffModal`.
  - In `Data (I/O)` tab, if `formData.inputSchema` has defined properties:
    - Render typed inputs for primitive fields (`string`, `number`, `boolean`, `enum`).
    - Add variable binding shortcut button next to each field to trigger `VariableBindingPopover`.
  - Provide toggle between **Schema Form** and **Visual JSON Editor**.

### 2.4 Semantic Linter Verification
- **File**: `apps/console/src/features/workflows/components/studio/utils/validation/dag-semantic-linter.ts`
- **Change**: Add rule `LINT_TASK_CONTRACT_REQUIRED_KEYS` verifying node input parameters contain all required keys specified in the task definition contract.

---

## 3. Verification Plan
- `pnpm --filter @acc/console test -- dag-palette`: Verify catalog items exclude built-in tasks.
- `pnpm --filter @acc/console test -- dag-quick-insert`: Verify custom tasks appear in search results.
- `pnpm --filter @acc/console test -- dag-property-inspector`: Verify dynamic schema form rendering and variable bindings.
- `pnpm --filter @acc/console test -- dag-semantic-linter`: Verify missing required parameters trigger warning badges.
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
