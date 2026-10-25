# Add Storage Feature, Draft/Live Lifecycle, and Enhancements

This plan addresses the new requirements for the Storage Providers screen, introducing a "Draft" vs "Live" lifecycle, the ability to add new providers from templates, and exposing "Manage" / "Assignments" to System Internal providers.

## Proposed Changes

---

### `@acc/console` (Data Model)

#### [MODIFY] [storages.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/storage/data/storages.tsx)
- Add `lifecycleStatus: 'Draft' | 'Live'` to the `StorageProvider` interface.
- Ensure all existing mocked storages start as `'Live'`.
- Define a new `predefinedProviderTemplates` array (or similar mock) to represent the base providers (e.g., generic S3, Google Cloud, Cloudflare R2) that a user can instantiate.

### `@acc/console` (UI Components)

#### [MODIFY] [index.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/storage/index.tsx)
- Revert the restriction on "Manage" and "Assignments" buttons so they now also render for **"System Internal"** providers.
- Add an **"Add Storage Provider"** button near the search/filter controls.
- Render a `lifecycleStatus` badge ("Draft" or "Live") on the storage cards.

#### [NEW] `add-storage-dialog.tsx` (in `apps/console/src/features/storage/`)
- A new dialog triggered by the "Add Storage Provider" button.
- Displays a grid/list of `predefinedProviderTemplates`.
- Upon selection, a new mocked `StorageProvider` is pushed to the state (or a mocked global list if using state in `index.tsx`) with `lifecycleStatus: 'Draft'`, `providerType: 'User Provided'`, and empty assignments.

#### [MODIFY] [storage-manage-dialog.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/storage/storage-manage-dialog.tsx)
- Add a **"Test Connection"** (Live status check) button in the dialog.
- If the provider is in 'Draft' status, clicking "Test Connection" will mock a successful connection check, change its status to 'Live', and trigger the "save to backend" API mock.

#### [MODIFY] [storage-assignments-dialog.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/storage/storage-assignments-dialog.tsx)
- Add **"Enable All"** and **"Disable All"** bulk action buttons/dropdowns.
- These buttons will iterate through all *currently assigned* workspaces and toggle their `enabled` boolean.

### `@acc/console` (Localization)

#### [MODIFY] [en/console.json](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/locales/en/console.json)
#### [MODIFY] [vi/console.json](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/locales/vi/console.json)
- Add translation keys for:
  - `storage.actions.addProvider` ("Add Provider")
  - `storage.actions.testConnection` ("Test Connection")
  - `storage.assignments.enableAll` ("Enable All")
  - `storage.assignments.disableAll` ("Disable All")
  - `storage.lifecycle.draft` ("Draft")
  - `storage.lifecycle.live` ("Live")

## Verification Plan
- Verify that "System Internal" cards now have "Manage" and "Assignments".
- Verify that "Add Provider" opens a selection dialog, and selecting a provider adds a "Draft" card to the list.
- Verify that opening "Manage" on a "Draft" provider allows testing connection and upgrades it to "Live".
- Verify that "Enable All" / "Disable All" in the Assignments dialog correctly toggles all assigned workspaces in bulk.
