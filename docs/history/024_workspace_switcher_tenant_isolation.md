# History Entry 024: Workspace Switcher Multi-Tenant Isolation in Assume-Tenant Mode

## Problem Statement
When assuming a tenant (e.g. `tenant-acme`), the `ProfileSwitcher` dropdown displayed the assumed tenant's workspaces at the top, but still included `"Default Organization"` (`ws-main`) and other tenant workspaces below it. In multi-tenant systems, impersonating a specific tenant must strictly enforce organization boundaries—the workspace list must only contain workspaces belonging to the assumed tenant.

---

## Architectural & Technical Plan
1. **Scope Profiles to Assumed Tenant (`apps/console/src/components/layout/profile-switcher.tsx`)**:
   - Filter `availableProfiles` by `tenantId === assumedTenant` when `isAssumed` is true.
   - Use the isolated profile subset to compute `groupedByTenant`.
   - Prevent cross-tenant leakage in UI while preserving the "Exit Sub-Session" action for returning to Sovereign Root.
2. **Comprehensive Verification**:
   - Add unit test in `src/components/layout/__tests__/profile-switcher.test.tsx` verifying `"Default Organization"` and `"Acc Main"` are absent when a tenant is assumed.
   - Run vitest and TypeScript validation.

---

## Verification
- Vitest: 24 test files, 115 tests passing.
- TypeScript: `pnpm --filter @acc/console exec tsc --noEmit` clean.
