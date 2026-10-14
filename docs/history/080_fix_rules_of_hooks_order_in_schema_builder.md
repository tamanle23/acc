# History Log 080: Fix React Rules of Hooks Order in SchemaBuilder

## Problem Statement
React logged a runtime error in browser devtools:
`Error: Rendered more hooks than during the previous render. at useTenantBilling (use-billing.ts:77:26) at SchemaBuilder (schema-builder.tsx:83:29)`
This occurred because `useTenantBilling`, `useSpringAuthStore`, and `useSandboxStore` were declared below an `if (isLoading) return ...` early return guard.

## Plan
1. Move all hook declarations (`useTenantBilling`, `useSpringAuthStore`, `useSandboxStore`, `useMetadataUiStore`) to the top of `SchemaBuilder` before any early returns.
2. Run Vitest suite across metadata domain to confirm zero regressions.

## Changes Made
- [`schema-builder.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx): Restructured hook ordering to place all hooks before conditional `isLoading` check.
- [`walkthrough_84.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/doc/walkthrough_84.md): Created walkthrough documentation.

## Verification
- `pnpm --filter @unipost/console test src/features/metadata`: 9 test files passed, 55/55 tests passed.
