# Implementation Plan: Decompose VisualDagStudio Monolith & Reorganize Workflow Subgroups

## 1. Context & Motivation
`VisualDagStudio` in `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx` has grown to ~2,367 lines, combining:
- State management for undo/redo, nodes/edges, diffing, time-travel scrubbing, simulation, debugger execution, modals, and container resize tracking.
- Topological auto-layout algorithms (Kahn's / layer map).
- Edge decorators, node decorators, and traversed emerald glow calculations.
- Giant JSX containing header command dock, debugger subpill, palette snapping, empty state, react-flow canvas, property inspector drawer, telemetry sheet, time-travel scrubber, IR dialog, dry-run modal, and hot-migration modal.
- Additionally, `apps/console/src/features/workflows/components` has a mixed collection of catalog tables, modals, drawers, scrubbers, and studio components directly under the root folder.

## 2. Proposed Architecture & Folder Structure

We organize `apps/console/src/features/workflows/components/` into cohesive, domain-driven subgroups:

```
apps/console/src/features/workflows/components/
├── catalog/                             # Catalog list & create
│   ├── workflow-catalog-columns.tsx
│   ├── workflow-catalog-table.tsx
│   ├── workflow-create-dialog.tsx
│   └── index.ts
├── execution/                           # Execution drawers & diffing
│   ├── execution-run-drawer.tsx
│   ├── execution-time-travel-scrubber.tsx
│   ├── payload-diff-viewer.tsx
│   └── index.ts
├── migration/                           # Fleet & Hot migration modals
│   ├── fleet-migration-modal.tsx
│   ├── hot-migration-modal.tsx
│   └── index.ts
├── studio/                              # Visual DAG Studio & Canvas Subcomponents
│   ├── canvas/                          # Canvas nodes, edges, empty state & quick insert
│   │   ├── dag-node.tsx
│   │   ├── dag-condition-edge.tsx
│   │   ├── dag-quick-insert-popover.tsx
│   │   ├── dag-canvas-empty-state.tsx
│   │   ├── dag-selection-toolbar.tsx
│   │   └── index.ts
│   ├── toolbar/                         # Floating command dock & clusters
│   │   ├── dag-header-command-bar.tsx
│   │   ├── dag-debugger-subpill.tsx
│   │   ├── dag-validation-banner.tsx
│   │   └── index.ts
│   ├── palette/                         # Node palette accordion & items
│   │   ├── dag-palette.tsx
│   │   └── index.ts
│   ├── inspectors/                      # Node property inspector & runtime telemetry
│   │   ├── dag-property-inspector.tsx
│   │   ├── task-telemetry-inspector.tsx
│   │   └── index.ts
│   ├── timeline/                        # Scrubber & concurrency flamegraph
│   │   ├── time-travel-scrubber.tsx
│   │   ├── workflow-execution-flamegraph.tsx
│   │   └── index.ts
│   ├── modals/                          # IR import/export & dry-run simulation
│   │   ├── dag-edge-condition-modal.tsx
│   │   ├── workflow-ir-dialog.tsx
│   │   ├── workflow-dry-run-modal.tsx
│   │   ├── workflow-variable-watch-drawer.tsx
│   │   └── index.ts
│   ├── hooks/                           # Studio custom hooks
│   │   ├── use-dag-studio-state.ts      # Core node/edge state, undo/redo, auto-layout, keyboard shortcuts
│   │   ├── use-dag-execution-sync.ts    # Live stream sync, diffing, time-travel events & scrubbing
│   │   └── index.ts
│   ├── utils/                           # IR converter & layout algorithms
│   │   ├── workflow-ir-converter.ts
│   │   ├── dag-sample-data.ts           # BLANK_WORKFLOW_NODES, INITIAL_NODES, etc.
│   │   └── index.ts
│   ├── visual-dag-studio.tsx            # Clean, composed orchestrator (< 350 lines)
│   └── index.ts                         # Backward-compatible barrel re-exporting all studio primitives
└── index.ts                             # Root components barrel exporting catalog, execution, migration, studio
```

## 3. Step-by-Step Execution Plan

### Step 1: Subgroup Organization in `features/workflows/components/`
- Move catalog components to `components/catalog/`:
  - `workflow-catalog-columns.tsx`
  - `workflow-catalog-table.tsx`
  - `workflow-create-dialog.tsx`
  - `components/catalog/index.ts`
- Move execution components to `components/execution/`:
  - `execution-run-drawer.tsx`
  - `execution-time-travel-scrubber.tsx`
  - `payload-diff-viewer.tsx`
  - `components/execution/index.ts`
- Move migration modals to `components/migration/`:
  - `fleet-migration-modal.tsx`
  - `hot-migration-modal.tsx`
  - `components/migration/index.ts`
- Create root `components/index.ts` exporting from `./catalog`, `./execution`, `./migration`, and `./studio`.

### Step 2: Decompose Studio Subcomponents
- Extract sample/initial constants to `studio/utils/dag-sample-data.ts`:
  - `BLANK_WORKFLOW_NODES`, `BLANK_WORKFLOW_EDGES`, `INITIAL_NODES`, `INITIAL_EDGES`.
- Extract Header Command Bar to `studio/toolbar/dag-header-command-bar.tsx`:
  - Props: `containerWidth`, `isReadOnly`, `workflowKey`, `workflowVersions`, `diffTargetVersion`, `onDiffVersionChange`, `isExecutionMode`, `executionId`, `onOpenHotMigration`, `undoDisabled`, `redoDisabled`, `onUndo`, `onRedo`, `onAutoLayout`, `isSnapToGrid`, `onToggleSnapToGrid`, `edgeRoutingMode`, `onToggleEdgeRouting`, `activeViewTab`, `onChangeViewTab`, `showPalette`, `onTogglePalette`, `onNewBlank`, `onValidateDag`, `validationErrorsCount`, `onDryRun`, `onExportJson`, `onOpenImportDialog`, `onResetInitial`, `onClearSelected`, `hasSelectedNodes`, `isFullscreen`, `onToggleFullscreen`, `onSave`, `isSaving`, `onCloseExecution`.
- Extract Execution Debugger Sub-Pill to `studio/toolbar/dag-debugger-subpill.tsx`:
  - Props: `top`, `breakpointsCount`, `onPause`, `onStepOver`, `onResume`, `isVariableWatchOpen`, `onToggleVariableWatch`.
- Extract Validation Banner to `studio/toolbar/dag-validation-banner.tsx`:
  - Props: `visible`, `errors`, `onDismiss`.
- Extract custom hooks:
  - `use-dag-studio-state.ts`:
    - Handles `nodes`, `edges`, `undoStack`, `redoStack`, `pushUndoSnapshot`, `handleUndo`, `handleRedo`, `handleAutoLayout`, `handleAlign*`, `handleDistribute*`, `handleDuplicateSelected`, `handleBulkDelete`, `handleSplitEdge`, `handleInsertStarterTask`, `keyboard shortcuts`.
  - `use-dag-execution-sync.ts`:
    - Handles stream sync, time-travel history scrubber states (`timelineEvents`, `currentScrubberIndex`, `isPlaying`, `playbackSpeed`, `isLiveHead`, `applyEventsUpToIndex`), and graph diff overlays.

### Step 3: Recompose `visual-dag-studio.tsx`
- Refactor `visual-dag-studio.tsx` into a high-level, declarative container that connects the hooks with ReactFlow and the decomposed UI subcomponents (`DagHeaderCommandBar`, `DagDebuggerSubpill`, `DagValidationBanner`, `DagPalette`, `DagCanvasEmptyState`, inspectors, and modals).
- Ensure file length is reduced from 2,367 lines to under 350 lines!

### Step 4: Backward Compatibility & Test Verification
- Keep `studio/index.ts` and `components/index.ts` fully backward compatible, re-exporting all components, types, and constants.
- Update test imports if needed, and run full test suites:
  - `pnpm --filter @acc/console test -- src/features/workflows/`
  - `pnpm --filter @acc/console exec tsc --noEmit`
- Verify zero regressions and passing tests.

### Step 5: History Log & Walkthrough Documentation
- Create `apps/console/doc/walkthrough_146.md`.
- Create `docs/history/184_decompose_visual_dag_studio_and_reorganize_workflows.md`.
- Update `docs/history/README.md`.
- Git commit: `refactor(workflows): [184] decompose visual dag studio monolith and reorganize workflow components into subgroup folders`.
