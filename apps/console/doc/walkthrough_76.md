# Walkthrough 76: Phase 2 - Universal Client SDK (`@acc/client`)

## 1. Overview
Completed Phase 2 of `docs/brainstorming/integration_master_plan_iteration_1.md`:
- Created `@acc/client` as a shared monorepo package under `packages/client/`.
- Migrated and centralized all core metadata DTOs, query contracts, validation types, domain blueprints, and billing schemas into `packages/client/src/types.ts`.
- Implemented `UnipostClient` in `packages/client/src/client.ts`:
  - Cross-runtime compatible standard `fetch` execution (Browser, Expo React Native, Next.js, Node.js).
  - Automated W3C `traceparent` generator.
  - Automatic `Authorization`, `X-Tenant-Id`, and `X-Workspace-Id` context header resolution.
  - Transparent response body/data unwrapping.
  - RFC 7807 `ProblemDetail` parsing and typed `UnipostClientError`.
- Linked `@acc/client` into `@acc/console` workspace dependencies, maintaining 100% backward compatibility by re-exporting from `apps/console/src/features/metadata/api/types.ts`.

## 2. Changes Summary
- `packages/client/package.json`: Configured package with exports for `.` and `./types`.
- `packages/client/tsconfig.json`: Linked to `@acc/typescript-config/base.json`.
- `packages/client/src/types.ts`: Centralized 275+ lines of domain interfaces and DTOs.
- `packages/client/src/client.ts`: Universal `UnipostClient`, `createUnipostClient`, `generateTraceparent`, and `UnipostClientError`.
- `packages/client/src/index.ts`: Barrel export for types and client.
- `packages/client/src/__tests__/client.test.ts`: 6 unit tests covering traceparent format, context headers, async token resolution, unwrapping, RFC 7807 problem details, and URL serialization.
- `apps/console/package.json` & `apps/console/tsconfig.app.json`: Added `@acc/client` workspace link and path alias.
- `apps/console/src/features/metadata/api/types.ts`: Re-exported everything from `@acc/client`.

## 3. Verification Results
- `pnpm --filter @acc/client test`: 1 test file passed, 6/6 tests passed.
- `pnpm --filter @acc/client run check-types`: Clean with 0 errors.
- `pnpm --filter @acc/console exec tsc --noEmit`: Clean with 0 errors.
- `pnpm --filter @acc/console exec vite build --mode web`: Clean production bundle built in 7.79s.
- `pnpm --filter @acc/console test`: 29 test files passed, 146/146 tests green.
