# Walkthrough 17: Phase 4 - mobile-ui Sandbox Integration & Context Store

## 1. Overview
Completed Phase 4 of `docs/brainstorming/integration_master_plan_iteration_1.md`:
- Purged legacy hardcoded mock dataset `apps/mobile-ui/src/constants/mockData.ts`.
- Integrated `@acc/client` and `@acc/sandbox` into `apps/mobile-ui`.
- Created `useMobileContextStore` in `apps/mobile-ui/src/store/useMobileContextStore.ts` tracking active tenant, active workspace, active persona, and auth tokens synchronized with `defaultSandboxStore`.
- Implemented `apps/mobile-ui/src/sandbox/mobile-sandbox.ts` providing deterministic in-memory posts partitioned by tenant, registering `mobilePostsSandboxHandler` into `sandboxRegistry`, and attaching global fetch interception.
- Refactored `usePostStore` in `apps/mobile-ui/src/store/usePostStore.ts` to query `/v1/metadata/records?entityType=post` using `AccClient` with stateful `resetPosts` pulling from Sandbox.
- Attached sandbox initialization to `App.tsx`.

## 2. Changes Summary
- `apps/mobile-ui/package.json`: Linked `@acc/client` and `@acc/sandbox` workspace packages; added `vitest` devDependency and `"test": "vitest run"`.
- `apps/mobile-ui/tsconfig.json`: Added path aliases for `@acc/client` and `@acc/sandbox`.
- `apps/mobile-ui/src/constants/mockData.ts`: Deleted.
- `apps/mobile-ui/src/store/useMobileContextStore.ts`: Implemented context store.
- `apps/mobile-ui/src/sandbox/mobile-sandbox.ts`: Implemented sandbox handler and initializer.
- `apps/mobile-ui/src/store/usePostStore.ts`: Refactored to use `createAccClient` and `useMobileContextStore`.
- `apps/mobile-ui/src/screens/DashboardScreen.tsx`: Added `useEffect` fetch trigger on empty state.
- `apps/mobile-ui/App.tsx`: Initialized `initMobileSandbox()`.
- `apps/mobile-ui/vitest.config.ts` & `apps/mobile-ui/src/test/setup.ts`: Configured Vitest and AsyncStorage mocks.
- `apps/mobile-ui/src/__tests__/mobile-sandbox.test.ts`: Created 5 unit tests.

## 3. Verification Results
- `pnpm --filter mobile-ui test`: 1 test file passed, 5/5 tests green.
- `pnpm --filter @acc/client test`: 6/6 tests green.
- `pnpm --filter @acc/sandbox test`: 5/5 tests green.
- `pnpm --filter @acc/console test`: 29 test files passed, 146/146 tests green.
- Grep verified: 0 occurrences of `mockData.ts` across `apps/mobile-ui/`.
