# Walkthrough 77: Phase 3 - Unified Sandbox Platform Extraction (`@acc/sandbox`)

## 1. Overview
Completed Phase 3 of `docs/brainstorming/integration_master_plan_iteration_1.md`:
- Extracted the Unified Sandbox engine into a dedicated workspace package: `packages/sandbox/` (`@acc/sandbox`).
- Implemented framework-agnostic core components:
  - `SandboxRegistry`: Thread-safe handler registry with priority ordering and URL/query context extraction.
  - `withSimulationDecorator`: Latency jitter and probabilistic fault injection simulator.
  - `SandboxStoreManager`: Lightweight state store with persona switching, tenant tracking, and feature toggles.
  - `UnifiedSandboxEngine`: Central coordinator dispatching requests against matched handlers.
  - `createSandboxFetch` & `attachGlobalSandboxFetch`: Universal fetch interceptors compatible with React Native (Expo), Next.js, and web browsers.
  - `attachSandboxAxiosInterceptor`: Axios adapter for client requests.
- Linked `@acc/sandbox` into `@acc/console` package dependencies with path aliasing in `tsconfig.app.json`.

## 2. Changes Summary
- `packages/sandbox/package.json`: Configured package with workspace dependency on `@acc/client`.
- `packages/sandbox/tsconfig.json`: Linked to `@acc/typescript-config/base.json`.
- `packages/sandbox/src/types.ts`: Sandbox core contracts.
- `packages/sandbox/src/registry.ts`: `SandboxRegistry` implementation.
- `packages/sandbox/src/simulation.ts`: Simulation decorator with fault injection and latency.
- `packages/sandbox/src/store.ts`: Standalone `SandboxStoreManager` and default personas.
- `packages/sandbox/src/engine.ts`: `UnifiedSandboxEngine` coordinator.
- `packages/sandbox/src/adapters/fetch-adapter.ts`: Universal fetch interceptor.
- `packages/sandbox/src/adapters/axios-adapter.ts`: Universal axios interceptor.
- `packages/sandbox/src/index.ts`: Barrel export.
- `packages/sandbox/src/__tests__/sandbox-engine.test.ts`: 5 unit tests covering priority routing, fetch interception, axios interception, and bypass fall-through.
- `apps/console/package.json` & `apps/console/tsconfig.app.json`: Added `@acc/sandbox` dependency and path alias.

## 3. Verification Results
- `pnpm --filter @acc/sandbox test`: 1 test file passed, 5/5 tests green.
- `pnpm --filter @acc/sandbox run check-types`: Clean with 0 errors.
- `pnpm --filter @acc/console exec tsc --noEmit`: Clean with 0 errors.
- `pnpm --filter @acc/console test`: 29 test files passed, 146/146 tests green.
- `pnpm --filter @acc/console exec vite build --mode web`: Clean production bundle built successfully.
