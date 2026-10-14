# History Log 081: Decouple UI Components from Sandbox Store via `usePermissions`

## Problem Statement
Multiple production metadata components (`schema-builder.tsx`, `entity-type-sidebar.tsx`, `attribute-card.tsx`, `feature-gate.tsx`, `use-metadata-ui-store.ts`) had direct dependencies on `useSandboxStore`, violating the Unified Sandbox Mandate and creating dual sources of truth for authorization.

## Plan
1. Create standard `usePermissions()` hook in `@/features/spring-auth/hooks/use-permissions.ts` reading exclusively from `useSpringAuthStore`.
2. Refactor metadata components to consume `usePermissions()` and remove all imports of `useSandboxStore`.
3. Decouple `use-metadata-ui-store.ts` from `useSandboxStore`.
4. Run test suite to verify 100% test pass rate.

## Changes Made
- [`use-permissions.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/spring-auth/hooks/use-permissions.ts): Created centralized permissions hook reading user JWT credentials and tenant context.
- [`schema-builder.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx): Removed `useSandboxStore` and `useSpringAuthStore`, using `usePermissions()`.
- [`entity-type-sidebar.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx): Removed `useSandboxStore`, using `usePermissions()`.
- [`attribute-card.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/schema-builder/attribute-card.tsx): Removed `useSandboxStore`, using `usePermissions()`.
- [`feature-gate.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/billing/feature-gate.tsx): Removed `useSandboxStore`, using `usePermissions()`.
- [`use-metadata-ui-store.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/store/use-metadata-ui-store.ts): Decoupled from `useSandboxStore`.
- [`walkthrough_85.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/doc/walkthrough_85.md): Created walkthrough documentation.

## Verification
- `pnpm --filter @unipost/console test src/features/metadata`: 9 test files passed, 55/55 tests passed.
- Zero references to `useSandboxStore` remain across metadata production UI components.
