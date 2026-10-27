# 039: mobile-ui Sandbox Integration & Context Store (Integration Master Plan Phase 4)

## Problem
In accordance with `docs/brainstorming/integration_master_plan_iteration_1.md` (Phase 4) and `.agents/rules/02-unified-sandbox.md`, `apps/mobile-ui` maintained rogue hardcoded mock data in `src/constants/mockData.ts` and operated without tenant/workspace context awareness or integration with the Unified Sandbox Platform.

## Plan
1. Delete `apps/mobile-ui/src/constants/mockData.ts`.
2. Link `@acc/client` and `@acc/sandbox` workspace packages to `apps/mobile-ui`.
3. Create `useMobileContextStore` to manage `activeTenantId`, `activeWorkspaceId`, and `activePersonaId`.
4. Create `apps/mobile-ui/src/sandbox/mobile-sandbox.ts` to register the `mobilePostsSandboxHandler` and attach global fetch interception.
5. Refactor `apps/mobile-ui/src/store/usePostStore.ts` to fetch and mutate dynamic records through `AccClient` (`/v1/metadata/records?entityType=post`).
6. Add unit test suite `apps/mobile-ui/src/__tests__/mobile-sandbox.test.ts`.
7. Verify all test suites across `mobile-ui`, `@acc/client`, `@acc/sandbox`, and `@acc/console`.

## Changes
- `apps/mobile-ui/package.json`: Added `@acc/client`, `@acc/sandbox`, vitest, and test script.
- `apps/mobile-ui/tsconfig.json`: Added workspace path aliases.
- `apps/mobile-ui/src/constants/mockData.ts`: Deleted.
- `apps/mobile-ui/src/store/useMobileContextStore.ts`: Created context store.
- `apps/mobile-ui/src/sandbox/mobile-sandbox.ts`: Created sandbox handler with tenant partitioning and reset capability.
- `apps/mobile-ui/src/store/usePostStore.ts`: Refactored to use `createAccClient` and `useMobileContextStore`.
- `apps/mobile-ui/src/screens/DashboardScreen.tsx`: Added automatic fetch on mount when posts are empty.
- `apps/mobile-ui/App.tsx`: Initialized sandbox on application launch.
- `apps/mobile-ui/vitest.config.ts` & `apps/mobile-ui/src/test/setup.ts`: Configured Vitest setup and AsyncStorage mocking.
- `apps/mobile-ui/src/__tests__/mobile-sandbox.test.ts`: Added unit tests.
- `apps/mobile-ui/doc/implementation_plan_17.md` & `apps/mobile-ui/doc/walkthrough_17.md`: Artifacts generated.

## Verification
- `pnpm --filter mobile-ui test`: Passed (5/5 tests).
- `pnpm --filter @acc/client test`: Passed (6/6 tests).
- `pnpm --filter @acc/sandbox test`: Passed (5/5 tests).
- `pnpm --filter @acc/console test`: Passed (146/146 tests across 29 test files).
- Grep verified 0 occurrences of `mockData.ts` across `apps/mobile-ui`.

## Walkthrough
Refer to `apps/mobile-ui/doc/walkthrough_17.md`.

## Tasks
- [x] Delete mockData.ts
- [x] Implement useMobileContextStore
- [x] Implement mobile-sandbox handler and global fetch interceptor
- [x] Refactor usePostStore to AccClient
- [x] Unit test coverage and workspace verification

## Enhancement
Phase 5 will implement the `mobile-ui` Dynamic Form Engine & Media Pipeline (`DynamicFieldRenderer`, `MediaPickerInput`, `RelationPickerBottomSheet`).
