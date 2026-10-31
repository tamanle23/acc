# Walkthrough 163 - On-Demand Unified Sandbox Activation via Bypass Action

## Overview
Configured the `@acc/console` and `@acc/sandbox` state management so that the **Unified Sandbox** is not activated by default when starting in development mode. Instead, real backend API requests flow transparently unless the user explicitly logs in with **"Bypass with sandbox"**.

## Key Changes

### 1. Default State Configuration
- In `apps/console/src/core/sandbox/store/sandbox-store.ts`, updated `initialDefaultState.enabled` to default to `false` instead of `import.meta.env.DEV || false`.
- In `packages/sandbox/src/store.ts`, updated `initialDefaultSandboxState.enabled` to default to `false`.

### 2. On-Demand Activation & Clean Deactivation
- **Activation**: When a user selects any persona under **"Bypass with Sandbox..."** in `apps/console/src/features/auth/sign-in/components/user-auth-form.tsx`, `handleSandboxBypass(personaId)` calls `useSandboxStore.getState().setEnabled(true)` and `setActivePersona(personaId)`.
- **Deactivation**: In `apps/console/src/features/spring-auth/store.ts`, `clearTokens()` explicitly deactivates the sandbox via `useSandboxStore.getState().setEnabled(false)`, ensuring a clean transition when switching back to genuine credentials.

### 3. Workflow Simulation Migration to `@acc/sandbox`
- Refactored `simulation-scenarios.ts`, `workflow-simulation-engine.ts`, and `simulation-blueprints.ts` from `apps/console/src/features/workflows/sandbox/` into `packages/sandbox/src/simulation/`.
- Consolidated re-exports in `packages/sandbox/src/index.ts` and `apps/console/src/features/workflows/sandbox/`.

## Verification Results
- `pnpm --filter @acc/console test:run src/features/auth/` (9/9 tests pass)
- `pnpm --filter @acc/console test:run src/features/spring-auth/` (18/18 tests pass)
- `pnpm --filter @acc/console test:run src/core/sandbox/__tests__/sandbox-core.test.ts src/core/sandbox/__tests__/sandbox-dock.test.tsx src/core/sandbox/__tests__/axios-sandbox-adapter.test.ts src/core/sandbox/__tests__/fetch-sandbox-adapter.test.ts` (21/21 tests pass)
- `pnpm --filter @acc/sandbox test src/simulation/__tests__/workflow-simulation.test.ts` (3/3 tests pass)
- `pnpm --filter @acc/console exec tsc --noEmit` (0 errors)
