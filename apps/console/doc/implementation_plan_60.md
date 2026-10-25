# Implementation Plan - Phase 5: Console UI Dual-Mode Context Switching

## Overview
Implement seamless dual-mode context switching between "Architect Studio" (schema modeling) and "Operator View" (business data entry) in `@acc/console`, providing tenant administrators instant dogfooding capability while strictly enforcing role-based tab access and visual differentiation for base `SYSTEM` vs. custom attributes.

## Proposed Changes

### 1. Store State Expansion (`apps/console/src/features/metadata/store/use-metadata-ui-store.ts`)
- Add `WorkspaceMode = 'architect' | 'operator'` and `TenantRole = 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_VIEWER'`.
- Add state fields:
  - `activeTenantId: string`
  - `activeTenantName: string`
  - `currentUserRole: TenantRole`
  - `workspaceMode: WorkspaceMode`
- Add actions:
  - `setWorkspaceMode(mode: WorkspaceMode)` (with safe fallback redirecting `activeTab` from `schema` to `data` if mode becomes `operator`).
  - `toggleWorkspaceMode()`
  - `setCurrentUserRole(role: TenantRole)`
  - `setActiveTenant(id: string, name?: string)`
- Add selectors:
  - `canManageSchema(): boolean` (`currentUserRole === 'TENANT_ADMIN' && workspaceMode === 'architect'`)
  - `canMutateRecords(): boolean` (`currentUserRole !== 'TENANT_VIEWER'`)

### 2. Main Stage Component (`apps/console/src/features/metadata/components/metadata-feature.tsx`)
- In the active model header:
  - Add Liquid Glass mode toggle pill: `Architect Studio` (amber/sparkles) vs `Operator View` (emerald/user) for `TENANT_ADMIN`.
- In tab navigation rail:
  - Conditionally mount the `<TabsTrigger value="schema">` only when `canManageSchema()` is true.
  - Automatically redirect `activeTab` to `data` if `schema` tab is active when switching to `operator` mode.

### 3. Left Rail Sidebar (`apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx`)
- Guard `+ New` button and the item dropdown actions (`Edit Model`, `Delete Model`) behind `canManageSchema()`.
- In `Operator View`, provide clean, distraction-free model navigation.

### 4. Attribute Visual Badges & Immutability (`apps/console/src/features/metadata/components/schema-builder/attribute-card.tsx`)
- Inspect `attribute.tenantId`:
  - If `attribute.tenantId === 'SYSTEM'`:
    - Display 🔒 **System Core Field** badge (`border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300`).
    - Disable or hide edit, archive, and delete action buttons with tooltip explaining system field protection.
  - Otherwise:
    - Display ✏️ **Custom Attribute** badge (`border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300`).
    - Full editing/deletion capabilities enabled.

### 5. Record Editor Inspection Badge (`apps/console/src/features/metadata/components/dynamic-fields/dynamic-field-renderer.tsx`)
- When in `Architect Mode`, display technical badge and schema details on fields (`[SYSTEM]` or `[CUSTOM]`, `systemName`, `dataType`).

### 6. Localization
- Update `apps/console/src/locales/en/console.json` and `apps/console/src/locales/vi/console.json` simultaneously with mode toggle labels, system badge tooltips, and tabs.

## Verification Plan
1. **Automated Testing:**
   - Run type checks: `pnpm --filter @acc/console check-types`
   - Run linter: `pnpm --filter @acc/console lint`
   - Run console tests: `pnpm --filter @acc/console test`
2. **Behavioral Checks:**
   - Verify store tests for mode switching, tab fallback, and permission checks.
   - Verify non-admin role restrictions.
