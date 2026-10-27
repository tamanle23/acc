# 015: Domain Blueprints Full-Stack Phase 3 - Multi-Workspace Switcher & Organization Provisioning

## 1. Problem Statement
In enterprise accounts, an organization admin manages multiple isolated workspaces/subsidiaries (e.g. logistics hubs, digital publishing branches). The platform needed:
- A dedicated workspace management interface under Settings (`/settings/workspaces`).
- Seamless tenant context synchronization between the sidebar `ProfileSwitcher`, the profile store, and `useMetadataUiStore`.
- A 1-click modal to create new workspaces pre-seeded with any catalog Domain Blueprint.

## 2. Changes Made
1. **Settings Workspaces Feature (`src/features/settings/workspaces/`)**:
   - `workspaces-panel.tsx`: Renders cards for all workspaces with RLS indicators, current workspace badge, and instant switching button.
   - `create-workspace-modal.tsx`: Modal requesting workspace name, displaying blueprint selector with structure previews, calling `provisionTenant`, and registering the workspace in `useProfileStore`.
   - `workspaces.test.tsx`: Unit tests verifying list rendering, active indicator, and switching handler.
2. **Routing & Navigation**:
   - Created `src/routes/_authenticated/settings/workspaces.tsx`.
   - Added `Workspaces` item with `<Building2 size={18} />` to `sidebarNavItems` in `src/features/settings/index.tsx`.
   - Updated Route Registry Matrix in `ROUTE.md`.
3. **AppSidebar Integration**:
   - Updated `src/components/layout/profile-switcher.tsx` to sync active tenant context to `useMetadataUiStore` on selection, and open `CreateWorkspaceModal` when clicking `Add workspace profile`.

## 3. Verification
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
- `pnpm --filter @acc/console test`: 15 suites, 81 tests passed.

## 4. Key Artifacts
- Plan: `apps/console/doc/implementation_plan_62.md`
- Walkthrough: `apps/console/doc/walkthrough_64.md`
