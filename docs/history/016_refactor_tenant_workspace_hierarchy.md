# History Log 016: Refactor Tenant & Workspace Domain Hierarchy

## 1. Problem
In the previous implementation of Phase 3, Workspace and Organization were colloquially conflated as interchangeable terms (e.g. `Workspaces & Organizations`, with single-level profile lists). However, the domain architecture of Acc dictates:
- The system is **Tenant-based**: One Tenant represents an Organization or an Individual representation.
- One Tenant can have multiple **Users**.
- One Tenant can have multiple **Workspaces** (1 Workspace $\ne$ 1 Organization; Workspaces are children of a Tenant).
- PostgreSQL RLS, billing, and entity type ownership remain at the `tenant_id` boundary, while `workspace_id` acts as a sub-partition within that Tenant.

The UI and state stores required adjustment to accurately reflect this hierarchy.

## 2. Plan
1. Extend `useMetadataUiStore` with `activeWorkspaceId`, `activeWorkspaceName`, and `setActiveWorkspace`.
2. Extend `Profile` and `Team` types with optional `tenantId` and `tenantName`.
3. Group workspaces under parent Tenant / Organization headers in `ProfileSwitcher`.
4. Add an Active Tenant Context card and tenant indicator tags in `WorkspacesPanel`.
5. Enhance `CreateWorkspaceModal` to show the target parent Tenant context and associate new workspaces with the active tenant.
6. Refactor Step 1 in `OnboardingFunnelModal` to clearly separate Organization (Tenant) name from the initial Workspace name.
7. Update test assertions in `workspaces.test.tsx` and verify clean build/test passes.
8. Document architectural updates in `domain_blueprints_fullstack_guide.md`.

## 3. Changes
- **`apps/console/src/features/metadata/store/use-metadata-ui-store.ts`**: Added `activeWorkspaceId`, `activeWorkspaceName`, `setActiveWorkspace`.
- **`apps/console/src/stores/profile-store.ts`**: Added `tenantId` and `tenantName` fields to `Profile`.
- **`apps/console/src/components/layout/types.ts`**: Added `id`, `tenantId`, and `tenantName` to `Team`.
- **`apps/console/src/components/layout/data/sidebar-data.ts`**: Annotated `sidebarTeams` with explicit tenant associations.
- **`apps/console/src/components/layout/profile-switcher.tsx`**: Clustered workspaces under sticky organization headers with `Building2` icon.
- **`apps/console/src/features/settings/workspaces/workspaces-panel.tsx`**: Added Tenant Context banner, tenant IDs, and `(Cùng tổ chức)` badges.
- **`apps/console/src/features/settings/workspaces/create-workspace-modal.tsx`**: Added parent tenant info card and clarified workspace creation scopes.
- **`apps/console/src/features/landing/components/onboarding-funnel-modal.tsx`**: Distinct fields for Tenant (Organization) and initial Workspace.
- **`apps/console/src/features/settings/workspaces/workspaces.test.tsx`**: Updated test selectors for workspace names and panel components.
- **`docs/multi-tenants/domain_blueprints_fullstack_guide.md`**: Clarified Tenant vs. Workspace hierarchy in Touchpoint B.
- **`apps/console/doc/walkthrough_65.md`**: Created walkthrough documentation.

## 4. Verification
- `pnpm --filter @acc/console exec tsc --noEmit` $\rightarrow$ 0 errors.
- `pnpm --filter @acc/console test` $\rightarrow$ 15 test files passed, 81 tests passed.
