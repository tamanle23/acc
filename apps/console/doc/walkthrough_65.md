# Walkthrough 65: Tenant & Workspace Domain Hierarchy Refactoring

## 1. Executive Summary
This document records the architectural refinement and UI refactoring to enforce the system-wide domain rule:
- **Tenant:** Represents the Organization or Individual (Top-level billing account, PostgreSQL RLS tenant boundary `tenant_id`, entity type owner, and subscription holder). One Tenant can have multiple Users.
- **Workspace:** Sub-partition / Environment / Branch belonging to a Tenant (e.g., *Production Workspace*, *Staging Environment*, *Warehouse Hub North*). **1 Workspace $\ne$ 1 Organization**; Workspaces belong to a Tenant.

---

## 2. Changes Made Across `@unipost/console`

### A. State Management & Types
- **`use-metadata-ui-store.ts`**:
  - Added `activeWorkspaceId: string` (default: `'ws-main'`) and `activeWorkspaceName: string` (default: `'Production Workspace'`).
  - Added `setActiveWorkspace(workspaceId: string, workspaceName?: string)` to cleanly switch workspaces without mutating tenant context.
- **`profile-store.ts` & `layout/types.ts`**:
  - Added `tenantId?: string` and `tenantName?: string` to `Profile` / `Team` types.
- **`sidebar-data.ts`**:
  - Annotated demo profiles with explicit parent tenant mappings (`Unipost Main` under `Default Organization`, `Acme Prod` & `Acme Staging` under `Acme International Corp`).

### B. UI Components
- **`ProfileSwitcher` (`src/components/layout/profile-switcher.tsx`)**:
  - Workspaces are grouped by their parent **Organization (Tenant)** using sticky headers with `Building2` icons.
  - Selecting a workspace synchronizes both `setActiveTenant` and `setActiveWorkspace`.
  - Renamed "+ Add workspace profile" to "Tạo Workspace Mới".
- **`WorkspacesPanel` (`src/features/settings/workspaces/workspaces-panel.tsx`)**:
  - Added an **Active Tenant Context Card** at the top showing the current Organization name, `tenant_id` badge, and Multi-Tenant RLS Active badge.
  - Updated descriptions to clarify that Workspaces belong to an Organization (Tenant).
  - Added `(Cùng tổ chức)` badge for workspaces matching the active tenant.
- **`CreateWorkspaceModal` (`src/features/settings/workspaces/create-workspace-modal.tsx`)**:
  - Added Active Parent Tenant card showing where the new workspace will be created.
  - Clarified form labels: "Tên Workspace Mới" and slug generator.
  - Automatically binds the newly created workspace to the active `tenantId` and `tenantName`.
- **`OnboardingFunnelModal` (`src/features/landing/components/onboarding-funnel-modal.tsx`)**:
  - Separated Step 1 inputs into "Tên Tổ chức / Doanh nghiệp (Tenant) *" and "Tên Không gian làm việc khởi tạo (Workspace)".
  - Synchronizes both `setActiveTenant` and `setActiveWorkspace` upon completing setup.

---

## 3. Verification & Quality Assurance
- **TypeScript Typecheck:** `pnpm --filter @unipost/console exec tsc --noEmit` passed with 0 errors.
- **Vitest Suite:** `pnpm --filter @unipost/console test` passed all 15 test files and 81 tests.
