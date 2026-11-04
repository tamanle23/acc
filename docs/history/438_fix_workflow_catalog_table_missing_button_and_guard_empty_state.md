# 438: Fix Workflow Catalog Table Missing Button and Guard Empty State Action

## Problem
In `WorkflowCatalogTable` (`apps/console/src/features/workflows/components/catalog/workflow-catalog-table.tsx`), rendering the empty state ("No workflow definitions found") triggered a runtime error:
```
ReferenceError: Button is not defined
    at WorkflowCatalogTable (workflow-catalog-table.tsx:129:16)
```
In addition, `apps/console/src/components/ui/button.tsx` did not explicitly export `ButtonProps`, causing TypeScript type resolution errors when components (such as `AuthorizedButtonProps`) extended `ButtonProps`. Furthermore, the empty state "Create your first workflow" button was unguarded, bypassing the declarative authorization safeguard (`workflow:definition:manage`).

## Plan
1. Export `ButtonProps` explicitly from `apps/console/src/components/ui/button.tsx`.
2. Import `Button` in `workflow-catalog-table.tsx`.
3. Upgrade the empty state "Create your first workflow" button to use `AuthorizedButton` with `permission="workflow:definition:manage"`, ensuring consistent authorization guarding across both table header and empty-state views.
4. Clean up unused `useHasPermission` import in `workflow-catalog-table.tsx`.
5. Run vitest test suite across workflows and permission guards to verify zero regressions.

## Changes
- **`apps/console/src/components/ui/button.tsx`**: Exported `ButtonProps` type definition based on `React.ComponentProps<'button'>` and `VariantProps<typeof buttonVariants>`.
- **`apps/console/src/features/workflows/components/catalog/workflow-catalog-table.tsx`**:
  - Added import for `Button`.
  - Replaced unguarded empty-state `<Button>` with `<AuthorizedButton permission="workflow:definition:manage">`.
  - Pruned unused `useHasPermission` import.

## Verification
- Executed `pnpm --filter @acc/console test src/components/auth/__tests__/permission-guard.test.tsx`: 7/7 tests passed.
- Executed `pnpm --filter @acc/console test src/features/workflows`: 24 test files (110 tests) passed.

## Walkthrough
When users with or without workflow management permissions visit the workflow catalog when no definitions exist:
- Permitted users see the interactive "Create your first workflow" button.
- Unauthorized users see the button disabled with a tooltip explaining that `workflow:definition:manage` clearance is required, preventing unauthorized 401/403 workflow creation attempts and eliminating runtime `ReferenceError` crashes.

## Tasks
- [x] Fix missing `Button` reference in `workflow-catalog-table.tsx`.
- [x] Export `ButtonProps` from `apps/console/src/components/ui/button.tsx`.
- [x] Guard empty state CTA with `permission="workflow:definition:manage"`.
- [x] Verify tests pass across `@acc/console`.

## Enhancement
Consider lint rule or CI check to prevent referencing unimported JSX identifiers that might only trigger at runtime when specific branches (such as empty states) render.
