# Task History: [033] Align Unified Sandbox Platform with Recent Console UI Changes

## Problem Statement
Following major multi-tenant architectural changes (Sovereign Root Custody, tenant immutable default workspaces, user-selected personal defaults, and sovereign slide-over drawers), the Unified Sandbox Platform had minor misalignments:
1. `SandboxDock`'s tenant scope selector lacked `tenant-acme` and displayed raw strings instead of human-readable organization names.
2. Switching persona or tenant in `sandboxManager` did not propagate to UI context stores (`useMetadataUiStore` and `useProfileStore`), occasionally leaving TopNav, Sidebar, and ProfileSwitcher out of sync until a manual page refresh.
3. Resetting mock data (`handleResetAllData`) left old user default workspace keys (`unipost_user_default_ws_*`) and stale assumed tenant sessions (`unipost_assumed_*`) in `localStorage`.
4. Devs and QAs lacked instant 1-click diagnostic triggers in the dock for testing edge cases like the Unassigned User Intervention Screen or Orphaned Tenant State (0 workspaces).
5. A circular module reference occurred between `sidebar-data.ts` and `core/sandbox/index.ts`.

## Proposed Plan
1. **Bi-Directional Store Synchronization**:
   - In `apps/console/src/core/sandbox/manager/sandbox-manager.ts`, update `switchPersona` and `switchTenant` to call `useMetadataUiStore.getState().setActiveTenant(...)` and `useProfileStore.getState().syncAssumedTenant(...)`.
2. **Resolve Circular Dependency**:
   - Update `apps/console/src/components/layout/data/sidebar-data.ts` to import `useSandboxStore` directly from `@/core/sandbox/store/sandbox-store`.
3. **Upgrade SandboxDock UI**:
   - In `apps/console/src/core/sandbox/ui/sandbox-dock.tsx`:
     - Update `tenants` list to include `SYSTEM`, `tenant-acme`, `tenant-us-east-1`, `tenant-eu-central-1`, and `tenant-us-west-2` with human-readable labels.
     - Delegate tenant switching to `sandboxManager.switchTenant`.
     - In `handleResetAllData()`, purge all `unipost_user_default_ws_*` and `unipost_assumed_*` keys from `localStorage`.
     - Add 2 quick simulation shortcut buttons under `Persona & Scope`: "Unassigned User" and "Orphaned Tenant".
4. **Automated Unit Tests**:
   - Update `sandbox-dock.test.tsx` to verify tenant switching to `tenant-acme`, unassigned user simulation, and localStorage cleanup on reset.
5. **Verification**:
   - Run sandbox test suites and full console test suite (`139` tests).
   - Verify production Vite build.

## Implementation Details
- Modified `UnifiedSandboxManager`:
  - `switchPersona`: updates persona, auth tokens, `useMetadataUiStore`, and `useProfileStore`.
  - `switchTenant`: updates `useSandboxStore`, `useMetadataUiStore`, and `useProfileStore`.
- Enhanced `SandboxDock`:
  - Enriched tenant scope list with proper tenant metadata.
  - Added clean localStorage sweep in `handleResetAllData`.
  - Added Edge-Case Diagnostics action buttons.
- Updated `sandbox-dock.test.tsx` with 3 new automated test cases.

## Verification
- Vitest sandbox tests: 8/8 test files passed (56/56 tests green).
- Full `@unipost/console` Vitest suite: 27/27 test files passed (139/139 tests green).
- Production Vite build: built successfully in 686ms with zero errors.

## History Log Reference
- History log: `docs/history/033_align_unified_sandbox_with_console_ui.md`
