# Walkthrough 101: Relocate Workflow Management Items to Admin Group in Sidebar

## 1. Overview
In this task, we relocated `/workflow-executions`, `/workflows`, and `/approvals` from the **Workspace** navigation group to the **Admin** navigation group in `apps/console/src/components/layout/data/sidebar-data.ts`.

## 2. Changes Made
- In `sidebar-data.ts`:
  - Removed `Workflow Executions`, `Workflows`, and `Task Approvals` from the `Workspace` nav group items array.
  - Added them to the `Admin` nav group items array preceding `Users`, `Storage Providers`, and `Metadata`.
- Validated TanStack router tree generation (`routeTree.gen.ts`).

## 3. Verification
- `pnpm --filter @unipost/console exec tsc --noEmit`: Clean pass with 0 errors.
- `pnpm --filter @unipost/console test src/components/layout/`: Passed (7/7 tests).
- `pnpm --filter @unipost/console test src/features/approvals/`: Passed (2/2 tests).
