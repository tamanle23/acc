# Add Storage Feature and Draft/Live Lifecycle Implementation

## Changes Made
- **Data Model**: Updated `StorageProvider` in `storages.tsx` with a `lifecycleStatus` ('Draft' | 'Live'). Added `predefinedProviderTemplates` for mocking new storage additions.
- **Add Storage Flow**: Created `add-storage-dialog.tsx` which allows picking from generic provider templates. When added, the provider enters the list in `'Draft'` status.
- **Status Badges**: Added visual indicators (Live/Draft badges) on the Storage cards.
- **Connection Testing (Live Upgrade)**: Updated `storage-manage-dialog.tsx` with a "Test Connection" button. Clicking this button simulates a successful API test and transitions a `'Draft'` provider into `'Live'` status.
- **System Internal Capabilities**: Restored the "Manage" and "Assignments" buttons for "System Internal" providers, aligning with the new requirement to allow configuration for all provider types.
- **Bulk Assignment Toggles**: Added "Enable All" and "Disable All" quick actions inside the `storage-assignments-dialog.tsx` to handle bulk workspace toggles.
- **Localization**: Added translation strings across `en/console.json` and `vi/console.json` covering "Add Provider", "Test Connection", "Live", "Draft", and bulk actions.

## Verification
- Code successfully passes the `@acc/console` ESLint and type checks.
- Dialog structures, glass effects, blurs, and border opacities adhere closely to the project's Liquid Glass UI requirements.
- Validated new component rendering and transitions, ensuring that test connection actions effectively mutate status from Draft to Live.
