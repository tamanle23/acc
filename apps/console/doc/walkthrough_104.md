# Walkthrough 104 - Move DLQ Screen to SYSTEM Root Workspace & Restrict UI Access

## Summary
Relocated Dead-Letter Queue screen to the SYSTEM Sovereign Root Custodian workspace and enforced strict authorization in the console web UI:
1. **Route Migration**: Moved from `/_authenticated/dlq/` to `/_authenticated/system/dlq` (`system.dlq.tsx`).
2. **Navigation Group Realignment**: Removed `/dlq` from the general `Admin` group in `sidebar-data.ts` and added `/system/dlq` with `badge: 'ROOT'` strictly inside the `Sovereign Custody (Root)` group.
3. **Sovereign UI Guard**: Enforced `usePermissions().isSovereignCustodian` inside `DlqFeature`. Non-sovereign tenants attempting direct URL navigation are blocked with a `403 Forbidden: Sovereign Custody Restricted` screen.
4. **Platform Root Branding**: Added `Sovereign Platform Root` header badge with Crown insignia and updated description.
5. **Hook & Unified Sandbox Alignment**: Updated `use-dlq.ts` and `dlq-sandbox-handler.ts` to support `/api/v1/system/dlq` and multi-tenant fleet querying.

---

## Changes
- **Routes & Navigation**:
  - `apps/console/src/routes/_authenticated/system.dlq.tsx`: New route file.
  - `apps/console/src/routes/_authenticated/dlq/`: Removed legacy route directory.
  - `apps/console/src/components/layout/data/sidebar-data.ts`: Relocated DLQ item to Sovereign Custody (Root) group.
  - `apps/console/src/routeTree.gen.ts`: Regenerated route tree.
- **Feature & Hooks**:
  - `apps/console/src/features/dlq/index.tsx`: Added Sovereign Platform Root banner and `isSovereignCustodian` access barrier.
  - `apps/console/src/features/dlq/hooks/use-dlq.ts`: Switched API endpoints to `/system/dlq`.
  - `packages/sandbox/src/handlers/dlq-sandbox-handler.ts`: Added `/api/v1/system/dlq` route matcher and fleet listing.
- **Specifications & Tests**:
  - `apps/console/ROUTE.md`: Updated layout tree, matrix, and blueprint for `/system/dlq`.
  - `apps/console/src/features/dlq/__tests__/dlq-feature.test.tsx`: Added test asserting 403 Forbidden for non-sovereign tenants and Sovereign Platform Root rendering.

---

## Verification Results
- `pnpm --filter @acc/sandbox check-types`: Passed clean with 0 errors.
- `pnpm --filter @acc/console exec tsc --noEmit`: Passed clean with 0 errors.
- `vitest run dlq-feature`: 4/4 tests green.
