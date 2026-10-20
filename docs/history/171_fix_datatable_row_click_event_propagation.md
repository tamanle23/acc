# History Log 171 — Fix DataTable Row-Click Event Propagation on Action Controls

## Problem Statement
When clicking the record action dropdown button (`...` / `MoreHorizontal`) or interactive controls within a row in `/workflow-executions`, the newly introduced master-detail `WorkflowExecutionDetailDrawer` was inadvertently opened because the click event bubbled up to `TableRow.onClick`.

## Plan & Fix
1. **`apps/console/src/components/data-table/data-table.tsx`**:
   - Enhanced `TableRow.onClick` handler to check `e.target` against interactive element selectors (`button`, `a`, `input`, `[role="menuitem"]`, `[role="checkbox"]`, `[data-slot="dropdown-menu-trigger"]`, `[data-slot="dropdown-menu-content"]`, and `td[data-action="true"]`). If the click originates inside any of these elements, `onRowClick` is cleanly bypassed.
   - Tagged action cells with `data-action="true"` and added `onClick={(e) => e.stopPropagation()}` on the action `TableCell`.
2. **`apps/console/src/features/workflow-executions/components/data-table-row-actions.tsx`**:
   - Added explicit `onClick={(e) => e.stopPropagation()}` on the action trigger button to prevent click bubbling.

## Verification
- `pnpm --filter @unipost/console exec tsc --noEmit` exited `0`.
- `pnpm --filter @unipost/console test:run` passed 100% across all 73 test suites (338 tests passing).
