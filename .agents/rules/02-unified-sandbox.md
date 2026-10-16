---
trigger: always_on
description: Mandatory rule requiring all mock engines and test data to integrate with the Unified Sandbox Platform.
---

# UNIFIED SANDBOX PLATFORM INTEGRATION MANDATE

All mock engines, simulated data stores, stub endpoints, and authentication bypasses across `@unipost/console` and monorepo client applications **MUST strictly incorporate with the Unified Sandbox Platform** (`apps/console/src/core/sandbox/`).

### 1. Prohibition of Isolated / Ad-Hoc Mocks
- **No Rogue In-Component Mocks**: Developers and AI agents MUST NOT embed hardcoded mock data directly inside UI components, views, or modals.
- **No Independent Axios/Fetch Mocks**: Standalone request interceptors checking custom ad-hoc headers or hardcoding fake status codes outside the Unified Sandbox are strictly prohibited.

### 2. Mandatory Handler Registration Pattern
Whenever a new mock domain (e.g. Billing, Notifications, Analytics) is introduced:
1. **Implement `SandboxRouteHandler`**:
   - The handler must implement the `SandboxRouteHandler` contract (`id`, `name`, `matcher`, `handler`, `priority?`).
   - Handler location: `apps/console/src/core/sandbox/handlers/<domain>-sandbox-handler.ts`.
2. **Register in `SandboxRegistry`**:
   - Register the handler into `sandboxRegistry.register(...)` in `apps/console/src/core/sandbox/index.ts`.
3. **Respect Central Persona & Tenant Context**:
   - Handlers must retrieve the active tenant via `useSandboxStore.getState().activeTenantId`.
   - Mock datasets must partition and filter by the active tenant ID.
4. **Support Stateful In-Memory Reset**:
   - All stateful mock repositories must expose a `reset()` method wired to the master `SandboxDock` reset event (`handleResetAllData`).

### 3. Strict Non-Breaking Backward Compatibility
- Introducing a new sandbox handler or repository **MUST NEVER break existing handlers or real network APIs**.
- **Transparent Fall-Through**: Handlers must return `null` or unhandled status to allow unmocked endpoints to proceed to the real live backend seamlessly.
- Existing tests and production singletons must maintain unchanged interfaces.

### 4. Development-Only Environment Enforcement
- All sandbox engines, adapters, and UI components **MUST strictly be disabled in production builds**:
  - Guard UI components and interceptors with `if (!import.meta.env.DEV) return null;` / `return config;`.
  - Respect CLI/env flags: `VITE_ENABLE_SANDBOX === 'false'` or `pnpm dev:no-sandbox`.

### 5. Mandatory Sandbox Synchronization for New Screens & Features
- **Zero Blank Screens in Offline Mode**: Every new screen, route, or interactive feature MUST have matching sandbox route handlers and seed data in `packages/sandbox/src/handlers/`.
- **Fleet & Persona Scope**: Handlers MUST support active tenant switching and Sovereign `SYSTEM` fleet-wide aggregation where applicable.
- **Reset Registration**: Repositories MUST register `reset()` with `sandboxResetRegistry`.
- **Diagnostic Utilities**: Features with edge-case failure modes MUST expose simulation triggers in `SandboxDock`.
