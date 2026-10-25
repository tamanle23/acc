# Storage Provider Configuration Popup

This plan addresses the missing requirements: implementing the configuration popup for "User Provided" storages, and allowing users to assign them to workspaces and toggle their enablement status. Per recent feedback, there will be two separate actions: "Manage" and "Assignments".

## Proposed Changes

---

### `@acc/console` (Data Model)

#### [MODIFY] [storages.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/storage/data/storages.tsx)
- Refactor `assignedWorkspaces` from `string[]` to an array of objects: `Array<{ workspaceId: string, enabled: boolean }>`.
- For 'System Internal' providers, it will remain `'all'`, representing an immutable global assignment.

### `@acc/console` (UI Components)

#### [NEW] `storage-assignments-dialog.tsx` (in `apps/console/src/features/storage/`)
- A new component utilizing `Dialog` from `@/components/ui/dialog`.
- **Trigger**: An "Assignments" button from the storage card (rendered only for 'User Provided').
- **Content**:
  - Displays a list of all available workspaces (fetched via `useProfile()` context).
  - For each workspace:
    - If the provider is **not assigned**: Shows an "Assign" button/checkbox.
    - If the provider is **assigned**: The assignment cannot be removed (checkbox disabled), but a Switch/Toggle will be shown to set it to "Enabled" or "Disabled" for that specific workspace.
  - A "Save Changes" button.

#### [NEW] `storage-manage-dialog.tsx` (in `apps/console/src/features/storage/`)
- A new component utilizing `Dialog` from `@/components/ui/dialog`.
- **Trigger**: The "Manage" button from the storage card (rendered only for 'User Provided').
- **Content**:
  - Displays a configuration form for the provider (mocked with fields like API Key, Secret Key, Bucket Name, etc., depending on the provider).
  - A "Save Changes" button.

#### [MODIFY] [index.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/storage/index.tsx)
- Integrate `<StorageAssignmentsDialog />` and `<StorageManageDialog />`.
- Update the Storage card UI to render *both* "Manage" and "Assignments" buttons side-by-side for 'User Provided' storage items.

### `@acc/console` (Localization)

#### [MODIFY] [en/console.json](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/locales/en/console.json)
#### [MODIFY] [vi/console.json](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/locales/vi/console.json)
- Add translation keys for the dialogs (e.g., `storage.actions.assignments`, `storage.assignments.title`, `storage.assignments.assign`, `storage.manage.title`).

## Verification Plan

### Manual Verification
- Verify that clicking "Assignments" opens the workspace assignments dialog.
- Verify that clicking "Manage" opens the general configuration dialog.
- Verify that workspaces can be assigned.
- Verify that once assigned, the workspace cannot be un-assigned.
- Verify that assigned workspaces can have their status toggled between enabled/disabled.
- Verify that the layout conforms to the Liquid Glass UI design guidelines.
