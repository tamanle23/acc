# Implementation Plan 75: Phase 1 - @unipost/console HTTP Hardening & Context Injection

## 1. Overview
In accordance with `docs/brainstorming/integration_master_plan_iteration_1.md` (Phase 1), `@unipost/console` requires HTTP client hardening and context header injection:
1. Eliminate raw global `axios` calls in `features/metadata/api/use-blueprints.ts`.
2. Standardize all API calls to route through `springApiClient` (which already has authorization interceptors, silent refresh queues, and sandbox interceptors).
3. Enhance `springApiClient` request interceptor to dynamically inject:
   - `X-Tenant-Id`: defaults to `assumedTenant` if present, else active tenant from `useMetadataUiStore.getState().activeTenantId`.
   - `X-Workspace-Id`: active workspace from `useMetadataUiStore.getState().activeWorkspaceId`.
4. Ensure unwrap helper consistency: `data?.body ?? data?.data ?? data`.

## 2. Target Files
- `apps/console/src/features/spring-auth/api-client.ts`: Update request interceptor to inject `X-Tenant-Id` and `X-Workspace-Id`.
- `apps/console/src/features/metadata/api/use-blueprints.ts`: Replace raw `axios` with `springApiClient`, normalize `/v1/metadata/blueprints` endpoints and unwrap responses.
- `apps/console/src/features/spring-auth/__tests__/api-client-context.test.ts`: Create test suite verifying context header injection in `springApiClient`.

## 3. Verification Plan
- Zero occurrences of `import axios from 'axios'` in `apps/console/src/features/metadata/api/`.
- `pnpm --filter @unipost/console exec tsc --noEmit` exits with 0.
- `pnpm --filter @unipost/console test` passes 100%.
