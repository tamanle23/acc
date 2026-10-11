# 038: Unified Sandbox Platform Extraction (@unipost/sandbox) (Integration Master Plan Phase 3)

## Problem
In accordance with `docs/brainstorming/integration_master_plan_iteration_1.md` (Phase 3), the Unified Sandbox Platform was locked within `apps/console/src/core/sandbox/`, making it impossible for `mobile-ui` and `tekgo-ui` to share mock personas, rate limits, fault injection, and deterministic endpoints without duplicating logic.

## Plan
1. Create `packages/sandbox` workspace package depending on `@unipost/client` and `@unipost/typescript-config`.
2. Extract the core engine: `SandboxRegistry`, `withSimulationDecorator`, `SandboxStoreManager`, `UnifiedSandboxEngine`, `createSandboxFetch`, and `attachSandboxAxiosInterceptor`.
3. Add unit tests for fetch/axios interception, persona routing, and error fault simulation in `packages/sandbox/src/__tests__/sandbox-engine.test.ts`.
4. Link `@unipost/sandbox` into `@unipost/console` package dependencies with path alias support.
5. Verify test suites and production build across monorepo workspace.

## Changes
- `packages/sandbox/package.json`: Workspace definition for `@unipost/sandbox`.
- `packages/sandbox/tsconfig.json`: TypeScript configuration.
- `packages/sandbox/src/types.ts`: Centralized sandbox types and persona definitions.
- `packages/sandbox/src/registry.ts`: Handler registry and URL context parser.
- `packages/sandbox/src/simulation.ts`: Simulation decorator with fault injection and latency.
- `packages/sandbox/src/store.ts`: Standalone store manager with listeners.
- `packages/sandbox/src/engine.ts`: Core engine orchestrating handler matches and simulations.
- `packages/sandbox/src/adapters/fetch-adapter.ts`: Cross-platform fetch interceptor.
- `packages/sandbox/src/adapters/axios-adapter.ts`: Axios request interceptor.
- `packages/sandbox/src/index.ts`: Barrel export.
- `packages/sandbox/src/__tests__/sandbox-engine.test.ts`: Unit test suite.
- `apps/console/package.json` & `apps/console/tsconfig.app.json`: Added `@unipost/sandbox` dependency and alias.
- `apps/console/doc/implementation_plan_77.md` & `apps/console/doc/walkthrough_77.md`: Paired artifacts documented.

## Verification
- `pnpm --filter @unipost/sandbox test`: Passed (5/5 tests).
- `pnpm --filter @unipost/sandbox run check-types`: Passed with 0 errors.
- `pnpm --filter @unipost/console exec tsc --noEmit`: Clean with 0 errors.
- `pnpm --filter @unipost/console exec vite build --mode web`: Clean production build.
- `pnpm --filter @unipost/console test`: 29 test files passed (146/146 tests green).

## Walkthrough
Refer to `apps/console/doc/walkthrough_77.md`.

## Tasks
- [x] Create packages/sandbox
- [x] Implement core registry, simulation, and fetch/axios adapters
- [x] Link to @unipost/console
- [x] Verify tests and production bundle

## Enhancement
Phase 4 will integrate `@unipost/sandbox` and `@unipost/client` into `mobile-ui`, purging legacy mock data and creating `useMobileContextStore`.
