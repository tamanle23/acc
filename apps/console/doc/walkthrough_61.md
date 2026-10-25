# Walkthrough 61: UI Wiring for Phase 7 (Noisy Neighbor Defense & Quotas) & Phase 8 (GDPR & Data Portability)

## Executive Summary
This document records the UI integration in `@acc/console` for:
1. **Phase 7: Noisy Neighbor Defense, Resource Quotas & Pre-flight ReDoS Guard**
2. **Phase 8: Data Portability Export & GDPR Article 17 Hard-Purge**

Both features are fully implemented, strictly typed, WCAG 2.2 AA compliant with Liquid Glass visual standards, and verified with `tsc --noEmit` and Vitest suites.

---

## 1. Phase 7: Quotas & ReDoS Defense Implementation

### 1.1 HTTP 429 Interceptor & Retry-After Handling
- **File**: [`apps/console/src/lib/handle-server-error.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/lib/handle-server-error.ts)
  - Added dedicated branch checking for status `429` (Too Many Requests).
  - Inspects `error.response?.headers?.['retry-after']` or response body `retryAfterSeconds` / `message`.
  - Shows localized warning toast: `Too many requests. Please wait ${seconds}s before retrying.`
- **File**: [`apps/console/src/main.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/main.tsx)
  - Catches `429` errors inside React Query's `QueryCache.onError` handler, preventing silent query failures and surfacing rate limit feedback to the user.

### 1.2 Model & Attribute Quota Badges
- **Model Quota Badge**:
  - **File**: [`apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx)
  - Displays dynamic quota badge (`X / 50 Models`) next to the search bar.
  - Automatically disables the `+ New` entity type creation button with a helpful tooltip when the tenant reaches the 50 model limit.
- **Attribute Quota Badge**:
  - **File**: [`apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx)
  - Displays dynamic attribute count badge (`Y / 100 Fields`) inside the glass action toolbar.
  - Disables the `Add Field` button when the tenant reaches 100 attributes per entity type.

### 1.3 Pre-flight ReDoS Static Analysis Guard
- **File**: [`apps/console/src/features/metadata/components/schema-builder/attribute-dialog.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/schema-builder/attribute-dialog.tsx)
  - Added static ReDoS pattern detector matching dangerous nested repetition structures:
    - `(\(.*[+*]\)[+*]|\([a-zA-Z0-9_[\]|-]+[+*]\)[+*])`
    - Nested quantifiers: `([a-z]+)+`, `(a*)*`, etc.
  - Renders an inline warning banner with `<AlertTriangle />` when a dangerous pattern is detected.
  - Disables the `Save Attribute` button, blocking catastrophic backtracking expressions before they reach backend submission.

---

## 2. Phase 8: Data Portability & GDPR Article 17 Hard-Purge

### 2.1 Navigation & Routing
- **File**: [`apps/console/src/features/settings/index.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/settings/index.tsx)
  - Added `Data & Privacy` navigation item under the Security & Compliance group with `<ShieldAlert size={18} />`.
- **File**: [`apps/console/src/routes/_authenticated/settings/data-privacy.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/routes/_authenticated/settings/data-privacy.tsx)
  - Created TanStack Router subroute bound to `/settings/data-privacy`.
- **File**: [`apps/console/ROUTE.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/ROUTE.md)
  - Updated Route Registry table to document `/settings/data-privacy`.

### 2.2 DataPrivacyPanel Component
- **File**: [`apps/console/src/features/settings/data-privacy/data-privacy-panel.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/settings/data-privacy/data-privacy-panel.tsx)
  - **1-Click Export Section**:
    - Trigger `GET /api/v1/metadata/tenants/{tenantId}/export`.
    - Handles stream download with progress animation and saves as `acc-export-${tenantId}-${Date.now()}.zip`.
  - **GDPR Article 17 Hard-Purge (Right to be Forgotten)**:
    - High-visibility danger card with destructive warning indicators.
    - Two-step confirmation modal requiring typing `PURGE ${tenantId}`.
    - Shows real-time progress through 5 purge stages (Storage, Redis Cache, Audit Logs, Entity Tables, Decommission).
    - Upon completion, presents **Certificate of Erasure** with SHA-256 verification hash, ISO timestamp, and action to copy the certificate or proceed to logout.

---

## 3. Verification & Quality Assurance

1. **TypeScript Typecheck**:
   ```bash
   pnpm --filter @acc/console exec tsc --noEmit
   ```
   *Result*: `0 errors` (Clean compile).

2. **Automated Unit & Component Tests**:
   ```bash
   pnpm --filter @acc/console test
   ```
   *Result*: 6 test files, 41 tests passed.
