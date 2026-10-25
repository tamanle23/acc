# Implementation Plan 77: Phase 3 - Unified Sandbox Platform Extraction (`@acc/sandbox`)

## 1. Overview
In accordance with `docs/brainstorming/integration_master_plan_iteration_1.md` (Phase 3), extract the Unified Sandbox engine into a reusable workspace package: `packages/sandbox` (`@acc/sandbox`).

## 2. Architecture & Design
1. **Package Configuration (`packages/sandbox`)**:
   - `packages/sandbox/package.json`: Workspace package depending on `@acc/client` and `@acc/typescript-config`.
   - `packages/sandbox/tsconfig.json`: Extends `@acc/typescript-config/base.json`.
2. **Core Sandbox Engine**:
   - `types.ts`: `SandboxRequest`, `SandboxResponse`, `SandboxRouteMatcherContext`, `SandboxRouteMatcher`, `SandboxRouteHandler`, `SandboxRouteHandlerFn`, `SandboxPersona`, `SandboxPersonaId`, `NetworkSimulationConfig`, `SandboxState`.
   - `registry.ts`: `SandboxRegistry` singleton with registration, unregistration, sorting by priority, URL parsing, and route matching.
   - `simulation.ts`: `withSimulationDecorator`, `sleep`, simulated latency jitter, and probabilistic fault injection.
   - `store.ts`: Framework-agnostic in-memory sandbox state store with listener support (or lightweight state container) and default personas (`system`, `admin`, `creator`, `user`, `custom`).
   - `engine.ts`: `UnifiedSandboxEngine` orchestrating request interception and dispatching against registered handlers.
   - `adapters/fetch-adapter.ts`: Universal `attachSandboxFetchInterceptor(fetchFn, engine)` and fetch wrapper for multi-client runtime (Expo React Native, Next.js, and Browser).
   - `adapters/axios-adapter.ts`: `attachSandboxAxiosInterceptor(axiosInstance, engine)` for Axios clients.
   - `index.ts`: Public API export.
3. **Console Integration**:
   - Link `@acc/sandbox` into `apps/console/package.json`.
   - Update `apps/console/tsconfig.app.json` with `@acc/sandbox` alias.
   - In `apps/console/src/core/sandbox/`: Retain existing console-specific stores and UI (`sandbox-dock.tsx`, handlers) while re-exporting and delegating core registry, simulation, and adapter logic to `@acc/sandbox`.
4. **Verification**:
   - Unit tests in `packages/sandbox/src/__tests__/sandbox-engine.test.ts`.
   - Full Vitest test suite run across `@acc/sandbox` and `@acc/console`.
   - `tsc --noEmit` and production build validation.
