# Walkthrough 102: Refactor Workflows & Approvals to Shared DataTable & Enforce Common Component Reuse Rule

## 1. Overview
In this task, we:
1. Eliminated custom boilerplate table implementations in `/workflows` and `/approvals` by refactoring them to use the centralized `@/components/data-table` primitives (`DataTable`, `DataTableToolbar`, `DataTablePagination`, `DataTableColumnHeader`).
2. Codified the **Common Component Reuse & Anti-Boilerplate Mandate** into the project's agent rules system in compliance with the Rule Management SOP.

## 2. Key Changes Made

### 2.1 Workflow Catalog Refactoring (`apps/console/src/features/workflows`)
- Extracted column definitions into [`workflow-catalog-columns.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/workflow-catalog-columns.tsx) using TanStack `ColumnDef<WorkflowDefinitionSummary>[]` and `DataTableColumnHeader`.
- Refactored [`workflow-catalog-table.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/workflow-catalog-table.tsx) to leverage `useReactTable`, `DataTableToolbar` with faceted status filtering, and `DataTablePagination`.

### 2.2 Approvals Inbox Refactoring (`apps/console/src/features/approvals`)
- Extracted column definitions into [`approval-columns.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/approvals/components/approval-columns.tsx) with dynamic SLA countdown badges, claim/unclaim toggles, and review triggers.
- Refactored [`approval-table.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/approvals/components/approval-table.tsx) to use `DataTable`, `DataTableToolbar` with role filtering, and `DataTablePagination`.
- Cleaned up redundant search input and unused state in [`index.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/approvals/index.tsx).

### 2.3 Agent Rule Management SOP Compliance
- **Master Reference (`docs/master_rules_reference.md`)**:
  - Authored **Section 11: Common Component Reuse & Anti-Boilerplate Mandate** specifying mandatory discovery, `DataTable` priority, separation of column concerns, and anti-boilerplate constraints.
- **Active Rule Distillation (`.agents/rules/00-generic-common.md`)**:
  - Appended **`COMMON-COMPONENT-PRIORITY`** constraint instructing agents to inspect and prioritize shared components before writing bespoke table, search, or pagination boilerplate.

## 3. Verification
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
- `pnpm --filter @acc/console test src/features/workflows/`: 2/2 tests passed.
- `pnpm --filter @acc/console test src/features/approvals/`: 2/2 tests passed.
- `pnpm --filter @acc/console test src/features/spring-auth/__tests__/api-client-context.test.ts`: 3/3 tests passed.
