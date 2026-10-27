# 037: Universal Client SDK (@acc/client) Extraction (Integration Master Plan Phase 2)

## Problem
In accordance with `docs/brainstorming/integration_master_plan_iteration_1.md` (Phase 2), domain DTOs, query contracts, and HTTP interaction patterns were trapped inside `@acc/console`, preventing code reuse by upcoming mobile (`mobile-ui`) and headless CMS (`tekgo-ui`) clients.

## Plan
1. Create `packages/client` workspace package with standard `fetch` implementation (`AccClient`).
2. Migrate all core domain interfaces, blueprint DTOs, billing structures, and RFC 7807 problem details to `packages/client/src/types.ts`.
3. Equip `AccClient` with automated W3C `traceparent` generation, context header resolution (`X-Tenant-Id`, `X-Workspace-Id`), and response unwrapping.
4. Re-export from `apps/console/src/features/metadata/api/types.ts` for zero regressions.
5. Run full test suite, type checking, and production web build.

## Changes
- `packages/client/package.json`: Workspace definition for `@acc/client`.
- `packages/client/tsconfig.json`: TypeScript configuration extending `@acc/typescript-config`.
- `packages/client/src/types.ts`: Centralized all domain DTOs and interfaces.
- `packages/client/src/client.ts`: Universal HTTP client with traceparent, context injection, and RFC 7807 error handling.
- `packages/client/src/index.ts`: Public package export.
- `packages/client/src/__tests__/client.test.ts`: Test suite verifying headers, async token resolution, and error parsing.
- `apps/console/package.json`: Added `@acc/client: "workspace:*"`.
- `apps/console/tsconfig.app.json`: Added path alias for `@acc/client`.
- `apps/console/src/features/metadata/api/types.ts`: Re-exported `@acc/client`.
- `apps/console/doc/implementation_plan_76.md` & `apps/console/doc/walkthrough_76.md`: Artifacts documented.

## Verification
- `pnpm --filter @acc/client test`: Passed (6/6 tests).
- `pnpm --filter @acc/client run check-types`: Passed with 0 errors.
- `pnpm --filter @acc/console exec tsc --noEmit`: Passed with 0 errors.
- `pnpm --filter @acc/console exec vite build --mode web`: Clean production build in 7.79s.
- `pnpm --filter @acc/console test`: 29 test files passed (146/146 tests).

## Walkthrough
Refer to `apps/console/doc/walkthrough_76.md`.

## Tasks
- [x] Create packages/client
- [x] Migrate types & implement AccClient with W3C traceparent
- [x] Re-export in console types.ts
- [x] 100% test passing and clean production vite build

## Enhancement
Phase 3 will extract the Unified Sandbox Platform into `packages/sandbox` so all multi-tier clients can share deterministic in-memory mock handlers.
