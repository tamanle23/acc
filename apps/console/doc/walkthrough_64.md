# Walkthrough 64: Phase 3 Multi-Workspace Switcher & Organization Provisioning

## Executive Summary
This document records the full-stack implementation of **Phase 3 of the Domain Blueprints Ecosystem**:
1. **Settings Workspaces Route (`/settings/workspaces`)**:
   - Implemented `src/routes/_authenticated/settings/workspaces.tsx` using TanStack Router.
   - Added `Workspaces` item with `<Building2 size={18} />` to `sidebarNavItems` in `src/features/settings/index.tsx`.
   - Updated Route Registry Matrix in `ROUTE.md`.
2. **Workspaces Management Panel (`WorkspacesPanel`)**:
   - Displays all registered organization profiles/tenants.
   - Highlights the currently active tenant with an `Đang chọn` badge.
   - 1-click workspace switching: seamlessly swaps active `tenant_id` and `activeTenantName` in `useMetadataUiStore` and updates the profile cookie.
   - Includes action button `+ Tạo Workspace Mới`.
3. **Organization Creation Modal with Blueprint Seeding (`CreateWorkspaceModal`)**:
   - Prompts for workspace name (auto-generating sanitized tenant slug).
   - Features interactive Domain Blueprint template selector (*Headless CMS*, *Fleet Logistics*, *B2B CRM*, *Blank Canvas*) with preview triggers.
   - Atomically provisions the target blueprint via `POST /api/v1/metadata/tenants/provision`, registers the new workspace in `useProfileStore`, sets active tenant context, and triggers cache invalidation.
4. **Header Profile Switcher Integration (`ProfileSwitcher`)**:
   - Updated `src/components/layout/profile-switcher.tsx`:
     - Selecting a profile from the dropdown automatically synchronizes `useMetadataUiStore.setActiveTenant`.
     - Clicking `Add workspace profile` opens the `CreateWorkspaceModal` directly from the persistent sidebar.

---

## Verification & Quality Assurance
1. **Frontend Typecheck**:
   - `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
2. **Frontend Vitest Unit Tests**:
   - `pnpm --filter @acc/console test`: 15 test suites, 81 unit tests passed cleanly (including `workspaces.test.tsx`).
