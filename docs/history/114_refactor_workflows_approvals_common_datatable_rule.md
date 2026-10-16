# 114. Refactor Workflows & Approvals to Shared DataTable & Codify Common Component Priority Rule

## Problem Statement
The user requested refactoring `/workflows` and `/approvals` to use the shared `DataTable` component instead of maintaining custom boilerplate `<table>` implementations, and adding an agent rule to strictly enforce prioritizing existing common components before writing bespoke boilerplate code.

## Implementation Plan
1. Follow Rule Management SOP:
   - Author Section 11 in `docs/master_rules_reference.md` ("Common Component Reuse & Anti-Boilerplate Mandate").
   - Distill into `COMMON-COMPONENT-PRIORITY` rule in `.agents/rules/00-generic-common.md`.
2. Refactor `/workflows`:
   - Create `workflow-catalog-columns.tsx` implementing `ColumnDef<WorkflowDefinitionSummary>[]`.
   - Update `workflow-catalog-table.tsx` to use `useReactTable`, `DataTable`, `DataTableToolbar`, and `DataTablePagination`.
3. Refactor `/approvals`:
   - Create `approval-columns.tsx` implementing `ColumnDef<ApprovalTask>[]`.
   - Update `approval-table.tsx` to use `DataTable`, `DataTableToolbar`, and `DataTablePagination`.
   - Remove redundant custom search input and unused state from `approvals/index.tsx`.
4. Verify typecheck and Vitest test suites.
5. Create walkthrough and record history entry.

## Changes Made
- `docs/master_rules_reference.md`: Added Section 11 on Common Component Reuse.
- `.agents/rules/00-generic-common.md`: Added `COMMON-COMPONENT-PRIORITY` rule.
- `apps/console/src/features/workflows/components/workflow-catalog-columns.tsx`: Created column definitions.
- `apps/console/src/features/workflows/components/workflow-catalog-table.tsx`: Replaced raw table with `DataTable` primitives.
- `apps/console/src/features/approvals/components/approval-columns.tsx`: Created column definitions.
- `apps/console/src/features/approvals/components/approval-table.tsx`: Replaced raw table with `DataTable` primitives.
- `apps/console/src/features/approvals/index.tsx`: Cleaned redundant search bar and simplified displayed tasks list.
- `apps/console/src/features/spring-auth/__tests__/api-client-context.test.ts`: Added activeTenantId reset in `useSandboxStore` for clean test isolation.
- `apps/console/doc/walkthrough_102.md`: Walkthrough artifact.

## Verification
- `pnpm --filter @unipost/console exec tsc --noEmit` passed clean with 0 errors.
- Vitest suites for `src/features/workflows/` (2 tests), `src/features/approvals/` (2 tests), and `src/features/spring-auth/` (3 tests) all passed 100% green.
