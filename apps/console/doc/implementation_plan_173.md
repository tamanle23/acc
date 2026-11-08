# Console Implementation Plan - Iteration 173
# Dedicated Task Definitions Manager: Visual Schema Designer, Lifecycle Ledger & Studio Hub

## 1. Executive Summary
This implementation plan defines the frontend architecture and user interface for the **Dedicated Task Definitions Manager** in `apps/console`, fulfilling Iteration 76 (`master_implementation_plan_iteration_76.md`). It integrates a dedicated Task Definitions tab into the `/workflows` hub, provides an interactive Visual Schema & Policy Editor, an audit-grade Version History Drawer with schema diff capabilities, and in-canvas quick-actions in Visual DAG Studio.

---

## 2. File Signatures & Architecture

### 2.1 Directory Structure
All new components reside in `apps/console/src/features/workflows/components/task-definitions/`:
- `task-definition-kpi-bar.tsx`: Operational telemetry strip (Total, Active in Prod, Drafts, Schema Complexity).
- `task-definition-columns.tsx`: TanStack Table column definitions with Liquid Glass badges and action menus.
- `task-definition-table.tsx`: Data table with global filter, status facet pills, and pagination.
- `task-definition-editor-dialog.tsx`: Liquid Glass multi-tab modal/drawer for creating, editing, and publishing task definitions.
- `schema-property-grid.tsx`: Interactive visual builder for JSON Schema properties (`string`, `number`, `boolean`, `object`, `array`, `required`).
- `schema-test-sandbox.tsx`: Live payload validator tab where users test JSON against their designed schema.
- `schema-templates.ts`: Canonical templates ("Order Processing", "AI Prompt", "Webhook", "Simple KV").
- `task-version-history-drawer.tsx`: Side-over drawer with version timeline and side-by-side JSON diff.
- `index.ts`: Public barrel exports.

### 2.2 API Extension (`apps/console/src/features/workflows/api/task-definition-api.ts`)
Add `useDeleteTaskDefinitionDraft` mutation:
```typescript
export const useDeleteTaskDefinitionDraft = () => {
  const queryContext = useContext(QueryClientContext);
  const clientToUse = queryContext || fallbackQueryClient;

  return useMutation({
    mutationFn: async ({ name, version }: { name: string; version: number }) => {
      const res = await springApiClient.delete(`/v1/workflow/task-definitions/${name}/versions/${version}`);
      if (res.status === 200 || res.status === 204) return true;
      throw new Error(`Failed to delete draft: HTTP ${res.status}`);
    },
    onSuccess: (_, { name, version }) => {
      clientToUse.invalidateQueries({ queryKey: ['workflows', 'task-definitions'] });
      toast.success(`Deleted draft for ${name} v${version}`);
    },
    onError: (err: any) => {
      toast.error(`Failed to delete draft: ${err.message || err}`);
    }
  }, clientToUse);
};
```

---

## 3. Phased Implementation Roadmap

### Phase 1: Core Catalog Table & KPI Components
- Build `TaskDefinitionKpiBar` computing metrics over `TaskDefinitionRecord[]`.
- Build `createTaskDefinitionColumns` with status badges (`ACTIVE`, `DRAFT`, `DEPRECATED`), complexity chip, and action menu.
- Build `TaskDefinitionTable` wrapping `DataTable`, `DataTablePagination`, and `DataTableToolbar`.
- Export from `apps/console/src/features/workflows/components/task-definitions/index.ts`.

### Phase 2: Visual Schema & Policy Editor Dialog
- Build `SchemaPropertyGrid` for visual schema property editing (add/edit/delete fields, types, required flags).
- Build `schema-templates.ts` with quick-start templates.
- Build `SchemaTestSandbox` providing client-side validation against mock input JSON.
- Build `TaskDefinitionEditorDialog` orchestrating General policy, Input schema, Output schema, and Test sandbox tabs.

### Phase 3: Version History & Schema Diff Drawer
- Build `TaskVersionHistoryDrawer` querying `useTaskDefinitionVersions(taskName)`.
- Render version timeline cards with status pills, audit timestamps, author, and changelog notes.
- Integrate side-by-side schema diff between versions.
- Connect "Fork Draft" action to pre-populate `TaskDefinitionEditorDialog`.

### Phase 4: Hub Navigation & View Switcher Integration
- Update `apps/console/src/features/workflows/index.tsx`:
  - Extend view switcher: `Definitions Catalog` (Workflows) | `Task Definitions` | `Approvals Inbox`.
  - Render `TaskDefinitionKpiBar` and `TaskDefinitionTable` when active tab is `task-definitions`.
  - Wire Create, Edit, and History modal states.
- Update `ROUTE.md` section 3.11 with Task Definitions Manager specs.
- Synchronize `en` and `vi` translations.

### Phase 5: Studio Palette Quick-Launch Integration
- Update `apps/console/src/features/workflows/components/studio/palette/dag-palette.tsx`:
  - In "Task Definitions Catalog" category header, add `+ New Definition` button.
  - Wire click handler to open `TaskDefinitionEditorDialog`.
- Update `VisualDagStudio`:
  - Render `TaskDefinitionEditorDialog` when triggered from palette.
  - Refresh palette query on save.

### Phase 6: Automated Verification & Test Coverage
- Write `task-definition-table.test.tsx` verifying filtering, sorting, and action triggers.
- Write `task-definition-editor.test.tsx` verifying property grid to JSON Schema compilation and form submission.

---

## 4. Verification & Testing Commands
```bash
# Frontend component tests
pnpm --filter @acc/console test "task-definition"

# Full workflows studio tests
pnpm --filter @acc/console test "visual-dag-studio|dag-palette|task-contract"

# Sandbox offline parity
pnpm --filter @acc/sandbox test
```
