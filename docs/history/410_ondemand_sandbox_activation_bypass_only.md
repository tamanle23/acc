# 410 - On-Demand Unified Sandbox Activation via "Bypass with sandbox" & Workflow Simulation Consolidation

## Problem
Previously, in `@acc/console`, the Unified Sandbox was activated by default when starting Vite in DEV mode (`enabled: import.meta.env.DEV || false`). Even when running with the sandbox package present, developers needed real network requests to fall through cleanly to live backends without interceptors hijacking traffic, unless the user explicitly chose **"Bypass with sandbox"**. In addition, the workflow simulation engine and DAG blueprints were isolated in `apps/console` rather than the centralized `packages/sandbox`.

## Plan
1. Refactor and move workflow simulation files from `apps/console/src/features/workflows/sandbox/` into `packages/sandbox/src/simulation/`.
2. Configure initial default state for `enabled` to `false` in both `apps/console/src/core/sandbox/store/sandbox-store.ts` and `packages/sandbox/src/store.ts`.
3. Wire `clearTokens` in `useSpringAuthStore` to automatically set `enabled: false` upon logout / session termination.
4. Verify that logging in via "Bypass with sandbox" in `user-auth-form.tsx` activates the sandbox on-demand via `useSandboxStore.getState().setEnabled(true)`.

## Changes
- `packages/sandbox/src/simulation/simulation-scenarios.ts`: Transferred 4 execution traces (`HAPPY_PATH`, `FRAUD_REJECTED`, `PAYMENT_TIMEOUT`, `APPROVAL_ESCALATION`).
- `packages/sandbox/src/simulation/workflow-simulation-engine.ts`: Moved singleton `WorkflowSimulationEngine` and EventSource proxy.
- `packages/sandbox/src/simulation/simulation-blueprints.ts`: Moved `MULTI_BRANCH_ORDER_NODES` and `MULTI_BRANCH_ORDER_EDGES`.
- `packages/sandbox/src/index.ts`: Re-exported simulation scenarios, engine, and blueprints.
- `apps/console/src/features/workflows/sandbox/*`: Updated to thin re-exports from `@acc/sandbox`.
- `apps/console/src/core/sandbox/store/sandbox-store.ts`: Set `initialDefaultState.enabled: false`.
- `packages/sandbox/src/store.ts`: Set `initialDefaultSandboxState.enabled: false`.
- `apps/console/src/features/spring-auth/store.ts`: Wired `clearTokens` to disable sandbox on logout.

## Verification
- Unit tests:
  - `pnpm --filter @acc/console test:run src/features/auth/` (9/9 pass)
  - `pnpm --filter @acc/console test:run src/features/spring-auth/` (18/18 pass)
  - `pnpm --filter @acc/console test:run src/core/sandbox/__tests__/sandbox-dock.test.tsx` (6/6 pass)
  - `pnpm --filter @acc/console test:run src/core/sandbox/__tests__/sandbox-core.test.ts` (7/7 pass)
  - `pnpm --filter @acc/sandbox test src/simulation/__tests__/workflow-simulation.test.ts` (3/3 pass)
- TypeScript check:
  - `pnpm --filter @acc/console exec tsc --noEmit` (0 errors)

## Walkthrough & Tasks
- Companion app document: `apps/console/doc/walkthrough_163.md`
- Tasks: Successfully decoupled default sandbox activation, unified workflow simulation under `@acc/sandbox`, and ensured clean transparent fall-through for normal dev mode.
