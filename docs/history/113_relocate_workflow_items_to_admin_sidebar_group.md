# 113. Relocate Workflow Management Items to Admin Group in Sidebar

## Problem Statement
The user requested moving `/workflow-executions`, `/workflows`, and `/approvals` from the **Workspace** navigation group to the **Admin** navigation group in `apps/console/src/components/layout/data/sidebar-data.ts`.

## Implementation Plan
1. Update `sidebar-data.ts` to shift the three workflow items into the `Admin` nav group.
2. Verify type integrity and layout unit test suites.
3. Record history log and commit changes with Conventional Commits.

## Changes Made
- `apps/console/src/components/layout/data/sidebar-data.ts`:
  - Removed `Workflow Executions` (`/workflow-executions`), `Workflows` (`/workflows`), and `Task Approvals` (`/approvals`) from `sidebar.groups.workspace`.
  - Added them to `sidebar.groups.admin`.
- `apps/console/src/routeTree.gen.ts`: Synchronized TanStack router tree.
- `apps/console/doc/walkthrough_101.md`: Walkthrough artifact.

## Verification
- `pnpm --filter @unipost/console exec tsc --noEmit` passed clean with 0 errors.
- `pnpm --filter @unipost/console test src/components/layout/` passed 7/7 tests.
- `pnpm --filter @unipost/console test src/features/approvals/` passed 2/2 tests.
