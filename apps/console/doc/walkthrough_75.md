# Walkthrough 75: Phase 1 - @acc/console HTTP Hardening & Context Injection

## 1. Overview
Completed Phase 1 of `docs/brainstorming/integration_master_plan_iteration_1.md`:
- Eliminated rogue global `axios` imports from `apps/console/src/features/metadata/api/`.
- Routed `use-blueprints.ts` through `springApiClient` with normalized response unwrapping (`res.data?.body ?? res.data?.data ?? res.data`).
- Enriched `springApiClient` request interceptor to automatically inject `X-Tenant-Id` and `X-Workspace-Id` from active `useMetadataUiStore` context while respecting sovereign root / assumed tenant overrides.
- Verified test coverage with a new test suite in `api-client-context.test.ts`.

## 2. Changes Summary
- `apps/console/src/features/metadata/api/use-blueprints.ts`:
  - Replaced `axios` with `springApiClient`.
  - Updated catalog endpoint `/api/v1/metadata/blueprints` to `/v1/metadata/blueprints`.
  - Updated blueprint details endpoint `/api/v1/metadata/blueprints/{id}` to `/v1/metadata/blueprints/{id}`.
  - Updated provisioning endpoint `/api/v1/metadata/tenants/provision` to `/v1/metadata/tenants/provision`.
- `apps/console/src/features/spring-auth/api-client.ts`:
  - Added request interceptor fallback extracting `activeTenantId` and `activeWorkspaceId` from `useMetadataUiStore.getState()`.
  - Preserved priority for `X-Assumed-Tenant` when in assumed mode.
- `apps/console/src/features/spring-auth/__tests__/api-client-context.test.ts`:
  - Added unit tests verifying active tenant and workspace header injection, plus assumed tenant priority.

## 3. Verification Results
- `pnpm --filter @acc/console exec tsc --noEmit`: Exited with code 0.
- `pnpm --filter @acc/console test`: 29 test files passed, 146/146 tests green.
- Grep check for `from 'axios'` in `apps/console/src/features/metadata/api`: 0 occurrences.
