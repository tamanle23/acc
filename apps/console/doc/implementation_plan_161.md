# Console Implementation Plan - Iteration 161: Unified Sandbox Harmonization, Dead Code Elimination & Shared Primitive Consolidation

## 1. Problem & Context
1. In `apps/console/src/features/metadata`, `mock-metadata.ts` (2,148 lines) and `MetadataServiceStrategy` in `metadata-service.ts` run a private ad-hoc mock store bypassing the Unified Sandbox Platform (`packages/sandbox`), violating `.agents/rules/02-unified-sandbox.md`.
2. In `apps/console/src/features/users`, `RegisterUserForm.tsx` and `useRegisterUserFacade.ts` are orphaned artifacts calling an unauthenticated, non-existent `/api/v2/users/register` via raw `fetch()`. They violate `NO-ORPHANED-CODE` and file naming conventions.
3. In `apps/console/src/features/metadata/api/http-metadata-service.ts`, `BASE_URL` is set to `/v1/metadata`. When used with `springApiClient` (`baseURL: '/api'`), it maps to `/api/v1/metadata`, but direct path references should be clarified and normalized.
4. Redundant table pagination and filter toolbars are duplicated between `workflow-executions-table.tsx` and `users-table.tsx` instead of consuming shared `@acc/ui` primitives.

## 2. Proposed Changes
- **Metadata Unified Sandbox Migration**:
  - Relocate mock state to `packages/sandbox/src/handlers/metadata-sandbox-handler.ts` implementing `SandboxRouteHandler`.
  - Wire `metadataSandboxHandler` into `packages/sandbox/src/handlers/index.ts` and `sandboxRegistry`.
  - Remove `apps/console/src/features/metadata/data/mock-metadata.ts`.
  - Simplify `metadata-service.ts` to export `httpMetadataService` directly, relying on `springApiClient`'s sandbox interceptor for offline dev simulation.
- **Dead Code Pruning**:
  - Delete `apps/console/src/features/users/api/useRegisterUserFacade.ts`.
  - Delete `apps/console/src/features/users/components/RegisterUserForm.tsx`.
- **Shared UI Primitive Consolidation**:
  - Audit and consolidate data table pagination controls in `workflow-executions-table.tsx` and `users-table.tsx` to reuse `@acc/ui` table primitives.

## 3. Verification Plan
- `pnpm --filter @acc/sandbox test`
- `pnpm --filter @acc/console test -- src/features/metadata src/features/users src/features/workflow-executions`
- `pnpm --filter @acc/console exec tsc --noEmit --project tsconfig.json`
