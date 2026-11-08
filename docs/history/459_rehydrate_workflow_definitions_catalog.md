# 459 - Rehydrate Workflow Definition Catalog from Persistence & Tenant Query Scoping

## Problem
When opening the **Workflow Definitions** screen (`/workflows`), the catalog displayed `"No workflow definitions found"` and appeared not to load any workflow definitions:
1. **Unrehydrated In-Memory Registry on Backend Restart**:
   - `WorkflowDefinitionRegistry.get(tenantId, workflowKey)` fell back to `PersistencePort.listDefinitionVersions(tenantId, workflowKey)` when the in-memory `tenantDefinitions` map was empty after a JVM restart.
   - Because `get(...)` found the previously persisted records in PostgreSQL/SQLite, `SandboxWorkflowSeeder` (`if (registry.get(tenantId, key).isEmpty())`) treated the sample workflows as already present and skipped calling `registry.register(tenantId, def)`.
   - Meanwhile, `WorkflowDefinitionRegistry.list(tenantId)` (invoked by `GET /api/v1/workflow/definitions`) only returned `tenantDefinitions.getOrDefault(tenantId, Map.of())` from memory without querying `PersistencePort`, returning `200 []` whenever the backend restarted over an already-seeded database.
2. **Stale Tenant-Unscoped React Query Cache**:
   - `useWorkflowDefinitions` in `apps/console/src/features/workflows/api/workflow-api.ts` used a static query key `['workflows', 'definitions']` with `staleTime: 60_000`. If the query ran once before authentication or tenant/sandbox switching, React Query served the cached `[]` for 60 seconds without firing a network request when opening the screen.
3. **Preflight Error Message Override**:
   - In `apps/console/src/features/spring-auth/api-client.ts`, the response error interceptor overwrote client-side `ERR_CLIENT_AUTH_PREFLIGHT` error messages with `extractEnvelopeErrorMessage(error.response.data)`.

## Plan
1. Add `listTenantDefinitionVersions(String tenantId)` to `PersistencePort` and implement it in `PostgresJdbcPersistenceAdapter`, `SqliteJdbcPersistenceAdapter`, and `InMemoryPersistenceAdapter`.
2. Update `WorkflowDefinitionRegistry.list(tenantId)` and `get(tenantId, workflowKey)` to rehydrate the in-memory `tenantDefinitions` map from `PersistencePort`.
3. Scope `useWorkflowDefinitions` query key by `[effectiveTenantId, sandboxEnabled]`, set `refetchOnMount: 'always'`, and support both raw array and `ResponseWrapper` (`res.data?.body`) envelopes.
4. Preserve `ERR_CLIENT_AUTH_PREFLIGHT` error messages in `springApiClient` response interceptor.
5. Add unit test `testRegistryListRehydrationAfterRestart` in `SandboxWorkflowSeederTest` and verify live HTTP `GET /api/v1/workflow/definitions`.

## Changes
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/ports/PersistencePort.java`: Added `listTenantDefinitionVersions(String tenantId)` default method.
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/PostgresJdbcPersistenceAdapter.java`: Implemented `listTenantDefinitionVersions` querying `workflow_definitions WHERE tenant_id = ? ORDER BY workflow_key ASC, version ASC`.
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/SqliteJdbcPersistenceAdapter.java`: Implemented `listTenantDefinitionVersions` for SQLite.
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/InMemoryPersistenceAdapter.java`: Implemented `listTenantDefinitionVersions` for in-memory storage.
- `apps/backend/workflow-engine/src/main/java/com/acc/workflow/application/WorkflowDefinitionRegistry.java`: Updated `list(tenantId)` and `get(tenantId, workflowKey)` to populate and merge latest versions from `PersistencePort` into `tenantDefinitions`.
- `apps/backend/acc-sandbox/src/test/java/com/acc/sandbox/seed/SandboxWorkflowSeederTest.java`: Added `testRegistryListRehydrationAfterRestart` verifying catalog rehydration across JVM restarts.
- `apps/console/src/features/workflows/api/workflow-api.ts`: Scoped `useWorkflowDefinitions` `queryKey` by active tenant & sandbox state and added `refetchOnMount: 'always'`.
- `apps/console/src/features/spring-auth/api-client.ts`: Guarded `ERR_CLIENT_AUTH_PREFLIGHT` from envelope message override.

## Verification
- **Backend Unit Tests**: `SandboxWorkflowSeederTest` (4/4 tests passed, exit code 0).
- **Frontend Unit Tests**: `api-client-preflight.test.ts` (6/6 tests passed, exit code 0).
- **Live End-to-End Endpoint Check**: Restarted `@acc/backend` (`dev:sandbox` on port `8080`) and verified `GET /api/v1/workflow/definitions` directly (`http://127.0.0.1:8080`) and through the Vite proxy (`http://localhost:5173`), returning all 4 persisted workflow definitions (`demo-wf`, `testworkflow`, `order-fulfillment-pipeline`, `order-fulfillment-v1`).

## Walkthrough
1. Start backend with `pnpm --filter @acc/backend dev:sandbox` and console with `pnpm --filter @acc/console dev:sandbox`.
2. Sign in or bypass with sandbox (`admin@acc.io` / `tenant-acme`) and open `/workflows`.
3. `useWorkflowDefinitions` dispatches `GET /api/v1/workflow/definitions`, which rehydrates persisted definitions from `workflow_definitions` and renders the catalog table.

## Tasks
- [x] Add `listTenantDefinitionVersions` to `PersistencePort` and storage adapters
- [x] Rehydrate `WorkflowDefinitionRegistry.list(tenantId)` from `PersistencePort`
- [x] Scope `useWorkflowDefinitions` query key by tenant and sandbox state
- [x] Verify with unit tests and live HTTP requests

## Enhancement
- Consider adding a dedicated database index on `(tenant_id, workflow_key, version DESC)` using `DISTINCT ON (workflow_key)` in PostgreSQL if version history per workflow grows large.
