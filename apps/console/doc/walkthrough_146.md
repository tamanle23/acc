# Walkthrough: Workflow Components Subgroup Reorganization & Studio Monolith Decomposition

## 1. Overview
Decomposed the 2,367-line monolithic [visual-dag-studio.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx) into high-cohesion, reusable subcomponents and hooks, reducing file size by **over 61%** (from 2,367 lines down to 909 lines). In addition, reorganized all flat workflow components in [apps/console/src/features/workflows/components](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components) into dedicated, maintainable domain subgroups with backward-compatible barrel exports.

---

## 2. Architecture & Subgroup Organization

### 2.1 Workflow Feature Domain Subgroups
The previous flat directory structure of `apps/console/src/features/workflows/components` was regrouped into four domain modules:

```
apps/console/src/features/workflows/components/
├── catalog/                             # Catalog list & creation dialog
│   ├── workflow-catalog-columns.tsx
│   ├── workflow-catalog-table.tsx
│   ├── workflow-create-dialog.tsx
│   └── index.ts
├── execution/                           # Execution telemetry drawers & diffing
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
│   ├── palette/                         # 23-node categorized palette
│   │   ├── dag-palette.tsx
│   │   └── index.ts
│   ├── inspectors/                      # Node property inspector & runtime telemetry
│   │   ├── dag-property-inspector.tsx
│   │   ├── task-telemetry-inspector.tsx
│   │   └── index.ts
│   ├── timeline/                        # Replay scrubber & concurrency flamegraph
│   │   ├── time-travel-scrubber.tsx
│   │   ├── workflow-execution-flamegraph.tsx
│   │   └── index.ts
│   ├── modals/                          # IR import/export, dry-run simulation & variable watch
│   │   ├── dag-edge-condition-modal.tsx
│   │   ├── workflow-ir-dialog.tsx
│   │   ├── workflow-dry-run-modal.tsx
│   │   ├── workflow-variable-watch-drawer.tsx
│   │   └── index.ts
│   ├── hooks/                           # Encapsulated state & execution sync hooks
│   │   ├── use-dag-studio-state.ts      # Core DAG nodes/edges, undo/redo, auto-layout, keyboard shortcuts
│   │   ├── use-dag-execution-sync.ts    # Real-time SSE sync, timeline events, and diff overlays
│   │   └── index.ts
│   ├── utils/                           # IR converter & sample datasets
│   │   ├── workflow-ir-converter.ts
│   │   ├── dag-sample-data.ts           # BLANK_WORKFLOW_NODES, INITIAL_NODES, etc.
│   │   └── index.ts
│   ├── visual-dag-studio.tsx            # Clean, composed orchestrator
│   └── index.ts                         # Backward-compatible barrel re-exporting all studio primitives
└── index.ts                             # Root components barrel exporting all subgroups
```

---

## 3. Key Components Extracted & Refactored

1. **`DagHeaderCommandBar`** ([dag-header-command-bar.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/toolbar/dag-header-command-bar.tsx)):
   - Encapsulates the responsive top dock, left identity cluster, center canvas ergonomics cluster, and right action cluster.
2. **`DagDebuggerSubpill`** ([dag-debugger-subpill.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/toolbar/dag-debugger-subpill.tsx)):
   - Floating amber execution debugger controls with pause, step-over, resume, and variable watch trigger.
3. **`DagValidationBanner`** ([dag-validation-banner.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/toolbar/dag-validation-banner.tsx)):
   - Acyclic Kahn/Tarjan topological issue reporter and dismissible success toast.
4. **`useDagStudioState`** ([use-dag-studio-state.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/hooks/use-dag-studio-state.ts)):
   - Encapsulates nodes/edges manipulation, 24-step undo/redo snapshots, auto-layout, multi-node alignment, bulk deletion, edge-splitting, and keyboard shortcuts (`Cmd+Z`, `Cmd+Y`, `Cmd+D`, `Delete`).
5. **`useDagExecutionSync`** ([use-dag-execution-sync.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/hooks/use-dag-execution-sync.ts)):
   - Encapsulates SSE execution sync, timeline event hydration, time-travel playback intervals, and version diff graph tagging.
6. **`dag-sample-data.ts`** ([dag-sample-data.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/utils/dag-sample-data.ts)):
   - Centralized initial sample datasets (`BLANK_WORKFLOW_NODES`, `BLANK_WORKFLOW_EDGES`, `INITIAL_NODES`, `INITIAL_EDGES`).

---

## 4. Verification & Testing

- **Workflows Test Suite**:
  ```bash
  pnpm --filter @acc/console test -- src/features/workflows/
  ```
  Result: 19 test files passed, 83/83 tests green.
- **TypeScript Typecheck**:
  ```bash
  pnpm --filter @acc/console exec tsc --noEmit
  ```
  Result: Exited 0 with zero type errors.
