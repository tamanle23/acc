# Walkthrough 72: Workspace Switcher Multi-Tenant Isolation

## Overview
When assuming a tenant (e.g. `tenant-acme`), the `ProfileSwitcher` dropdown previously listed all organizations, including `"Default Organization"` (`default-tenant`), merely sorting the assumed tenant to the top. This update enforces strict multi-tenant boundary isolation so that when in an assumed session, the dropdown exclusively renders workspaces belonging to the assumed tenant.

---

## Changes

### 1. Multi-Tenant Workspace Isolation ([`apps/console/src/components/layout/profile-switcher.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/components/layout/profile-switcher.tsx))
- Introduced `displayProfiles` memo:
  - If `isAssumed && assumedTenant` is true: filters `availableProfiles` down to only those matching `p.tenantId === assumedTenant`.
  - In normal/unassumed sessions: preserves full workspace selection.
- All subsequent dropdown rendering (including `groupedByTenant`) operates exclusively on `displayProfiles`.
- Result: `"Default Organization"` and any other unrelated commercial organizations are completely removed from view while impersonating a tenant.

### 2. Unit Testing ([`apps/console/src/components/layout/__tests__/profile-switcher.test.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/components/layout/__tests__/profile-switcher.test.tsx))
- Added test: `strictly isolates workspace dropdown to assumed tenant workspaces only, excluding Default Organization`.
- Verifies that `"Default Organization"` and `"Unipost Main"` are absent from the document when `tenant-acme` is assumed.

---

## Verification Results
- Vitest suite: **24 test files passed, 115 tests passed**.
- TypeScript type check: **0 errors (`tsc --noEmit`)**.
