# Implementation Plan 17: Phase 4 - mobile-ui Sandbox Integration & Context Store

## 1. Overview
In accordance with `docs/brainstorming/integration_master_plan_iteration_1.md` (Phase 4) and `.agents/rules/02-unified-sandbox.md`, integrate `@acc/sandbox` and `@acc/client` into `apps/mobile-ui`:
1. Link `"@acc/client": "workspace:*"` and `"@acc/sandbox": "workspace:*"` into `apps/mobile-ui/package.json`.
2. Configure path aliases in `apps/mobile-ui/tsconfig.json` for monorepo workspace resolution.
3. Delete rogue hardcoded mock data file `apps/mobile-ui/src/constants/mockData.ts`.
4. Implement `apps/mobile-ui/src/store/useMobileContextStore.ts`:
   - Tracks active tenant (`activeTenantId`), active workspace (`activeWorkspaceId`), and active user/persona.
   - Synchronizes with `@acc/sandbox` store.
5. Create mobile sandbox adapter/initializer `apps/mobile-ui/src/sandbox/mobile-sandbox.ts`:
   - Registers standard `posts` route handler matching `/api/v1/metadata/records` (`entityType=post`).
   - Attaches global fetch interceptor via `createSandboxFetch` / `attachGlobalSandboxFetch`.
6. Refactor `apps/mobile-ui/src/store/usePostStore.ts`:
   - Queries and mutates records via `accClient` (`/v1/metadata/records?entityType=post`).
   - Provides clean stateful `resetPosts` pulling from Sandbox.
7. Initialize sandbox interceptor in `apps/mobile-ui/App.tsx`.

## 2. Affected Files
- `apps/mobile-ui/package.json`
- `apps/mobile-ui/tsconfig.json`
- `apps/mobile-ui/src/constants/mockData.ts` (deleted)
- `apps/mobile-ui/src/store/useMobileContextStore.ts` (new)
- `apps/mobile-ui/src/sandbox/mobile-sandbox.ts` (new)
- `apps/mobile-ui/src/store/usePostStore.ts` (refactored)
- `apps/mobile-ui/App.tsx` (updated)

## 3. Verification Plan
- Unit test suite verifying mobile sandbox integration and post store fetching.
- `pnpm --filter mobile-ui` type checking.
- Zero occurrences of `mockData.ts` across `apps/mobile-ui`.
