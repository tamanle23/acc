# 036: Console HTTP Client Hardening & Context Injection (Integration Master Plan Phase 1)

## Problem
In accordance with `docs/brainstorming/integration_master_plan_iteration_1.md` (Phase 1), `apps/console/src/features/metadata/api/use-blueprints.ts` was still utilizing raw global `axios` calls directly to `/api/v1/metadata/blueprints`. Furthermore, the central `springApiClient` request interceptor only injected `X-Tenant-Id` when in `X-Assumed-Tenant` impersonation mode, failing to inject tenant and workspace context (`X-Tenant-Id`, `X-Workspace-Id`) from `useMetadataUiStore` during normal tenant sessions.

## Plan
1. Refactor `use-blueprints.ts` to utilize `springApiClient` with normalized endpoints (`/v1/metadata/...`) and standardized unwrapping (`res.data?.body ?? res.data?.data ?? res.data`).
2. Update `springApiClient` in `apps/console/src/features/spring-auth/api-client.ts` to read `useMetadataUiStore.getState()` and populate `X-Tenant-Id` and `X-Workspace-Id` headers when not already specified or in assumed mode.
3. Add automated test suite `apps/console/src/features/spring-auth/__tests__/api-client-context.test.ts`.
4. Verify with TypeScript compile check and Vitest test runner.

## Changes
- `apps/console/src/features/spring-auth/api-client.ts`: Injected `X-Tenant-Id` and `X-Workspace-Id` from `useMetadataUiStore.getState()`.
- `apps/console/src/features/metadata/api/use-blueprints.ts`: Swapped `axios` with `springApiClient` and normalized response unwrapping.
- `apps/console/src/features/spring-auth/__tests__/api-client-context.test.ts`: Created unit tests covering context header injection.
- `apps/console/doc/implementation_plan_75.md` & `apps/console/doc/walkthrough_75.md`: Documented paired plan and walkthrough.

## Verification
- `pnpm --filter @unipost/console exec tsc --noEmit`: Exited 0 with 0 errors.
- `pnpm --filter @unipost/console test`: 29 test files passed, 146/146 tests passed.
- Grep verified 0 occurrences of `from 'axios'` in `apps/console/src/features/metadata/api/`.

## Walkthrough
Refer to `apps/console/doc/walkthrough_75.md`.

## Tasks
- [x] Phase 1 Console HTTP client hardening
- [x] Context header injection in springApiClient
- [x] Comprehensive test suite for context injection
- [x] Clean zero-regression vitest execution

## Enhancement
Phase 2 will extract the typed DTOs and HTTP client into a shared monorepo package `packages/client`.
