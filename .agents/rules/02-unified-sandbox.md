---
trigger: always_on
description: Unified Sandbox Platform integration rules for mock engines, handlers, and offline parity.
---

# UNIFIED SANDBOX PLATFORM MANDATE

All mock engines, simulated stores, stubs, and auth bypasses across monorepo clients MUST integrate with the Unified Sandbox Platform (`apps/console/src/core/sandbox/`).

## Architectural Constraints
- **Zero Ad-Hoc Mocks**: No hardcoded mock data in UI components/views/modals. No independent axios/fetch mock interceptors.
- **Offline Parity**: Every new screen, route, or interactive feature MUST provide sandbox route handlers and seed data in `packages/sandbox/src/handlers/`. Offline dev mode must function with zero blank screens.
- **Dev-Only Guarding**: Strictly strip sandbox in production:
  - Guard UI & interceptors: `if (!import.meta.env.DEV) return null;` / `return config;`.
  - Respect flags: `VITE_ENABLE_SANDBOX === 'false'` or `pnpm dev:no-sandbox`.
- **Transparent Fall-Through**: Unhandled requests return `null`/pass-through to allow live backend traffic seamlessly. Preserve existing singleton contracts.

## Handler Implementation & Registration
1. **Contract**: Implement `SandboxRouteHandler` (`id`, `name`, `matcher`, `handler`, `priority?`) in `apps/console/src/core/sandbox/handlers/<domain>-sandbox-handler.ts`.
2. **Registration**: Register via `sandboxRegistry.register(...)` in `apps/console/src/core/sandbox/index.ts`.
3. **Tenant & Persona**: Query active tenant via `useSandboxStore.getState().activeTenantId`. Partition datasets by tenant. Support fleet-wide sovereign `SYSTEM` views where applicable.
4. **Stateful Reset**: Expose `reset()` on all stateful mock repositories and register with `sandboxResetRegistry` (wired to master `SandboxDock`).
5. **Diagnostics**: Provide edge-case simulation triggers in `SandboxDock`.
